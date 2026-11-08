import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli/main.js';

describe('SHR-07 bundle diff', () => {
  it('lists a date on one side and a renamed change file', () => {
    const left = side('2026-04-01', '2026-03-01.old.yaml', 'old-name');
    const right = side('2026-02-01', '2026-03-01.new.yaml', 'new-name');
    const out = join(left, 'bundle-diff.json');
    const before = readdirSync(right).sort();
    expect(runCli(['node', 'apiversa', 'bundle-diff', '--left', left, '--right', right, '--out', out])).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe('{"onlyLeft":["2026-04-01"],"onlyRight":["2026-02-01"],"changed":["2026-03-01.new.yaml","2026-03-01.old.yaml"]}\n');
    expect(readdirSync(right).sort()).toEqual(before);
  });

  it('SHR-07 refuses copying either directory', () => {
    const left = side('2026-04-01', '2026-03-01.old.yaml', 'old-name');
    const right = side('2026-02-01', '2026-03-01.new.yaml', 'new-name');
    const out = join(mkdtempSync(join(tmpdir(), 'apiversa-diff-out-')), 'bundle-diff.json');
    expect(runCli(['node', 'apiversa', 'bundle-diff', '--left', left, '--right', right, '--out', out])).toBe(0);
    expect(readdirSync(left).some((name) => name === '2026-03-01.new.yaml')).toBe(false);
    expect(readdirSync(right).some((name) => name === '2026-03-01.old.yaml')).toBe(false);
  });

  it('SHR-07 refuses calling the network', () => {
    const left = mkdtempSync(join(tmpdir(), 'apiversa-bad-'));
    writeFileSync(join(left, 'versions.yaml'), 'not: [\n');
    const right = side('2026-02-01', '2026-03-01.new.yaml', 'new-name');
    const out = join(right, 'bundle-diff.json');
    writeFileSync(out, 'stale\n');
    expect(runCli(['node', 'apiversa', 'bundle-diff', '--left', left, '--right', right, '--out', out])).toBe(1);
    expect(existsSync(out)).toBe(false);
  });
});

function side(extra: string, renamed: string, renamedBody: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-diff-'));
  const dates = ['2026-03-01', extra].sort().reverse();
  writeFileSync(join(dir, 'versions.yaml'), `head: "${dates[0]}"\nversions:\n  - date: "${dates[0]}"\n  - date: "${dates[1]}"\ndefault: oldest\n`);
  writeFileSync(join(dir, '2026-03-01.alias.yaml'), 'version: "2026-03-01"\nid: alias-city\ndescription: "city became locality."\nchanges:\n  - op: field.alias\n    schema: Hotel\n    from: city\n    to: locality\n');
  writeFileSync(join(dir, renamed), `version: "2026-03-01"\nid: ${renamedBody}\ndescription: "${renamedBody} file."\nchanges:\n  - op: field.alias\n    schema: Hotel\n    from: city\n    to: locality\n`);
  return dir;
}
