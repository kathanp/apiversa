import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rewriteFailure, rewriteJsonl } from '../src/cli/rewrite.js';
import { runCli } from '../src/cli/main.js';

describe('rewrite', () => {
  it('writes the same canonical line up and down, and leaves no file on failure', () => {
    const dir = bundle();
    const input = join(dir, 'in.jsonl');
    const out = join(dir, 'out.jsonl');
    writeFileSync(input, '{"city":"Paris"}\n');
    const up = rewriteJsonl(dir, { schema: 'Hotel', direction: 'up', version: '2026-01-15', input, out });
    expect(up).toEqual({ ok: true, bytes: '{"locality":"Paris"}\n' });
    expect(readFileSync(out, 'utf8')).toBe('{"locality":"Paris"}\n');

    const head = join(dir, 'head.jsonl');
    const older = join(dir, 'older.jsonl');
    writeFileSync(head, '{"locality":"Paris"}\n');
    const down = rewriteJsonl(dir, { schema: 'Hotel', direction: 'down', version: '2026-01-15', input: head, out: older });
    expect(down).toEqual({ ok: true, bytes: '{"city":"Paris"}\n' });

    writeFileSync(out, 'stale\n');
    writeFileSync(input, '{"city":"Paris"}\n{"city":"Paris","city":"Lyon"}\n');
    const bad = rewriteJsonl(dir, { schema: 'Hotel', direction: 'up', version: '2026-01-15', input, out });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(rewriteFailure(bad)).toBe('line 2: AV-E015');
    expect(existsSync(out)).toBe(false);

    const huge = join(dir, 'huge.jsonl');
    writeFileSync(huge, `${'{"city":"Paris"}\n'.repeat(10001)}`);
    writeFileSync(out, 'stale\n');
    const limited = rewriteJsonl(dir, { schema: 'Hotel', direction: 'up', version: '2026-01-15', input: huge, out });
    expect(limited).toEqual({ ok: false, code: 'AV-E019' });
    expect(existsSync(out)).toBe(false);

    const stderr: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    try {
      expect(runCli(['node', 'apiversa', 'rewrite', '--schema', 'Hotel', '--direction', 'up', '--version', '2026-01-15', '--in', huge, '--out', out, dir])).toBe(1);
    } finally {
      process.stderr.write = write;
    }
    expect(stderr.join('')).toContain('AV-E019');
    expect(existsSync(out)).toBe(false);
  });
});

function bundle(): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-rewrite-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
  return dir;
}
