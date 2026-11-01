import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { apiversa, type KoaContext } from '../src/index.js';

describe('koa method rewrite', () => {
  it('rewrites an older POST to GET before the next middleware', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-koa-method-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.method.yaml'), 'version: "2026-03-01"\nid: method-search\ndescription: "POST /search became GET /search."\nchanges:\n  - op: endpoint.method\n    path: /search\n    from: POST\n    to: GET\n');
    const av = createApiversa({ dir, schemas: {}, development: false, trace: false, now: '2026-10-31' });
    const ctx: KoaContext = { method: 'POST', path: '/search', headers: { 'api-version': '2026-01-15' }, request: {}, set() {} };
    await apiversa(av)(ctx, async () => {
      expect(ctx.method).toBe('GET');
    });
    const head: KoaContext = { method: 'POST', path: '/search', headers: { 'api-version': '2026-03-01' }, request: {}, set() {} };
    await apiversa(av)(head, async () => {
      expect(head.method).toBe('POST');
    });
  });
});