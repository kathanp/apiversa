import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { changelogBundle } from '../../src/cli/changelog.js';
import { schemaFieldsAt } from '../../src/cli/generate.js';
import { snippetBytes, writeSnippets } from '../../src/cli/snippets.js';
import { runCli } from '../../src/cli/main.js';
import { readFileSync } from 'node:fs';
import { buildBundle } from '../../src/bundle/load.js';
import { runOp } from '../helpers.js';

const op = { op: 'field.alias', schema: 'Hotel', from: 'city', to: 'locality' };

describe('field.alias', () => {
  it('accepts either name on the way up and writes the older name on the way down', () => {
    expect(runOp(op, { city: 'Paris' }, 'up')).toEqual({ locality: 'Paris' });
    expect(runOp(op, { locality: 'Paris' }, 'up')).toEqual({ locality: 'Paris' });
    expect(runOp(op, { city: null }, 'up')).toEqual({ locality: null });
    expect(runOp(op, {}, 'up')).toEqual({});
    expect(runOp(op, { locality: 'Paris' }, 'down')).toEqual({ city: 'Paris' });
    expect(runOp(op, { city: 'Paris', locality: 'Lyon' }, 'down')).toEqual({ city: 'Paris' });
    expect(() => runOp(op, { city: 'Paris', locality: 'Lyon' }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E018', status: 400, message: 'Both alias names are present.' }));
  });

  it('shows the older name before the change and both names in the changelog', () => {
    const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = { version: '2026-03-01', id: 'alias-city', description: 'city became locality.', changes: [op] };
    const bundle = buildBundle(versions, [change], { today: '2026-11-07', registry: { Hotel: {} } });
    expect(schemaFieldsAt({ Hotel: [{ name: 'locality', type: 'string' }] }, bundle, '2026-01-15').Hotel?.map((field) => field.name)).toEqual(['city']);
    expect(schemaFieldsAt({ Hotel: [{ name: 'locality', type: 'string' }] }, bundle, '2026-03-01').Hotel?.map((field) => field.name)).toEqual(['locality']);
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-alias-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.alias.yaml'), 'version: "2026-03-01"\nid: alias-city\ndescription: "city became locality."\nchanges:\n  - op: field.alias\n    schema: Hotel\n    from: city\n    to: locality\n');
    expect(changelogBundle(dir).markdown).toContain('city became locality. (city, locality)');
    const root = mkdtempSync(join(tmpdir(), 'apiversa-snippets-'));
    const written = writeSnippets(root, '2026-01-15');
    expect(readFileSync(written[0]!, 'utf8')).toBe(snippetBytes('2026-01-15').curl);
    expect(readFileSync(written[1]!, 'utf8')).toBe('await fetch("https://api.example.test/hotels", { headers: { "Api-Version": "2026-01-15" } });\n');
    expect(readFileSync(written[2]!, 'utf8')).toBe(snippetBytes('2026-01-15').java);
    expect(snippetBytes('2026-03-01', 'X-Version').curl).toBe('curl -H "X-Version: 2026-03-01" https://api.example.test/hotels\n');
    expect(runCli(['node', 'apiversa', 'snippets', '--version', '2026-01-15'], root)).toBe(0);
  });
});
