import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeAsyncApi } from '../src/cli/asyncapi.js';
import { runCli } from '../src/cli/main.js';

const HEAD = '{"asyncapi":"3.0.0","info":{"title":"Hotels","version":"2026-03-01"},"channels":{"bookings":{"address":"bookings"},"cancellations":{"address":"cancellations"}},"components":{"messages":{"Booking":{"payload":{"$ref":"#/components/schemas/Hotel"}}},"schemas":{"Hotel":{"type":"object","properties":{"locality":{"type":"string"}}}}}}';
const OLDER = '{"asyncapi":"3.0.0","info":{"title":"Hotels","version":"2026-03-01"},"channels":{"bookings":{"address":"bookings"},"cancellations":{"address":"cancellations"}},"components":{"messages":{"Booking":{"payload":{"$ref":"#/components/schemas/Hotel"}}},"schemas":{"Hotel":{"type":"object","properties":{"city":{"type":"string"}}}}}}\n';

describe('asyncapi', () => {
  it('rewinds a payload schema and writes nothing when the input is missing or the wrong version', () => {
    const dir = bundle();
    writeFileSync(join(dir, 'asyncapi.json'), HEAD);
    const written = writeAsyncApi(dir);
    expect(written.ok).toBe(true);
    if (written.ok) {
      expect(written.files.map((file) => file.slice(dir.length + 1))).toEqual(['asyncapi/2026-03-01.json', 'asyncapi/2026-01-15.json']);
      expect(readFileSync(join(dir, 'asyncapi/2026-03-01.json'), 'utf8')).toBe(`${HEAD}\n`);
      expect(readFileSync(join(dir, 'asyncapi/2026-01-15.json'), 'utf8')).toBe(OLDER);
    }

    const missing = mkdtempSync(join(tmpdir(), 'apiversa-async-missing-'));
    expect(writeAsyncApi(missing)).toEqual({ ok: true, files: [] });
    expect(existsSync(join(missing, 'asyncapi'))).toBe(false);
    expect(runCli(['node', 'apiversa', 'asyncapi', missing])).toBe(0);

    const wrong = bundle();
    writeFileSync(join(wrong, 'asyncapi.json'), HEAD.replace('3.0.0', '2.6.0'));
    expect(writeAsyncApi(wrong)).toEqual({ ok: false, code: 'AV-E001' });
    expect(existsSync(join(wrong, 'asyncapi'))).toBe(false);
    const stderr: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    try {
      expect(runCli(['node', 'apiversa', 'asyncapi', wrong])).toBe(1);
    } finally {
      process.stderr.write = write;
    }
    expect(stderr.join('')).toContain('AV-E001');
    expect(existsSync(join(wrong, 'asyncapi'))).toBe(false);
  });
});

function bundle(): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-async-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
  return dir;
}
