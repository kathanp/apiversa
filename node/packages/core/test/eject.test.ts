import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { eject } from '../src/cli/eject.js';
import { runCli } from '../src/cli/main.js';

describe('eject', () => {
  it('writes plain functions and routes, and does not import apiversa', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-eject-'));
    const out = mkdtempSync(join(tmpdir(), 'apiversa-ejected-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(
      join(dir, '2026-03-01.rename.yaml'),
      'version: "2026-03-01"\nid: rename-city\ndescription: "Hotel.city renamed to locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n  - op: endpoint.rename\n    method: GET\n    from: /hotels/:id\n    to: /properties/:id\n',
    );
    const written = eject(dir, out);
    const source = readFileSync(written[0]!, 'utf8');
    expect(source).toContain('export function up_v_2026_03_01_rename_city');
    expect(source).not.toContain('from \'apiversa\'');
    expect(source).not.toContain('fetch(');
    expect(readFileSync(written[1]!, 'utf8')).toContain('GET /hotels/:id -> 2026-03-01.rename-city');
    const href = pathToFileURL(written[0]!).href;
    const ran = spawnSync(process.execPath, ['--input-type=module', '-e', `import { up_v_2026_03_01_rename_city, down_v_2026_03_01_rename_city } from ${JSON.stringify(href)}; console.log(JSON.stringify({ up: up_v_2026_03_01_rename_city({ city: 'Paris' }), down: down_v_2026_03_01_rename_city({ locality: 'Paris' }) }));`], { encoding: 'utf8' });
    expect(ran.status).toBe(0);
    expect(JSON.parse(ran.stdout)).toEqual({ up: { locality: 'Paris' }, down: { city: 'Paris' } });
    expect(runCli(['node', 'apiversa', 'eject', dir, '--out', out])).toBe(0);
  });
});
