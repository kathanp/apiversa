import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeCompat } from '../src/cli/compat.js';
import { runCli } from '../src/cli/main.js';

const BYTES = '{"head":"2026-03-01","versions":[{"date":"2026-03-01","deprecated":false,"sunset":null,"sunsetEnforce":false,"changes":[]},{"date":"2026-01-15","deprecated":true,"sunset":"2026-06-01","sunsetEnforce":true,"changes":["a-rename","b-add"]}]}\n';

describe('compat', () => {
  it('lists change ids in chain order and writes the same bytes to the chosen path', () => {
    const dir = bundle();
    const out = join(dir, 'chosen.json');
    expect(writeCompat(dir, out)).toBe(out);
    expect(readFileSync(out, 'utf8')).toBe(BYTES);
    const cwd = mkdtempSync(join(tmpdir(), 'apiversa-compat-cwd-'));
    expect(writeCompat(dir, undefined, undefined, cwd)).toBe(join(cwd, 'compatibility.json'));
    expect(readFileSync(join(cwd, 'compatibility.json'), 'utf8')).toBe(BYTES);
    expect(runCli(['node', 'apiversa', 'compat', '--out', out, dir])).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(BYTES);
  });
});

function bundle(): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-compat-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\n    deprecated: true\n    sunset: "2026-06-01"\n    sunsetEnforce: true\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.b.yaml'), 'version: "2026-03-01"\nid: b-add\ndescription: "Add stars."\nchanges:\n  - op: field.add\n    schema: Hotel\n    path: stars\n    default: 1\n');
  writeFileSync(join(dir, '2026-03-01.a.yaml'), 'version: "2026-03-01"\nid: a-rename\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
  return dir;
}
