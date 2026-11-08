import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { createGateway } from '../src/index.js';

describe('gateway', () => {
  it('sends the head shape and returns the downgraded response', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-gw-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.alias.yaml'), 'version: "2026-03-01"\nid: alias-city\ndescription: "city became locality."\nchanges:\n  - op: field.alias\n    schema: Hotel\n    from: city\n    to: locality\n');
    const av = createApiversa({ dir, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false });
    const seen: { url?: string; body?: string } = {};
    const gateway = createGateway({
      apiversa: av,
      upstream: 'https://upstream.test/hotels',
      fetch: async (request) => {
        seen.url = request.url;
        seen.body = request.body;
        return { status: 200, body: '{"locality":"Paris"}' };
      },
    });
    const result = await gateway.handle({ schema: 'Hotel', headers: { 'Api-Version': '2026-01-15' }, body: { city: 'Paris' } });
    expect(seen.url).toBe('https://upstream.test/hotels');
    expect(seen.body).toBe('{"locality":"Paris"}');
    expect(result.body).toBe('{"city":"Paris"}');
    let called = false;
    const blocked = createGateway({
      apiversa: av,
      upstream: 'https://upstream.test/hotels',
      fetch: async () => {
        called = true;
        return { status: 200, body: '{}' };
      },
    });
    await expect(blocked.handle({ schema: 'Hotel', headers: { 'Api-Version': '2026-02-01' }, body: {} })).rejects.toMatchObject({ code: 'AV-E002' });
    expect(called).toBe(false);
  });
});
