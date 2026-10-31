import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/cli/generate.js';
import { runCli } from '../src/cli/main.js';

const VERSIONS = `head: "2026-03-01"
versions:
  - date: "2026-03-01"
  - date: "2026-01-15"
default: oldest
`;

const CHANGE = `version: "2026-03-01"
id: add-name
description: "Hotel.name was added and title was renamed."
changes:
  - op: field.rename
    schema: Hotel
    from: title
    to: name
  - op: field.add
    schema: Hotel
    path: nickname
    default: ""
`;

describe('generated per-version schemas', () => {
  it('writes a Zod schema and a type for each version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-gen-'));
    writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
    writeFileSync(join(dir, '2026-03-01.add-name.yaml'), CHANGE);
    writeFileSync(join(dir, 'head.json'), JSON.stringify({ Hotel: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'nickname', type: 'string' }] }));
    const written = generate(dir, '2026-10-31');
    expect(written.map((file) => file.endsWith('/2026-03-01.ts') || file.endsWith('/2026-01-15.ts')).every(Boolean)).toBe(true);
    const head = readFileSync(join(dir, 'generated/2026-03-01.ts'), 'utf8');
    const old = readFileSync(join(dir, 'generated/2026-01-15.ts'), 'utf8');
    expect(head).toContain('export const Hotel_2026_03_01');
    expect(head).toContain('export type Hotel_2026_03_01');
    expect(head).toContain('"nickname": z.string()');
    expect(old).toContain('export type Hotel_2026_01_15');
    expect(old).toContain('"title": z.string()');
    expect(old).not.toContain('nickname');
    expect(runCli(['node', 'apiversa', 'generate', dir])).toBe(0);
  });

  it('fails tsc when a converter returns a head-only field', () => {
    const dir = mkdtempSync(join(process.cwd(), '.typecheck-'));
    writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
    writeFileSync(join(dir, '2026-03-01.add-name.yaml'), CHANGE);
    writeFileSync(join(dir, 'head.json'), JSON.stringify({ Hotel: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'nickname', type: 'string' }] }));
    generate(dir, '2026-10-31');
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', noEmit: true, skipLibCheck: true }, files: ['good.ts', 'bad.ts'] }));
    const imports = `import type { Hotel_2026_03_01 } from './generated/2026-03-01.js';
import type { Hotel_2026_01_15 } from './generated/2026-01-15.js';
`;
    writeFileSync(join(dir, 'good.ts'), `${imports}export const good = (body: Hotel_2026_03_01): Hotel_2026_01_15 => ({ id: body.id, title: body.name });\n`);
    writeFileSync(join(dir, 'bad.ts'), `${imports}export const bad = (body: Hotel_2026_03_01): Hotel_2026_01_15 => ({ id: body.id, title: body.name, nickname: body.nickname });\n`);
    const tsc = join(process.cwd(), 'node_modules/typescript/lib/tsc.js');
    expect(() => execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json'], { cwd: dir, stdio: 'pipe' })).toThrow();
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', noEmit: true, skipLibCheck: true }, files: ['good.ts'] }));
    expect(() => execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json'], { cwd: dir, stdio: 'pipe' })).not.toThrow();
  });
});
