import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadBundle } from '../src/bundle/load.js';
import { checkBundle } from '../src/cli/check.js';
import { runCli } from '../src/cli/main.js';

const VERSIONS = `head: "2026-03-01"
versions:
  - date: "2026-03-01"
  - date: "2026-01-15"
default: oldest
`;

describe('breaking-change check', () => {
  it('fails when head gained a field and no new change file explains it', () => {
    const dir = bundle(false);
    const result = checkBundle(dir, { format: 'markdown' });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('Hotel.nickname added');
    expect(runCli(['node', 'apiversa', 'check', dir, '--format', 'markdown'])).toBe(1);
  });

  it('passes when the new head version has a change file and prints the endpoints', () => {
    const dir = bundle(true);
    writeFileSync(join(dir, 'routes.json'), JSON.stringify([{ method: 'GET', path: '/hotels', schema: 'Hotel' }]));
    const result = checkBundle(dir, { format: 'markdown' });
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('## apiversa');
    expect(result.summary).toContain('2026-03-01 add-name');
    expect(result.summary).toContain('GET /hotels');
    expect(runCli(['node', 'apiversa', 'check', dir])).toBe(0);
  });

  it('writes a draft suggestion that startup refuses', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-suggest-'));
    writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
    mkdirSync(join(dir, 'snapshots'));
    writeFileSync(join(dir, 'snapshots/2026-01-15.json'), JSON.stringify({ Hotel: [{ name: 'title', type: 'string' }] }));
    writeFileSync(join(dir, 'head.json'), JSON.stringify({ Hotel: [{ name: 'name', type: 'string' }] }));
    const result = checkBundle(dir, { suggest: true });
    expect(result.ok).toBe(false);
    expect(result.diffs[0]).toMatchObject({ kind: 'renamed', from: 'title', to: 'name' });
    const draft = readFileSync(join(dir, '2026-03-01.suggested.yaml'), 'utf8');
    expect(draft).toContain('draft: true');
    expect(draft).toContain('op: field.rename');
    expect(() => loadBundle(dir, { today: '2026-10-31', registry: { Hotel: {} } })).toThrow(expect.objectContaining({ code: 'AV-E013' }));
    expect(runCli(['node', 'apiversa', 'check', dir, '--suggest'])).toBe(1);
  });

  it('reports a missing head, a type change, and a removed field', () => {
    const empty = mkdtempSync(join(tmpdir(), 'apiversa-check-empty-'));
    expect(checkBundle(empty).summary).toBe('api-versions/head.json is missing.');
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-check-type-'));
    writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
    writeFileSync(join(dir, 'head.json'), JSON.stringify({ Hotel: [{ name: 'stars', type: 'number' }, { name: 'code' }] }));
    expect(checkBundle(dir).summary).toBe('No version changes.');
    mkdirSync(join(dir, 'snapshots'));
    expect(checkBundle(dir).ok).toBe(true);
    writeFileSync(join(dir, 'snapshots/2026-01-15.json'), JSON.stringify({ Hotel: [{ name: 'stars', type: 'string' }, { name: 'old', type: 'string' }, { name: 'legacy', type: 'string' }] }));
    writeFileSync(join(dir, 'routes.json'), JSON.stringify({ not: 'a list' }));
    writeFileSync(join(dir, '2026-03-01.note.yaml'), 'version: "2026-01-15"\nid: note\ndescription: "Older note."\nchanges:\n  - op: endpoint.deprecate\n    method: POST\n    path: /hotels\n');
    const result = checkBundle(dir, { format: 'text', suggest: true });
    expect(result.ok).toBe(false);
    expect(result.diffs.map((diff) => diff.kind).sort()).toEqual(['added', 'removed', 'removed', 'type']);
    expect(result.summary).toContain('POST /hotels');
    expect(result.suggested).toContain('suggested.yaml');
    expect(checkBundle(dir, { suggest: true }).suggested).toContain('suggested.yaml');
  });
});

function bundle(withChange: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-check-'));
  writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
  mkdirSync(join(dir, 'snapshots'));
  writeFileSync(join(dir, 'snapshots/2026-01-15.json'), JSON.stringify({ Hotel: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }] }));
  writeFileSync(join(dir, 'head.json'), JSON.stringify({ Hotel: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'nickname', type: 'string' }] }));
  if (withChange) {
    writeFileSync(
      join(dir, '2026-03-01.add-name.yaml'),
      'version: "2026-03-01"\nid: add-name\ndescription: "Hotel.nickname was added."\nchanges:\n  - op: field.add\n    schema: Hotel\n    path: nickname\n    default: ""\n',
    );
  }
  return dir;
}
