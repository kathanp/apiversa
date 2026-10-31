#!/usr/bin/env node
// scripts/scheduler.mjs — starts the autopilot at the slot times in schedule.json.
// The OS runs this every 15 minutes (see docs/SCHEDULE.md). It decides whether a slot is due in the
// configured time zone, so the computer's own time zone does not matter. No dependencies.
// It never pushes or publishes itself.
//
//   node scripts/scheduler.mjs            run a due slot, if any
//   node scripts/scheduler.mjs --dry-run  print what would run
//   node scripts/scheduler.mjs --status   print the last slots, missed slots and launch mode
//
// Env: APIVERSA_AGENT_CMD (default "cursor-agent"), APIVERSA_AGENT_ARGS (default "-p").

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CFG = JSON.parse(readFileSync('guard.config.json', 'utf8'));
// Slot times live in schedule.json (not protected, so they can be changed any time).
// Release rules (launch length, cooldowns) stay in guard.config.json, which is protected.
const S = existsSync('schedule.json') ? JSON.parse(readFileSync('schedule.json', 'utf8')) : {};
const TZ = S.timeZone ?? CFG.timeZone ?? 'America/Chicago';
// Each slot: { name, time: "HH:MM", type }. type is "build" (morning) or "harden" (evening).
const SLOTS = (S.slots ?? [
  { name: 'am', time: '09:00', type: 'build' },
  { name: 'pm', time: '21:00', type: 'harden' },
]).map((s) => {
  const [h, m] = s.time.split(':').map(Number);
  if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) throw new Error(`bad slot time "${s.time}" in guard.config.json`);
  return { ...s, start: h * 60 + m };
});
const RELEASE_DAY = S.weeklyReleaseDay ?? 'Mon';
const WINDOW_MIN = S.windowMinutes ?? 120;
const RUN_TIMEOUT_MS = (S.runHours ?? 3) * 3600e3;
const KEEP_REPORTS = 14;
const STATE = '.autopilot';
const SLOT_DIR = join(STATE, 'slots');
const REPORT_DIR = join(STATE, 'reports');
const LOCK = join(STATE, 'lock');

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');

function localParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute), weekday: p.weekday };
}

// Launch mode comes from the guard, so the release rule lives in one place.
function launch() {
  const r = spawnSync(process.execPath, ['scripts/guard.mjs', '--launch-status'], { encoding: 'utf8' });
  try {
    const all = JSON.parse(r.stdout);
    return Object.values(all).some((t) => t.inLaunch) ? { on: true, all } : { on: false, all };
  } catch {
    return { on: false, all: null };
  }
}

// Launch mode: every slot may release. Morning = RELEASE (falls back to BUILD).
// Evening = HARDEN, then a release attempt if the target is complete. A version that is not ready
// simply waits for the next slot; nothing is forced.
// Normal mode: weekly release on RELEASE_DAY morning, BUILD other mornings, HARDEN evenings.
function runType(slot, weekday, inLaunch) {
  if (slot.type === 'harden') return inLaunch ? 'HARDEN+RELEASE' : 'HARDEN';
  if (inLaunch) return 'RELEASE';
  return weekday === RELEASE_DAY ? 'RELEASE' : 'BUILD';
}

function prompt(type, runId, inLaunch) {
  return [
    `Run type: ${type}. Run id: ${runId}. Launch mode: ${inLaunch ? 'on' : 'off'}.`,
    'Read AGENTS.md, then follow docs/AUTOPILOT.md for this run type from section 3 to section 8.',
    'Do not ask questions. Print only the run report from docs/AUTOPILOT.md section 11 at the end.',
  ].join(' ');
}

function pruneReports() {
  if (!existsSync(REPORT_DIR)) return;
  const files = readdirSync(REPORT_DIR).sort();
  for (const f of files.slice(0, Math.max(0, files.length - KEEP_REPORTS))) rmSync(join(REPORT_DIR, f));
}

if (args.includes('--status')) {
  const l = launch();
  console.log(`time zone ${TZ}; slots ${SLOTS.map((s) => `${s.name}=${s.time}`).join(', ')}; launch mode ${l.on ? 'ON' : 'off'}`);
  if (l.all) console.log(JSON.stringify(l.all));
  if (existsSync(SLOT_DIR)) for (const f of readdirSync(SLOT_DIR).sort().slice(-20)) console.log(f, readFileSync(join(SLOT_DIR, f), 'utf8').trim());
  process.exit(0);
}

mkdirSync(SLOT_DIR, { recursive: true });
mkdirSync(REPORT_DIR, { recursive: true });

const now = localParts();
const minutesNow = now.hour * 60 + now.minute;

for (const s of SLOTS) {
  const runId = `${now.date}-${s.name}`;
  const marker = join(SLOT_DIR, runId);
  const missed = join(SLOT_DIR, `${runId}.missed`);
  if (existsSync(marker) || existsSync(missed)) continue;
  if (minutesNow < s.start) continue;
  if (minutesNow > s.start + WINDOW_MIN) {
    if (!dry) writeFileSync(missed, `missed ${new Date().toISOString()} (computer asleep or offline)\n`);
    console.log(`MISSED ${runId}`);
    continue;
  }
  const l = launch();
  const type = runType(s, now.weekday, l.on);
  console.log(`DUE ${runId} ${type} (${TZ}${l.on ? ', launch mode' : ''})`);
  if (dry) process.exit(0);
  if (existsSync(LOCK)) {
    console.log(`another run holds ${LOCK}; skipping`);
    process.exit(0);
  }
  writeFileSync(LOCK, String(process.pid));
  writeFileSync(marker, `started ${new Date().toISOString()} ${type}\n`);
  try {
    const cmd = process.env.APIVERSA_AGENT_CMD || 'cursor-agent';
    const extra = (process.env.APIVERSA_AGENT_ARGS || '-p').split(' ').filter(Boolean);
    const r = spawnSync(cmd, [...extra, prompt(type, runId, l.on)], {
      encoding: 'utf8',
      timeout: RUN_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}\nexit=${r.status} signal=${r.signal ?? ''} error=${r.error?.message ?? ''}\n`;
    writeFileSync(join(REPORT_DIR, `${runId}.txt`), out);
    writeFileSync(marker, `started+finished ${new Date().toISOString()} ${type} exit=${r.status}\n`);
    console.log(out.slice(-4000));
  } finally {
    rmSync(LOCK, { force: true });
    pruneReports();
  }
  process.exit(0);
}
console.log(`nothing due at ${now.date} ${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')} ${TZ}`);
