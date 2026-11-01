import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { testBundle } from '../src/cli/contract.js';
import { runCli } from '../src/cli/main.js';

const VERSIONS = `head: "2026-03-01"
versions:
  - date: "2026-03-01"
  - date: "2026-01-15"
default: oldest
`;

describe('contract fixtures and change coverage', () => {
  it('replays a head fixture through the older version and requires every change', () => {
    const dir = scaffold(true);
    const result = testBundle(dir);
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('change coverage 2/2');
    expect(runCli(['node', 'apiversa', 'test', dir])).toBe(0);
  });

  it('fails on a snapshot mismatch, a missing snapshot, and an uncovered change', () => {
    const dir = scaffold(false);
    const mismatch = testBundle(dir);
    expect(mismatch.ok).toBe(false);
    expect(mismatch.summary).toContain('response does not match the snapshot');
    expect(mismatch.summary).toContain('uncovered 2026-03-01.note-rename');
    expect(runCli(['node', 'apiversa', 'test', dir])).toBe(1);
    writeFileSync(join(dir, 'fixtures/hotel.json'), JSON.stringify({
      schema: 'Hotel',
      request: { locality: 'Paris' },
      response: { locality: 'Paris' },
      exercises: ['2026-03-01.add-route'],
    }));
    const missing = testBundle(dir);
    expect(missing.ok).toBe(false);
    expect(missing.summary).toContain('hotel 2026-01-15: missing snapshot');
  });
});

function scaffold(match: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-contract-'));
  writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), `version: "2026-03-01"
id: rename
description: Hotel.city renamed to locality.
changes:
  - op: field.rename
    schema: Hotel
    from: city
    to: locality
  - op: endpoint.add
    method: GET
    path: /hotels
`);
  writeFileSync(join(dir, '2026-03-01.note.yaml'), `version: "2026-03-01"
id: note-rename
description: Note.body renamed to text.
changes:
  - op: field.rename
    schema: Note
    from: body
    to: text
`);
  mkdirSync(join(dir, 'fixtures'));
  writeFileSync(join(dir, 'fixtures/hotel.json'), JSON.stringify({
    schema: 'Hotel',
    request: { locality: 'Paris' },
    response: { locality: 'Paris' },
    exercises: match ? ['2026-03-01.note-rename'] : [],
    snapshots: { '2026-01-15': { request: { city: 'Paris' }, response: match ? { city: 'Paris' } : { city: 'Lyon' } } },
  }));
  return dir;
}
