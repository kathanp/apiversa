import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clientsMatch, writeClientFiles } from '../src/cli/clients.js';
import { runCli } from '../src/cli/main.js';

describe('SHR-06 client byte check', () => {
  it('matches the fixture and writes nothing', () => {
    const dir = fixture();
    writeClientFiles(dir, 'python', '2026-11-08');
    writeClientFiles(dir, 'go', '2026-11-08');
    const before = readFileSync(join(dir, 'generated/Hotel_2026_01_15.py'), 'utf8');
    const stamp = statSync(join(dir, 'generated/Hotel_2026_01_15.py')).mtimeMs;
    expect(runCli(['node', 'apiversa', 'clients', '--check', dir])).toBe(0);
    expect(readFileSync(join(dir, 'generated/Hotel_2026_01_15.py'), 'utf8')).toBe(before);
    expect(statSync(join(dir, 'generated/Hotel_2026_01_15.py')).mtimeMs).toBe(stamp);
    expect(clientsMatch(dir, '2026-11-08')).toBe(true);
  });

  it('SHR-06 refuses writing a file', () => {
    const dir = fixture();
    writeClientFiles(dir, 'python', '2026-11-08');
    writeClientFiles(dir, 'go', '2026-11-08');
    const file = join(dir, 'generated/Hotel_2026_01_15.py');
    writeFileSync(file, 'class Hotel_2026_01_15:\n    city: object\n');
    expect(runCli(['node', 'apiversa', 'clients', '--check', dir])).toBe(1);
    expect(readFileSync(file, 'utf8')).toBe('class Hotel_2026_01_15:\n    city: object\n');
  });

  it('SHR-06 refuses calling the network', () => {
    const dir = fixture();
    expect(clientsMatch(dir, '2026-11-08')).toBe(false);
    expect(readFileSync(join(dir, 'versions.yaml'), 'utf8')).toContain('2026-03-01');
  });
});

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-check-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.reshape.yaml'), `version: "2026-03-01"
id: reshape
description: "Hotel fields moved."
changes:
  - op: field.alias
    schema: Hotel
    from: city
    to: locality
`);
  writeFileSync(join(dir, 'head.json'), JSON.stringify({ Hotel: [{ name: 'locality', type: 'string' }] }));
  return dir;
}
