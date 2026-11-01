import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiversa } from '../src/create.js';
import { downgradeNdjson, downgradeNdjsonLine, downgradeSse, downgradeSseLine } from '../src/stream.js';

function av() {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-stream-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "Hotel.city renamed to locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
  return createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: false });
}

describe('ndjson and sse', () => {
  it('converts one line at a time and leaves notes, blanks, and head lines', () => {
    const engine = av();
    expect(downgradeNdjsonLine(engine, '{"locality":"Paris"}', 'Hotel', '2026-01-15')).toBe('{"city":"Paris"}');
    expect(downgradeNdjsonLine(engine, 'note', 'Hotel', '2026-01-15')).toBe('note');
    expect(downgradeNdjsonLine(engine, '', 'Hotel', '2026-01-15')).toBe('');
    expect(downgradeNdjsonLine(engine, '{"locality":"Paris"}', 'Hotel', '2026-03-01')).toBe('{"locality":"Paris"}');
    expect(downgradeSseLine(engine, 'data: {"locality":"Paris"}', 'Hotel', '2026-01-15')).toBe('data: {"city":"Paris"}');
    expect(downgradeSseLine(engine, 'event: ping', 'Hotel', '2026-01-15')).toBe('event: ping');
    expect(downgradeSseLine(engine, 'data:', 'Hotel', '2026-01-15')).toBe('data:');
    let wrote = false;
    const source = '{"locality":"Paris"}\n{"locality":"Lyon"}\n';
    let index = 0;
    const read = () => {
      if (index > source.indexOf('\n') && !wrote) throw new Error('read the next line before the first was written');
      if (index >= source.length) return -1;
      return source.charCodeAt(index++);
    };
    let out = '';
    downgradeNdjson(engine, read, 'Hotel', '2026-01-15', (text) => {
      if (text.endsWith('\n')) wrote = true;
      out += text;
    });
    expect(out).toBe('{"city":"Paris"}\n{"city":"Lyon"}\n');
    let sse = '';
    const events = 'data: {"locality":"Paris"}\r\nevent: ping\n';
    let cursor = 0;
    downgradeSse(engine, () => (cursor >= events.length ? -1 : events.charCodeAt(cursor++)), 'Hotel', '2026-01-15', (text) => {
      sse += text;
    });
    expect(sse).toBe('data: {"city":"Paris"}\nevent: ping\n');
  });
});
