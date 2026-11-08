import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { apiversaHandler } from '../src/index.js';

describe('lambda', () => {
  it('gives the handler the head body once and returns the downgraded body', async () => {
    const av = hotel();
    let calls = 0;
    const handle = apiversaHandler(av, { request: 'Hotel', response: 'Hotel' }, (body) => {
      calls += 1;
      expect(body).toEqual({ locality: 'Paris' });
      return body;
    });
    const response = await handle({ version: '2.0', headers: { 'Api-Version': '2026-01-15' }, body: '{"city":"Paris"}', isBase64Encoded: false });
    expect(response.body).toBe('{"city":"Paris"}');
    expect(response.headers['Api-Version']).toBe('2026-01-15');
    expect(calls).toBe(1);

    const encoded = Buffer.from('{"city":"Paris"}', 'utf8').toString('base64');
    await handle({ version: '2.0', headers: { 'Api-Version': '2026-01-15' }, body: encoded, isBase64Encoded: true });
    expect(calls).toBe(2);

    let blocked = 0;
    const reject = apiversaHandler(av, { request: 'Hotel', response: 'Hotel' }, () => {
      blocked += 1;
      return {};
    });
    await expect(reject({ version: '1.0', body: '{}' })).rejects.toMatchObject({ code: 'AV-E022', status: 400, message: 'Lambda event could not be read.' });
    await expect(reject({ version: '2.0', headers: { 'Api-Version': '2026-01-15' }, body: '%%%', isBase64Encoded: true })).rejects.toMatchObject({ code: 'AV-E022' });
    expect(blocked).toBe(0);
  });
});

function hotel() {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-lambda-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
  return createApiversa({ dir, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false });
}
