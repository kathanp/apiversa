import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clientSources, writeClientFiles } from '../src/cli/clients.js';
import { runCli } from '../src/cli/main.js';

const older = `class Hotel_2026_01_15:
    city: str
    place: str
    address: Address_2026_01_15
    given: str
    family: str
    active: bool
    score: float
`;

const head = `class Hotel_2026_03_01:
    locality: str
    cities: list
    stars: int
    address: Address_2026_03_01
    title: str
    active: bool
    score: float
`;

describe('CLIENT-05 python client files', () => {
  it('rewinds field names and writes the same class bytes', () => {
    const dir = fixture();
    expect(clientSources(dir, 'python', '2026-11-08').find((file) => file.name === 'Hotel_2026_01_15.py')?.text).toBe(older);
    expect(clientSources(dir, 'python', '2026-11-08').find((file) => file.name === 'Hotel_2026_03_01.py')?.text).toBe(head);
    writeClientFiles(dir, 'python', '2026-11-08');
    expect(readFileSync(join(dir, 'generated/Hotel_2026_01_15.py'), 'utf8')).toBe(older);
    expect(readFileSync(join(dir, 'generated/Hotel_2026_03_01.py'), 'utf8')).toBe(head);
  });

  it('keeps the Java record when the language is omitted', () => {
    const dir = fixture();
    expect(runCli(['node', 'apiversa', 'generate-client', dir])).toBe(0);
    expect(readFileSync(join(dir, 'generated/Hotel_2026_01_15.java'), 'utf8')).toContain('record Hotel_2026_01_15(String city, String place, String address, String given, String family, Boolean active, double score)');
    expect(readdirSync(join(dir, 'generated')).some((name) => name.endsWith('.py'))).toBe(false);
  });

  it('CLIENT-05 refuses calling pip', () => {
    const dir = fixture();
    writeClientFiles(dir, 'python', '2026-11-08');
    expect(readdirSync(join(dir, 'generated')).every((name) => name.endsWith('.py'))).toBe(true);
  });

  it('CLIENT-05 refuses calling the network', () => {
    const dir = fixture();
    const text = clientSources(dir, 'python', '2026-11-08').map((file) => file.text).join('');
    expect(text).toContain('class Hotel_2026_01_15:');
    expect(text).not.toContain('http');
  });
});

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-py-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.reshape.yaml'), `version: "2026-03-01"
id: reshape
description: "Hotel fields moved."
changes:
  - op: field.alias
    schema: Hotel
    from: city
    to: locality
  - op: field.list
    schema: Hotel
    from: place
    to: cities
  - op: field.null
    schema: Hotel
    path: stars
  - op: field.join
    schema: Hotel
    from: title
    left: given
    right: family
    separator: " "
`);
  writeFileSync(join(dir, 'head.json'), JSON.stringify({
    Hotel: [
      { name: 'locality', type: 'string' },
      { name: 'cities', type: 'array' },
      { name: 'stars', type: 'integer' },
      { name: 'address', type: 'Address' },
      { name: 'title', type: 'string' },
      { name: 'active', type: 'boolean' },
      { name: 'score', type: 'number' },
    ],
    Address: [{ name: 'line', type: 'string' }],
  }));
  return dir;
}
