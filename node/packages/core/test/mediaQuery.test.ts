import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from '../src/create.js';

describe('CORE-36 media type version', () => {
  it('reads the content type only when the host turns it on, and the header still wins', () => {
    const off = createApiversa({ dir: bundle(), development: false, trace: false });
    const on = createApiversa({ dir: bundle(), development: false, trace: false, mediaType: true });
    const type = { 'content-type': 'application/vnd.hotel+json;version=2026-01-15' };
    expect(off.resolveVersion({ headers: type })).toBe('2026-03-01');
    expect(on.resolveVersion({ headers: type })).toBe('2026-01-15');
    expect(on.resolveVersion({ headers: { ...type, 'Api-Version': '2026-03-01' } })).toBe('2026-03-01');
    expect(() => on.resolveVersion({ headers: { 'content-type': 'application/vnd.hotel+json;version=2026-02-01' } })).toThrow(expect.objectContaining({ code: 'AV-E002' }));
  });

  it('CORE-36 refuses reading a new header name', () => {
    const on = createApiversa({ dir: bundle(), development: false, trace: false, mediaType: true });
    expect(on.resolveVersion({ headers: { 'X-Api-Version': '2026-01-15' } })).toBe('2026-03-01');
  });

  it('CORE-36 refuses changing a request that already sends Api-Version', () => {
    const on = createApiversa({ dir: bundle(), development: false, trace: false, mediaType: true });
    expect(on.resolveVersion({ headers: { 'Api-Version': '2026-03-01', 'content-type': 'application/vnd.hotel+json;version=2026-01-15' } })).toBe('2026-03-01');
  });
});

describe('CORE-37 query version', () => {
  it('reads the named query parameter after the header and the media type', () => {
    const off = createApiversa({ dir: bundle(), development: false, trace: false });
    const on = createApiversa({ dir: bundle(), development: false, trace: false, queryVersion: 'api-version' });
    expect(off.resolveVersion({ path: '/hotels?api-version=2026-01-15' })).toBe('2026-03-01');
    expect(on.resolveVersion({ path: '/hotels?api-version=2026-01-15' })).toBe('2026-01-15');
    expect(on.resolveVersion({ headers: { 'Api-Version': '2026-03-01' }, path: '/hotels?api-version=2026-01-15' })).toBe('2026-03-01');
    expect(() => on.resolveVersion({ query: 'api-version=2026-02-01' })).toThrow(expect.objectContaining({ code: 'AV-E002' }));
    const both = createApiversa({ dir: bundle(), development: false, trace: false, mediaType: true, queryVersion: 'api-version' });
    expect(both.resolveVersion({ headers: { 'content-type': 'application/vnd.hotel+json;version=2026-03-01' }, query: 'api-version=2026-01-15' })).toBe('2026-03-01');
  });

  it('CORE-37 refuses a built-in query name', () => {
    const off = createApiversa({ dir: bundle(), development: false, trace: false });
    expect(off.resolveVersion({ path: '/hotels?api-version=2026-01-15' })).toBe('2026-03-01');
  });

  it('CORE-37 refuses reading the query when the host set no name', () => {
    const on = createApiversa({ dir: bundle(), development: false, trace: false, mediaType: true });
    expect(on.resolveVersion({ query: 'api-version=2026-01-15' })).toBe('2026-03-01');
  });
});

function bundle(): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-resolve-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: latest\n');
  return dir;
}
