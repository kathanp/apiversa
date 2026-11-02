#!/usr/bin/env node
// scripts/guard.mjs — mechanical gates for docs/AUTOPILOT.md (apiversa). No dependencies.
// It never pushes, publishes, tags, logs in, or calls the network.
//
//   --gate-fast [--base <ref>]                     protected + tests + commits
//   --verify-protected [--against <ref>]           protected files equal the last release tag
//   --verify-tests [--base <ref>]                  tests append-only, banned patterns, secret literals
//   --verify-commits [--base <ref>]                commit subject format
//   --verify-docs                                  ARCHITECTURE version + paths, BENCHMARKS sources
//   --verify-roadmap                               roadmap IDs defined, evidence, no scope creep in history
//   --verify-release --track <t> --version <v> [--hotfix] [--today YYYY-MM-DD]
//   --approve --file <path> --verdict <json>       record a judge PASS for a file's current content
//   --verify-approval --file <path>
//   --history-add --track <t> --version <v> --stranger <json> [--today YYYY-MM-DD]
//   --launch-status [--today YYYY-MM-DD]          JSON per track: in launch mode?, days left, cooldown
//   --install-hooks | --commit-msg <file>
//
// Several --verify-* flags may be combined in one call.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : d;
};
const errors = [];
const warnings = [];
const die = (m) => {
  console.error(`guard: ${m}`);
  process.exit(2);
};

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (...a) => {
  try {
    git(...a);
    return true;
  } catch {
    return false;
  }
};
const lines = (s) => s.split('\n').filter(Boolean);
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const sha = (s) => createHash('sha256').update(s).digest('hex');

const CFG_PATH = 'guard.config.json';
if (!existsSync(CFG_PATH)) die(`missing ${CFG_PATH}`);
const CFG = JSON.parse(readFileSync(CFG_PATH, 'utf8'));
const STATE = '.autopilot';

// ------------------------------------------------------------------ globs
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const segRe = (p) => p.split('*').map(esc).join('[^/]*');
const globRe = (g) =>
  new RegExp('^' + g.split('**/').map((part) => part.split('**').map(segRe).join('.*')).join('(?:.*/)?') + '$');
const inAny = (f, globs) => globs.some((g) => globRe(g).test(f));
const isTest = (f) => inAny(f, CFG.tests);

// ------------------------------------------------------------------ semver
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const parseV = (v) => {
  const m = SEMVER.exec(v ?? '');
  return m ? m.slice(1).map(Number) : null;
};
const cmpV = (a, b) => {
  const x = parseV(a);
  const y = parseV(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

// ------------------------------------------------------------------ refs
function lastReleaseTag() {
  const prefixes = Object.values(CFG.tracks).map((t) => `${t.tagPrefix}*`);
  try {
    return lines(git('tag', '--list', ...prefixes, '--sort=-creatordate'))[0] ?? null;
  } catch {
    return null;
  }
}
function defaultBase() {
  for (const r of ['origin/next', 'next']) if (gitOk('rev-parse', '--verify', '--quiet', r)) return r;
  return null;
}

// ------------------------------------------------------------------ protected
function verifyProtected() {
  let ref = opt('--against') ?? lastReleaseTag();
  if (!ref && gitOk('rev-parse', '--verify', '--quiet', 'origin/main')) ref = 'origin/main';
  if (!ref) {
    warnings.push('no release tag or origin/main yet; protected-file check skipped');
    return;
  }
  const files = lines(git('ls-files')).filter((f) => inAny(f, CFG.protected));
  const atRef = new Set(lines(git('ls-tree', '-r', '--name-only', ref)).filter((f) => inAny(f, CFG.protected)));
  for (const f of files) {
    if (!atRef.has(f)) {
      errors.push(`HS-PROTECTED new file in a protected path since ${ref}: ${f}`);
      continue;
    }
    const before = git('show', `${ref}:${f}`);
    const now = readFileSync(f, 'utf8').replace(/\n$/, '');
    if (before !== now) errors.push(`HS-PROTECTED ${f} differs from ${ref}`);
  }
  for (const f of atRef) if (!existsSync(f)) errors.push(`HS-PROTECTED ${f} deleted since ${ref}`);
}

// ------------------------------------------------------------------ tests
const BANNED = [
  [/\bDate\.now\s*\(/, 'Date.now()'],
  [/\bnew Date\(\s*\)/, 'new Date() with no argument'],
  [/\bMath\.random\s*\(/, 'Math.random()'],
  [/\bSystem\.currentTimeMillis\s*\(/, 'System.currentTimeMillis()'],
  [/\bnew Random\(\s*\)/, 'unseeded new Random()'],
  [/\.(only|skip)\s*\(/, '.only/.skip'],
  [/\b(it|test)\.todo\s*\(/, 'todo test'],
  [/\b(xit|xdescribe|xtest)\s*\(/, 'xit/xdescribe'],
];
const SECRETS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS key literal'],
  [/sk_live_[0-9a-zA-Z]{16,}/, 'Stripe live key literal'],
  [/gh[pousr]_[A-Za-z0-9]{36}/, 'GitHub token literal'],
  [/npm_[A-Za-z0-9]{36}/, 'npm token literal'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key literal'],
];
function verifyTests() {
  const base = opt('--base') ?? defaultBase();
  if (!base) {
    warnings.push('no base ref (origin/next or next); test checks skipped');
    return;
  }
  const status = lines(git('diff', '--name-status', `${base}...HEAD`)).map((l) => {
    const [s, ...rest] = l.split('\t');
    return { s: s[0], f: rest[rest.length - 1], from: rest[0] };
  });
  for (const { s, f, from } of status) {
    if (s === 'D' && isTest(f)) errors.push(`HS-TEST-EDIT test or fixture deleted: ${f}`);
    if (s === 'R' && isTest(from)) errors.push(`HS-TEST-EDIT test or fixture renamed: ${from} -> ${f}`);
    if (s === 'M' && isTest(f)) {
      const removed = lines(git('diff', '-U0', `${base}...HEAD`, '--', f)).filter((l) => l.startsWith('-') && !l.startsWith('---'));
      if (removed.length) errors.push(`HS-TEST-EDIT ${removed.length} line(s) removed or changed in ${f}`);
    }
  }
  for (const { s, f } of status.filter((x) => x.s !== 'D' && isTest(x.f) && existsSync(x.f))) {
    const added = lines(git('diff', '-U0', `${base}...HEAD`, '--', f))
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1));
    const fixture = f.startsWith('conformance/');
    added.forEach((l, i) => {
      if (!fixture) for (const [re, name] of BANNED) if (re.test(l)) errors.push(`${name} in ${f}: ${l.trim().slice(0, 80)}`);
      for (const [re, name] of SECRETS) if (re.test(l)) errors.push(`HS-SECRET ${name} in ${f} (build fakes by concatenation)`);
      if (/@Disabled\b/.test(l) && !/\/\/|\/\*/.test(added[i - 1] ?? '')) errors.push(`@Disabled without a reason comment in ${f}`);
    });
    if (s === 'A' && /\.(test|spec)\.[cm]?[jt]s$/.test(f) && !/\bexpect\s*\(|\bassert/.test(readFileSync(f, 'utf8')))
      errors.push(`${f}: new test file with no expect( or assert`);
  }
}

// ------------------------------------------------------------------ commits
const SUBJECT = /^(feat|fix|test|docs|perf|chore|release|history)\((node|spring|shared)\): \S/;
const AGENT_TRAILER = /^Co-authored-by:.*\b(cursor|agent|bot|claude)\b.*$/gim;
function verifyCommits() {
  const base = opt('--base') ?? defaultBase();
  if (!base) return;
  for (const l of lines(git('log', '--no-merges', '--format=%h%x09%s', `${base}..HEAD`))) {
    const [h, s] = l.split('\t');
    if (!SUBJECT.test(s)) errors.push(`${h} subject "${s}" does not match <type>(<track>): <summary>`);
  }
}

// ------------------------------------------------------------------ roadmap and history
function parseRoadmap(text) {
  const out = new Map(); // "node 0.1.0" -> [{id, evidence, line}]
  if (!text) return out;
  const start = text.search(/^# PART H\b/m);
  if (start < 0) return out;
  let cur = null;
  for (const line of text.slice(start).split('\n')) {
    const h = /^###\s+(node|spring)\s+(\d+\.\d+\.\d+)\s*$/.exec(line);
    if (h) {
      cur = `${h[1]} ${h[2]}`;
      out.set(cur, []);
      continue;
    }
    const item = /^-\s+\*\*([A-Z]+-\d{2})\*\*.*?(?:Evidence:\s*(\S+))?\s*$/.exec(line);
    if (cur && item) out.get(cur).push({ id: item[1], evidence: item[2] ?? null, line: line.trim() });
  }
  return out;
}
function definedIds(text) {
  return new Set([...(text ?? '').matchAll(/^####\s+([A-Z]+-\d{2})\b/gm)].map((m) => m[1]));
}
function parseHistory(text) {
  const out = [];
  if (!text) return out;
  const re = /^##\s+(node|spring)\s+(\d+\.\d+\.\d+)\s+—\s+(\d{4}-\d{2}-\d{2})\s+—\s+(shipped|failed)\s*$/gm;
  let m;
  while ((m = re.exec(text))) {
    const body = text.slice(m.index + m[0].length).split(/^##\s/m)[0];
    const feats = /^-\s+Features:\s*(.*)$/m.exec(body)?.[1] ?? '';
    out.push({
      track: m[1],
      version: m[2],
      date: m[3],
      status: m[4],
      features: [...feats.matchAll(/\b([A-Z]+-\d{2})\b/g)].map((x) => x[1]),
    });
  }
  return out;
}
const BASE_EVIDENCE = new Set(['cadwyn', 'stripe', 'spring7-gap', 'rfc', 'safety', 'adoption']);
const LATE_EVIDENCE = /^(issue:https?:\/\/\S+|eval:\S+|bug:\S+)$/;

function verifyRoadmap() {
  const spec = read(CFG.spec);
  if (!spec) return errors.push(`missing ${CFG.spec}`);
  const roadmap = parseRoadmap(spec);
  if (!roadmap.size) return errors.push(`${CFG.spec}: no "# PART H" roadmap found`);
  const defined = definedIds(spec);

  const baseTag = CFG.roadmapBaselineTag;
  let baseline = null;
  if (baseTag && gitOk('rev-parse', '--verify', '--quiet', baseTag)) baseline = parseRoadmap(git('show', `${baseTag}:${CFG.spec}`));
  else warnings.push(`roadmap baseline tag "${baseTag}" not found; late-evidence and scope-cap checks skipped`);
  const baselineIds = new Map();
  if (baseline)
    for (const [k, items] of baseline) {
      const track = k.split(' ')[0];
      if (!baselineIds.has(track)) baselineIds.set(track, new Set());
      for (const it of items) baselineIds.get(track).add(it.id);
    }

  for (const [k, items] of roadmap) {
    const track = k.split(' ')[0];
    let added = 0;
    for (const it of items) {
      if (!defined.has(it.id)) errors.push(`roadmap ${k}: ${it.id} has no "#### ${it.id}" section in the spec`);
      if (!it.evidence) {
        errors.push(`roadmap ${k}: ${it.id} has no Evidence:`);
        continue;
      }
      const isNew = baseline && !baselineIds.get(track)?.has(it.id);
      if (isNew) {
        added++;
        if (!LATE_EVIDENCE.test(it.evidence)) errors.push(`roadmap ${k}: ${it.id} was added after the baseline and needs Evidence issue:<url>, eval:<file> or bug:<test>`);
      } else if (!BASE_EVIDENCE.has(it.evidence) && !LATE_EVIDENCE.test(it.evidence)) {
        errors.push(`roadmap ${k}: ${it.id} has unknown evidence "${it.evidence}"`);
      }
    }
    if (added > 3) errors.push(`roadmap ${k}: ${added} IDs added after the baseline (max 3, rule H0.3)`);
  }

  const history = parseHistory(read(CFG.history));
  const lastByTrack = new Map();
  for (const e of [...history].reverse()) {
    const items = roadmap.get(`${e.track} ${e.version}`);
    if (!items && e.status === 'shipped' && !isHotfixOf(e, history))
      errors.push(`history ${e.track} ${e.version}: no roadmap section for this version`);
    if (items && e.status === 'shipped') {
      const earlier = history.some((h) => h !== e && h.track === e.track && h.status === 'shipped' && (h.date < e.date || (h.date === e.date && cmpV(h.version, e.version) < 0)));
      const allowed = new Set(earlier
        ? items.map((i) => i.id)
        : [...roadmap.entries()].filter(([k]) => k.startsWith(`${e.track} `)).flatMap(([, its]) => its.map((i) => i.id)));
      for (const f of e.features) if (!allowed.has(f)) errors.push(`history ${e.track} ${e.version}: ${f} is not in that version's roadmap (scope creep)`);
    }
    const prev = lastByTrack.get(e.track);
    if (prev && e.status === 'shipped' && cmpV(e.version, prev.version) <= 0)
      errors.push(`history ${e.track}: ${e.version} is not above the earlier ${prev.version}`);
    if (e.status === 'shipped') lastByTrack.set(e.track, e);
  }
}
function isHotfixOf(e, history) {
  const [ma, mi, pa] = parseV(e.version);
  return pa > 0 && history.some((h) => h.track === e.track && h.status === 'shipped' && h.version === `${ma}.${mi}.0`);
}

// ------------------------------------------------------------------ docs
function trackVersion(track) {
  const t = CFG.tracks[track];
  const text = read(t.versionFile);
  if (text === null) return null;
  if (t.versionFile.endsWith('.json')) return JSON.parse(text).version ?? null;
  return /<revision>([^<]+)<\/revision>/.exec(text)?.[1] ?? null;
}
function verifyDocs() {
  const arch = read(CFG.architecture);
  if (!arch) errors.push(`missing ${CFG.architecture}`);
  else {
    for (const track of Object.keys(CFG.tracks)) {
      const v = trackVersion(track);
      if (v && !new RegExp(`\\b${track} ${esc(v)}(?![\\w.])`).test(arch)) errors.push(`${CFG.architecture} does not state "${track} ${v}" (current ${CFG.tracks[track].versionFile})`);
    }
    for (const row of arch.split('\n').filter((l) => /^\|\s*`[^`]+`\s*\|/.test(l))) {
      const p = /^\|\s*`([^`]+)`/.exec(row)[1];
      if (/[*<]/.test(p) || /\(planned\)/i.test(row)) continue;
      if (!existsSync(p.replace(/\/$/, ''))) errors.push(`${CFG.architecture} layout row names a path that does not exist: ${p} (mark it "(planned)")`);
    }
  }
  const bench = read(CFG.benchmarks);
  if (bench)
    for (const row of bench.split('\n').filter((l) => l.startsWith('|'))) {
      const measured = row.split('|').slice(1, -1)[CFG.benchMeasuredColumn ?? 2] ?? '';
      if (!/\d+(\.\d+)?\s*(µs|us|ms|s)\b/.test(measured)) continue;
      const src = /`?(bench\/results\/[^`|\s]+\.json)`?/.exec(row)?.[1];
      if (!src) errors.push(`${CFG.benchmarks}: measured number with no bench/results/*.json source: ${row.trim().slice(0, 90)}`);
      else if (!existsSync(src)) errors.push(`${CFG.benchmarks}: source ${src} does not exist`);
    }
}

// ------------------------------------------------------------------ release
function today() {
  const t = opt('--today');
  if (t) return t;
  return new Intl.DateTimeFormat('en-CA', { timeZone: CFG.timeZone ?? 'America/Chicago' }).format(new Date());
}
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);
function changelogSection(track, version) {
  const cl = read(CFG.changelog) ?? '';
  const re = new RegExp(`^##\\s+${track}\\s+${esc(version)}\\b.*$`, 'm');
  const m = re.exec(cl);
  if (!m) return null;
  return cl.slice(m.index + m[0].length).split(/^##\s/m)[0];
}
// Launch mode: for the first `launch.days` days after a track's first stable release (and before it),
// the cooldown is `launch.cooldownDays` (default 1: at most one stable a day). After that, `cooldownDays`.
function launchState(track) {
  const L = CFG.launch ?? { days: 0, cooldownDays: CFG.cooldownDays ?? 7 };
  const shipped = parseHistory(read(CFG.history))
    .filter((h) => h.track === track && h.status === 'shipped')
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = shipped[0] ?? null;
  const age = first ? days(first.date, today()) : 0;
  const inLaunch = !first || age < L.days;
  return {
    inLaunch,
    daysLeft: inLaunch ? L.days - age : 0,
    cooldown: inLaunch ? L.cooldownDays : CFG.cooldownDays ?? 7,
    firstRelease: first?.date ?? null,
  };
}
function launchStatus() {
  const out = {};
  for (const t of Object.keys(CFG.tracks)) out[t] = launchState(t);
  console.log(JSON.stringify(out));
  process.exit(0);
}

function verifyRelease() {
  const track = opt('--track');
  const version = opt('--version');
  const hotfix = flag('--hotfix');
  if (!CFG.tracks[track]) return errors.push(`--track must be one of ${Object.keys(CFG.tracks).join(', ')}`);
  if (!parseV(version)) return errors.push(`--version must be x.y.z, got "${version}"`);
  const fileV = trackVersion(track);
  if (fileV && fileV !== version) errors.push(`${CFG.tracks[track].versionFile} is ${fileV}; release asks for ${version}`);
  const history = parseHistory(read(CFG.history)).filter((h) => h.track === track && h.status === 'shipped');
  const last = history.sort((a, b) => cmpV(b.version, a.version))[0] ?? null;
  const [ma, mi, pa] = parseV(version);
  if (ma >= 1 && (!last || parseV(last.version)[0] < ma)) errors.push(`HS-MAJOR ${track} ${version} is a major release; prepare it and stop`);
  if (last && cmpV(version, last.version) <= 0) errors.push(`${version} is not above the last shipped ${last.version}`);
  if (hotfix) {
    if (!last) errors.push('--hotfix needs an earlier shipped version');
    else {
      const [la, li, lp] = parseV(last.version);
      if (la !== ma || li !== mi || pa !== lp + 1) errors.push(`hotfix must be ${la}.${li}.${lp + 1}, got ${version}`);
    }
  } else {
    if (last) {
      const gap = days(last.date, today());
      const { cooldown, inLaunch } = launchState(track);
      if (gap < cooldown) errors.push(`cooldown: last ${track} release ${last.version} was ${gap} day(s) ago (min ${cooldown}${inLaunch ? ', launch mode' : ''})`);
    }
    const items = parseRoadmap(read(CFG.spec)).get(`${track} ${version}`);
    if (!items) errors.push(`no roadmap section "### ${track} ${version}"`);
    const section = changelogSection(track, version);
    if (section === null) errors.push(`${CFG.changelog} has no "## ${track} ${version}" section`);
    else if (items) for (const it of items) if (!new RegExp(`\\b${it.id}\\b`).test(section)) errors.push(`${it.id} (roadmap ${track} ${version}) is not done: missing from ${CFG.changelog}`);
  }
  const tag = `${CFG.tracks[track].tagPrefix}${version}`;
  if (gitOk('rev-parse', '--verify', '--quiet', `refs/tags/${tag}`)) errors.push(`tag ${tag} already exists; never reuse a version`);
  verifyProtected();
}

// ------------------------------------------------------------------ judge approval
function approve() {
  const file = opt('--file') ?? die('--file is required');
  const verdictPath = opt('--verdict') ?? die('--verdict is required');
  const raw = read(verdictPath) ?? die(`missing ${verdictPath}`);
  let v;
  try {
    v = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch {
    die(`${verdictPath} is not JSON`);
  }
  if (v.verdict !== 'PASS') die(`judge verdict is ${v.verdict ?? 'missing'}; not approved`);
  const content = read(file) ?? die(`missing ${file}`);
  mkdirSync(STATE, { recursive: true });
  const p = join(STATE, 'approvals.json');
  const all = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  all[file] = { sha: sha(content), at: new Date().toISOString(), ids: (v.ids ?? []).filter((x) => x.verdict === 'PASS').map((x) => x.id) };
  writeFileSync(p, JSON.stringify(all, null, 2) + '\n');
  console.log(`guard: ${file} approved by judge (${all[file].ids.join(', ') || 'no ids listed'})`);
  process.exit(0);
}
function verifyApproval() {
  const file = opt('--file') ?? die('--file is required');
  const p = join(STATE, 'approvals.json');
  const a = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8'))[file] : null;
  if (!a) return errors.push(`${file} has no judge approval in this run`);
  if (a.sha !== sha(read(file) ?? '')) errors.push(`${file} changed after the judge approved it; judge it again`);
}

// ------------------------------------------------------------------ history entry
function historyAdd() {
  const track = opt('--track');
  const version = opt('--version');
  const sPath = opt('--stranger') ?? die('--stranger <json> is required');
  if (!CFG.tracks[track] || !parseV(version)) die('--track and --version x.y.z are required');
  const s = JSON.parse(read(sPath) ?? die(`missing ${sPath}`));
  if (s.version !== version) die(`stranger result is for ${s.version}, not ${version}`);
  const text = read(CFG.history) ?? die(`missing ${CFG.history}`);
  const existing = parseHistory(text).find((h) => h.track === track && h.version === version && h.status === 'shipped');
  if (existing) die(`${track} ${version} is already recorded as shipped`);
  const section = changelogSection(track, version) ?? '';
  const feats = [...new Set([...section.matchAll(/\b([A-Z]+-\d{2})\b/g)].map((m) => m[1]))];
  const status = s.pass === true ? 'shipped' : 'failed';
  const entry = [
    `## ${track} ${version} — ${today()} — ${status}`,
    `- Package: ${s.package ?? 'unknown'}@${version}`,
    `- Features: ${status === 'shipped' ? feats.join(', ') || 'none (hotfix)' : 'none counted (failed release)'}`,
    `- Stranger check: ${s.pass === true ? 'pass' : 'FAIL'} (${s.checkedAt ?? 'time unknown'})`,
    s.notes ? `- Notes: ${String(s.notes).slice(0, 300)}` : null,
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
  const marker = '<!-- entries: newest first -->';
  if (!text.includes(marker)) die(`${CFG.history} lacks the marker line ${marker}`);
  writeFileSync(CFG.history, text.replace(marker, `${marker}\n\n${entry}`));
  console.log(`guard: recorded ${track} ${version} as ${status}`);
  process.exit(0);
}

// ------------------------------------------------------------------ hooks
function installHooks() {
  const dir = git('rev-parse', '--git-path', 'hooks');
  mkdirSync(dir, { recursive: true });
  const hooks = {
    'commit-msg': `#!/bin/sh\nexec node "$(git rev-parse --show-toplevel)/scripts/guard.mjs" --commit-msg "$1"\n`,
    'pre-push': `#!/bin/sh\nexec node "$(git rev-parse --show-toplevel)/scripts/guard.mjs" --gate-fast\n`,
  };
  for (const [name, body] of Object.entries(hooks)) {
    const p = join(dir, name);
    if (existsSync(p) && !readFileSync(p, 'utf8').includes('scripts/guard.mjs')) die(`${p} exists and is not the guard's hook; merge by hand`);
    writeFileSync(p, body);
    chmodSync(p, 0o755);
  }
  console.log(`guard: installed commit-msg and pre-push hooks in ${dir}`);
  process.exit(0);
}
function commitMsg() {
  const file = opt('--commit-msg');
  const msg = readFileSync(file, 'utf8');
  const stripped = msg.replace(AGENT_TRAILER, '');
  if (stripped !== msg) writeFileSync(file, stripped);
  const subject = stripped.split('\n')[0].trim();
  if (/^Merge /.test(subject)) process.exit(0);
  if (!SUBJECT.test(subject)) {
    console.error(`guard: commit rejected: "${subject}" does not match <feat|fix|test|docs|perf|chore|release|history>(<node|spring|shared>): <summary>`);
    process.exit(1);
  }
  process.exit(0);
}

// ------------------------------------------------------------------ dispatch
if (flag('--install-hooks')) installHooks();
if (flag('--commit-msg')) commitMsg();
if (flag('--approve')) approve();
if (flag('--history-add')) historyAdd();
if (flag('--launch-status')) launchStatus();

let ran = false;
const run = (f, fn) => {
  if (flag(f)) {
    ran = true;
    fn();
  }
};
run('--gate-fast', () => {
  verifyProtected();
  verifyTests();
  verifyCommits();
});
if (!flag('--gate-fast')) {
  run('--verify-protected', verifyProtected);
  run('--verify-tests', verifyTests);
  run('--verify-commits', verifyCommits);
}
run('--verify-docs', verifyDocs);
run('--verify-roadmap', verifyRoadmap);
run('--verify-release', verifyRelease);
run('--verify-approval', verifyApproval);
if (!ran) die('unknown command; see the header of scripts/guard.mjs');

for (const w of warnings) console.warn(`guard: warning: ${w}`);
if (errors.length) {
  console.error(`guard: FAIL (${errors.length})\n  - ` + errors.join('\n  - '));
  process.exit(1);
}
console.log('guard: OK');
