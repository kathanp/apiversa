import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { route, type KoaContext } from '../src/index.js';

describe('koa adapter', () => {
  it('upgrades a request and downgrades the response', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-koa-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
    const av = createApiversa({ dir, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false, now: '2026-10-31' });
    const headers = new Map<string, string>();
    const ctx: KoaContext = {
      method: 'POST',
      path: '/hotels',
      headers: { 'api-version': '2026-01-15' },
      request: { body: { city: 'Paris' } },
      set(name, value) {
        headers.set(name, value);
      },
    };
    await route(av, { body: 'Hotel', response: 'Hotel' })(ctx, async () => {
      ctx.body = ctx.request.body;
    });
    expect(ctx.request.body).toEqual({ locality: 'Paris' });
    expect(ctx.body).toEqual({ city: 'Paris' });
    expect(headers.get('Api-Version')).toBe('2026-01-15');
  });
});
