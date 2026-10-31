import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { doctor } from '../src/cli/doctor.js';
import { init } from '../src/cli/init.js';
import { lockFiles } from '../src/cli/lock.js';
import { runCli } from '../src/cli/main.js';

describe('doctor', () => {
  it('is quiet on a fresh bundle and names a fix for each problem', () => {
    const root = mkdtempSync(join(tmpdir(), 'apiversa-doctor-'));
    const dir = init(root);
    expect(doctor(dir)).toEqual([]);
    expect(runCli(['node', 'apiversa', 'doctor', dir])).toBe(0);
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-01-15"\nversions:\n  - date: "2026-01-15"\ndefault: pin-on-first-call\n');
    writeFileSync(
      join(dir, '2026-01-15.draft.yaml'),
      'version: "2026-01-15"\nid: draft-one\ndescription: "Draft."\ndraft: true\nchanges:\n  - op: custom\n    converter: splitFullName\n    schema: Hotel\n',
    );
    writeFileSync(join(dir, 'routes.json'), JSON.stringify([{ path: '/health' }, { path: '/hotels/:id', response: 'Guest' }]));
    lockFiles(dir);
    writeFileSync(join(dir, '2026-01-15.draft.yaml'), `${read()}\n`);
    const problems = doctor(dir);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((problem) => problem.fix.length > 0)).toBe(true);
    expect(problems.some((problem) => problem.message.includes('pin-on-first-call'))).toBe(true);
    expect(problems.some((problem) => problem.message.includes('draft'))).toBe(true);
    expect(problems.some((problem) => problem.message.includes('splitFullName'))).toBe(true);
    expect(problems.some((problem) => problem.message.includes('no declared schema'))).toBe(true);
    expect(problems.some((problem) => problem.message.includes('Hotel'))).toBe(true);
    expect(problems.some((problem) => problem.message.includes('.lock.json'))).toBe(true);
    expect(runCli(['node', 'apiversa', 'doctor', dir])).toBe(1);
  });
});

function read(): string {
  return 'version: "2026-01-15"\nid: draft-one\ndescription: "Draft changed."\ndraft: true\nchanges:\n  - op: custom\n    converter: splitFullName\n    schema: Hotel\n';
}
