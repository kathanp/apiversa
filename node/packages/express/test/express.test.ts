import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiversa } from 'apiversa';
import { apiversa, route } from '@apiversa/express';

function app() {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-ex-'));
  writeFileSync(
    join(dir, 'versions.yaml'),
    'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n',
  );
  writeFileSync(
    join(dir, '2026-03-01.rename.yaml'),
    'version: "2026-03-01"\nid: rename-city\ndescription: "Hotel.city renamed to locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n',
  );
  const av = createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: true });
  const application = express();
  application.use(express.json());
  application.use(apiversa(av));
  application.get('/hotels/:id', route(av, { response: 'Hotel' }), (_req, res) => {
    res.json({ locality: 'Paris' });
  });
  application.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  application.post('/hotels', route(av, { body: 'Hotel', response: 'Hotel' }), (req, res) => {
    res.json(req.body);
  });
  application.get('/file', route(av, { response: 'Hotel' }), (_req, res) => {
    res.send(Buffer.from('abc'));
  });
  application.get('/text', route(av, { response: 'Hotel' }), (_req, res) => {
    res.send('plain');
  });
  application.get('/raw', route(av, { response: 'Hotel' }), (_req, res) => {
    res.send({ locality: 'Paris' });
  });
  return application;
}

describe('express adapter', () => {
  it('downgrades a registered route and leaves other routes alone', async () => {
    const application = app();
    const old = await request(application).get('/hotels/h_1').set('Api-Version', '2026-01-15');
    expect(old.body).toEqual({ city: 'Paris' });
    expect(old.headers['apiversa-trace']).toBe('2026-03-01.rename-city');
    const head = await request(application).get('/hotels/h_1').set('Api-Version', '2026-03-01');
    expect(head.body).toEqual({ locality: 'Paris' });
    const health = await request(application).get('/health').set('Api-Version', '2026-01-15');
    expect(health.body).toEqual({ ok: true });
  });

  it('rejects a host resolver that throws', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-ex-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-01-15"\nversions:\n  - date: "2026-01-15"\ndefault: oldest\n');
    const av = createApiversa({
      dir,
      schemas: { Hotel: {} },
      development: false,
      trace: false,
      resolve: () => {
        throw new Error('boom');
      },
    });
    const application = express();
    application.use(route(av, { response: 'Hotel' }));
    application.get('/hotels/:id', (_req, res) => {
      res.send({ locality: 'Paris' });
    });
    const response = await request(application).get('/hotels/h_1');
    expect(response.status).toBe(500);
  });

  it('returns the version error envelope and passes files through', async () => {
    const application = app();
    const unknown = await request(application).get('/hotels/h_1').set('Api-Version', '2026-02-01');
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('AV-E002');
    const file = await request(application).get('/file').set('Api-Version', '2026-01-15');
    expect(file.status).toBe(200);
    expect(Buffer.isBuffer(file.body) ? file.body.toString() : file.text).toBe('abc');
    const text = await request(application).get('/text').set('Api-Version', '2026-01-15');
    expect(text.text).toBe('plain');
    const posted = await request(application).post('/hotels').set('Api-Version', '2026-01-15').send({ city: 'Paris' });
    expect(posted.body).toEqual({ city: 'Paris' });
    const raw = await request(application).get('/raw').set('Api-Version', '2026-01-15');
    expect(raw.body).toEqual({ city: 'Paris' });
  });
});
