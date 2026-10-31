import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiversa } from 'apiversa';
import { apiversa, route } from '@apiversa/fastify';

describe('fastify adapter', () => {
  it('downgrades before serialization and validates the head payload first', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-fy-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(
      join(dir, '2026-03-01.rename.yaml'),
      'version: "2026-03-01"\nid: rename-city\ndescription: "Hotel.city renamed to locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n',
    );
    const av = createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: false });
    const app = Fastify();
    await app.register(apiversa(av));
    app.get('/hotels/:id', { config: route({ response: 'Hotel' }), schema: { response: { 200: { type: 'object', required: ['locality'], properties: { locality: { type: 'string' }, city: { type: 'string' } } } } } }, async () => ({ locality: 'Paris' }));
    app.get('/broken', { config: route({ response: 'Hotel' }), schema: { response: { 200: { type: 'object', required: ['locality'], properties: { locality: { type: 'string' } } } } } }, async () => ({ name: 'Bay' }));
    app.post('/hotels', { config: route({ body: 'Hotel', response: 'Hotel' }) }, async (req) => req.body);
    const old = await app.inject({ method: 'GET', url: '/hotels/h_1', headers: { 'api-version': '2026-01-15' } });
    expect(old.json()).toEqual({ city: 'Paris' });
    const head = await app.inject({ method: 'GET', url: '/hotels/h_1', headers: { 'api-version': '2026-03-01' } });
    expect(head.json()).toEqual({ locality: 'Paris' });
    const broken = await app.inject({ method: 'GET', url: '/broken', headers: { 'api-version': '2026-01-15' } });
    expect(broken.statusCode).toBeGreaterThanOrEqual(500);
    const posted = await app.inject({ method: 'POST', url: '/hotels', headers: { 'api-version': '2026-01-15', 'content-type': 'application/json' }, payload: { city: 'Paris' } });
    expect(posted.json()).toEqual({ city: 'Paris' });
    const unknown = await app.inject({ method: 'GET', url: '/hotels/h_1', headers: { 'api-version': '2026-02-01' } });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json().error.code).toBe('AV-E002');
    await app.close();

    const boom = Fastify();
    const throwing = createApiversa({
      dir,
      schemas: { Hotel: {} },
      development: false,
      trace: false,
      resolve: () => {
        throw new Error('boom');
      },
    });
    await boom.register(apiversa(throwing));
    boom.get('/hotels/:id', { config: route({ response: 'Hotel' }) }, async () => ({ locality: 'Paris' }));
    const failed = await boom.inject({ method: 'GET', url: '/hotels/h_1' });
    expect(failed.statusCode).toBeGreaterThanOrEqual(500);
    await boom.close();
  });
});
