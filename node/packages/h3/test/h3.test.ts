import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { apiversaH3 } from '../src/index.js';

describe('FW-08 h3 adapter', () => {
  it('gives the handler the head body once and returns the downgraded body', async () => {
    const av = hotel();
    let calls = 0;
    const handle = apiversaH3(av, { request: 'Hotel', response: 'Hotel' }, (body) => {
      calls += 1;
      expect(body).toEqual({ locality: 'Paris' });
      return body;
    });
    await expect(handle({ headers: { 'Api-Version': '2026-01-15' }, body: { city: 'Paris' } })).resolves.toEqual({ city: 'Paris' });
    expect(calls).toBe(1);
  });

  it('FW-08 refuses opening a socket', async () => {
    const handle = apiversaH3(hotel(), { request: 'Hotel', response: 'Hotel' }, (body) => body);
    await expect(handle({ headers: { 'Api-Version': '2026-01-15' }, body: { city: 'Paris' } })).resolves.toEqual({ city: 'Paris' });
  });

  it('FW-08 refuses calling the handler twice', async () => {
    let calls = 0;
    const handle = apiversaH3(hotel(), { request: 'Hotel', response: 'Hotel' }, () => {
      calls += 1;
      return {};
    });
    await expect(handle({ headers: { 'Api-Version': '2026-02-01' }, body: {} })).rejects.toMatchObject({ code: 'AV-E002' });
    expect(calls).toBe(0);
  });
});

function hotel() {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-h3-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
  return createApiversa({ dir, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false });
}
