import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { createGateway } from '../src/index.js';

describe('GW-03 upstream per bundle', () => {
  it('sends billing to the billing URL once', async () => {
    const dir = bundle();
    const av = createApiversa({ bundles: { billing: { dir } }, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false });
    let calls = 0;
    const gateway = createGateway({
      apiversa: av,
      bundle: 'billing',
      upstreams: { billing: 'https://billing.test/hotels' },
      fetch: async (request) => {
        calls += 1;
        expect(request.url).toBe('https://billing.test/hotels');
        expect(request.body).toBe('{"locality":"Paris"}');
        return { status: 200, body: '{"locality":"Paris"}' };
      },
    });
    const result = await gateway.handle({ schema: 'Hotel', headers: { 'Api-Version': '2026-01-15' }, body: { city: 'Paris' } });
    expect(result.body).toBe('{"city":"Paris"}');
    expect(calls).toBe(1);
  });

  it('GW-03 refuses calling a URL the host did not put in the map', async () => {
    const av = createApiversa({ bundles: { billing: { dir: bundle() } }, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false });
    let calls = 0;
    const gateway = createGateway({
      apiversa: av,
      bundle: 'other',
      upstreams: { billing: 'https://billing.test/hotels' },
      fetch: async () => {
        calls += 1;
        return { status: 200, body: '{}' };
      },
    });
    await expect(gateway.handle({ schema: 'Hotel', headers: { 'Api-Version': '2026-01-15' }, body: {} })).rejects.toMatchObject({ code: 'AV-E001' });
    expect(calls).toBe(0);
  });

  it('GW-03 refuses calling fetch twice', async () => {
    const av = createApiversa({ bundles: { billing: { dir: bundle() } }, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false });
    let calls = 0;
    const gateway = createGateway({
      apiversa: av,
      bundle: 'billing',
      upstreams: { billing: 'https://billing.test/hotels' },
      fetch: async () => {
        calls += 1;
        return { status: 200, body: '{}' };
      },
    });
    await expect(gateway.handle({ schema: 'Hotel', headers: { 'Api-Version': '2026-02-01' }, body: {} })).rejects.toMatchObject({ code: 'AV-E002' });
    expect(calls).toBe(0);
  });
});

function bundle(): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-gw3-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.alias.yaml'), 'version: "2026-03-01"\nid: alias-city\ndescription: "city became locality."\nchanges:\n  - op: field.alias\n    schema: Hotel\n    from: city\n    to: locality\n');
  return dir;
}
