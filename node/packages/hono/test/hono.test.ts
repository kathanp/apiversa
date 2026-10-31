import { Hono } from 'hono';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa, type Apiversa } from 'apiversa';
import { apiversa, route, type ApiversaEnv } from '../src/index.js';

const VERSIONS = 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n';
const CHANGE = `version: "2026-03-01"
id: rename-city
description: "Hotel.city renamed to locality."
changes:
  - op: field.rename
    schema: Hotel
    from: city
    to: locality
  - op: error.shape
    code: not_found
    down:
      message: "$.detail"
`;

function bundle(options?: { trace?: boolean; resolve?: (request: unknown) => string | undefined }): Apiversa {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-hono-'));
  writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), CHANGE);
  return createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: options?.trace ?? true, resolve: options?.resolve });
}

function app(av: Apiversa) {
  const application = new Hono<ApiversaEnv>();
  application.use('*', apiversa(av));
  application.get('/hotels/:id', route(av, { response: 'Hotel' }), (c) => c.json({ locality: 'Paris' }));
  application.get('/health', (c) => c.json({ ok: true }));
  application.post('/hotels', route(av, { body: 'Hotel', response: 'Hotel' }), (c) => c.json(c.get('apiversaBody')));
  application.get('/text', route(av, { response: 'Hotel' }), (c) => c.text('plain'));
  application.get('/empty', route(av, { response: 'Hotel' }), () => new Response('', { headers: { 'content-type': 'application/json' } }));
  application.get('/missing', route(av, { response: 'Hotel' }), (c) => c.json({ detail: 'missing', code: 'not_found' }, 404));
  application.get('/numbered', route(av, { response: 'Hotel' }), (c) => c.json({ code: 1, locality: 'Paris' }, 404));
  application.get('/plain-error', route(av, { response: 'Hotel' }), (c) => c.json({ detail: 'nope' }, 404));
  application.get('/raw', route(av, { response: 'Hotel' }), () => new Response('abc'));
  application.post('/note', route(av, { body: 'Hotel' }), (c) => c.text(c.get('apiversaBody') === undefined ? 'skipped' : 'read'));
  return application;
}

describe('hono adapter', () => {
  it('downgrades a registered route and leaves other routes alone', async () => {
    const application = app(bundle());
    const old = await application.request('/hotels/h_1', { headers: { 'Api-Version': '2026-01-15' } });
    expect(await old.json()).toEqual({ city: 'Paris' });
    expect(old.headers.get('apiversa-trace')).toBe('2026-03-01.rename-city');
    const head = await application.request('/hotels/h_1', { headers: { 'Api-Version': '2026-03-01' } });
    expect(await head.json()).toEqual({ locality: 'Paris' });
    expect(head.headers.get('apiversa-trace')).toBeNull();
    const health = await application.request('/health', { headers: { 'Api-Version': '2026-01-15' } });
    expect(await health.json()).toEqual({ ok: true });
  });

  it('returns the version error envelope and round-trips a post', async () => {
    const application = app(bundle());
    const unknown = await application.request('/hotels/h_1', { headers: { 'Api-Version': '2026-02-01' } });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error.code).toBe('AV-E002');
    const posted = await application.request('/hotels', {
      method: 'POST',
      headers: { 'Api-Version': '2026-01-15', 'content-type': 'application/json' },
      body: JSON.stringify({ city: 'Paris' }),
    });
    expect(await posted.json()).toEqual({ city: 'Paris' });
    const headPost = await application.request('/hotels?city=Paris', {
      method: 'POST',
      headers: { 'Api-Version': '2026-03-01', 'content-type': 'application/json' },
      body: JSON.stringify({ locality: 'Paris' }),
    });
    expect(await headPost.json()).toEqual({ locality: 'Paris' });
    const text = await application.request('/text', { headers: { 'Api-Version': '2026-01-15' } });
    expect(await text.text()).toBe('plain');
    const empty = await application.request('/empty', { headers: { 'Api-Version': '2026-01-15' } });
    expect(await empty.text()).toBe('');
    const missing = await application.request('/missing', { headers: { 'Api-Version': '2026-01-15' } });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ message: 'missing' });
    const numbered = await application.request('/numbered', { headers: { 'Api-Version': '2026-01-15' } });
    expect(await numbered.json()).toEqual({ code: 1, locality: 'Paris' });
    const plainError = await application.request('/plain-error', { headers: { 'Api-Version': '2026-01-15' } });
    expect(await plainError.json()).toEqual({ detail: 'nope' });
    const raw = await application.request('/raw', { headers: { 'Api-Version': '2026-01-15' } });
    expect(await raw.text()).toBe('abc');
    const untyped = await application.request('/note', { method: 'POST', headers: { 'Api-Version': '2026-01-15' }, body: '{}' });
    expect(await untyped.text()).toBe('skipped');
    const note = await application.request('/note', {
      method: 'POST',
      headers: { 'Api-Version': '2026-01-15', 'content-type': 'text/plain' },
      body: 'city=Paris',
    });
    expect(await note.text()).toBe('skipped');
  });

  it('skips the trace header when tracing is off and a thrown resolver is 500', async () => {
    const quiet = app(bundle({ trace: false }));
    const old = await quiet.request('/hotels/h_1', { headers: { 'Api-Version': '2026-01-15' } });
    expect(await old.json()).toEqual({ city: 'Paris' });
    expect(old.headers.get('apiversa-trace')).toBeNull();
    const broken = app(bundle({ resolve: () => { throw new Error('boom'); } }));
    const response = await broken.request('/hotels/h_1');
    expect(response.status).toBe(500);
  });
});
