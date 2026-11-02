import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiversa } from '../node/packages/core/dist/create.js';

const dir = mkdtempSync(join(tmpdir(), 'apiversa-bench-'));
const dates = ['2026-03-01'];
for (let index = 1; index < 50; index += 1) {
  const day = new Date(Date.UTC(2026, 2, 1));
  day.setUTCDate(day.getUTCDate() - index);
  dates.push(day.toISOString().slice(0, 10));
}
writeFileSync(join(dir, 'versions.yaml'), `head: "2026-03-01"\nversions:\n${dates.map((date) => `  - date: "${date}"`).join('\n')}\ndefault: oldest\n`);
const body = JSON.stringify({ locality: 'Paris', notes: 'x'.repeat(10_000) });
writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
for (let index = 1; index < 50; index += 1) {
  const date = dates[index];
  writeFileSync(join(dir, `${date}.pad.yaml`), `version: "${date}"\nid: pad\ndescription: "padding."\nchanges:\n  - op: field.add\n    schema: Hotel\n    path: pad${index}\n    default: 0\n`);
}

const started = performance.now();
const av = createApiversa({ dir, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false, now: '2026-10-31' });
const startup = performance.now() - started;

function p50(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

const head = [];
for (let index = 0; index < 200; index += 1) {
  const mark = performance.now();
  av.resolveVersion({ headers: { 'Api-Version': '2026-03-01' } });
  head.push((performance.now() - mark) * 1000);
}
const one = [];
for (let index = 0; index < 50; index += 1) {
  const mark = performance.now();
  av.convertResponse({ schema: 'Hotel', body, version: dates[1] });
  one.push((performance.now() - mark) * 1000);
}
const result = {
  date: '2026-11-01',
  node: process.version,
  machine: `${process.platform} ${process.arch}`,
  cases: {
    'Head-version request overhead': { p50Us: p50(head) },
    'One change, 10 KB JSON downgrade': { p50Us: p50(one) },
    'Startup with 50 change files': { p50Ms: startup },
  },
};
const outDir = new URL('./results/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const file = new URL('./results/2026-11-01.json', import.meta.url);
writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`wrote ${file.pathname}\n${JSON.stringify(result.cases)}\n`);
