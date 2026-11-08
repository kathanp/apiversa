import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { route } from '../src/index.js';

describe('next adapter', () => {
  it('upgrades a route handler and downgrades the response', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-next-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
    const av = createApiversa({ dir, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false, now: '2026-10-31' });
    const handler = route(av, { body: 'Hotel', response: 'Hotel' }, async (request) => {
      const body = await request.json();
      return Response.json(body);
    });
    const response = await handler(new Request('https://api.example/hotels', { method: 'POST', headers: { 'api-version': '2026-01-15', 'content-type': 'application/json' }, body: JSON.stringify({ city: 'Paris' }) }));
    expect(response.headers.get('Api-Version')).toBe('2026-01-15');
    expect(await response.json()).toEqual({ city: 'Paris' });
  });

  it('leaves a head GET alone when the plan is empty', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-next-head-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
    const av = createApiversa({ dir, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false, now: '2026-10-31' });
    const handler = route(av, {}, async () => new Response('ok', { status: 200 }));
    const response = await handler(new Request('https://api.example/hotels?x=1', { method: 'GET', headers: { 'api-version': '2026-03-01' } }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });
});
