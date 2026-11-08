import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli/main.js';

const expected = '{"interactions":[{"version":"2026-01-15","schema":"Hotel","request":{"body":{"locality":"Paris"}},"response":{"body":{"city":"Paris"}}}]}\n';

describe('TEST-09 pact file', () => {
  it('upgrades the request and downgrades the response', () => {
    const dir = bundle();
    const input = join(dir, 'pact.json');
    const out = join(dir, 'pact-result.json');
    writeFileSync(input, '{"interactions":[{"version":"2026-01-15","schema":"Hotel","request":{"body":{"city":"Paris"}},"response":{"body":{"locality":"Paris"}}}]}\n');
    expect(runCli(['node', 'apiversa', 'pact', '--in', input, '--out', out, dir])).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(expected);
  });

  it('exits 0 and writes nothing when the input is missing', () => {
    const dir = bundle();
    const out = join(dir, 'pact-result.json');
    expect(runCli(['node', 'apiversa', 'pact', '--in', join(dir, 'missing.json'), '--out', out, dir])).toBe(0);
    expect(existsSync(out)).toBe(false);
  });

  it('TEST-09 refuses calling the provider', () => {
    const dir = bundle();
    const input = join(dir, 'pact.json');
    const out = join(dir, 'pact-result.json');
    writeFileSync(input, '{"interactions":[{"version":"2026-02-01","schema":"Hotel","request":{"body":{}},"response":{"body":{}}}]}\n');
    expect(runCli(['node', 'apiversa', 'pact', '--in', input, '--out', out, dir])).toBe(1);
    expect(existsSync(out)).toBe(false);
  });

  it('TEST-09 refuses inventing an interaction', () => {
    const dir = bundle();
    const input = join(dir, 'pact.json');
    const out = join(dir, 'pact-result.json');
    writeFileSync(input, '{"interactions":[{"version":"2026-01-15","schema":"Hotel","request":{"body":{"city":"Paris"}},"response":{"body":{"locality":"Paris"}}}]}\n');
    expect(runCli(['node', 'apiversa', 'pact', '--in', input, '--out', out, dir])).toBe(0);
    const parsed = JSON.parse(readFileSync(out, 'utf8')) as { interactions: unknown[] };
    expect(parsed.interactions).toHaveLength(1);
  });
});

function bundle(): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-pact-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.alias.yaml'), 'version: "2026-03-01"\nid: alias-city\ndescription: "city became locality."\nchanges:\n  - op: field.alias\n    schema: Hotel\n    from: city\n    to: locality\n');
  return dir;
}
