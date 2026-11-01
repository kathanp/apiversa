import Fastify from 'fastify';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { apiversa, route } from '@apiversa/fastify';

describe('fastify method shim', () => {
  it('calls the GET handler for an older POST and 404s a head POST', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-fy-method-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.method.yaml'), 'version: "2026-03-01"\nid: method-search\ndescription: "POST /search became GET /search."\nchanges:\n  - op: endpoint.method\n    path: /search\n    from: POST\n    to: GET\n');
    const av = createApiversa({ dir, schemas: {}, development: false, trace: false, now: '2026-10-31' });
    const app = Fastify();
    await app.register(apiversa(av));
    app.get('/search', { config: route({}) }, async () => ({ method: 'GET' }));
    const old = await app.inject({ method: 'POST', url: '/search', headers: { 'api-version': '2026-01-15' } });
    expect(old.statusCode).toBe(200);
    expect(old.json()).toEqual({ method: 'GET' });
    const head = await app.inject({ method: 'POST', url: '/search', headers: { 'api-version': '2026-03-01' } });
    expect(head.statusCode).toBe(404);
    await app.close();
  });
});
