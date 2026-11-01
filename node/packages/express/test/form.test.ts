import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiversa } from 'apiversa';
import { route } from '../src/index.js';

describe('express form bodies', () => {
  it('upgrades a urlencoded field and keeps a multipart file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-ex-form-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "Hotel.city renamed to locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
    const av = createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: false });
    const application = express();
    application.use(express.text({ type: ['application/x-www-form-urlencoded', 'multipart/form-data'] }));
    application.post('/hotels', route(av, { body: 'Hotel', response: 'Hotel' }), (req, res) => {
      const body = req.body as { locality?: string };
      res.json({ seen: body.locality });
    });
    application.post('/files', route(av, { body: 'Hotel' }), (req, res) => {
      res.type('text/plain').send(req.body);
    });
    application.post('/buffered', (req, _res, next) => {
      req.body = Buffer.from('city=Lyon');
      next();
    }, route(av, { body: 'Hotel', response: 'Hotel' }), (req, res) => {
      const body = req.body as { locality?: string };
      res.json({ seen: body.locality });
    });
    const posted = await request(application).post('/hotels').set('Api-Version', '2026-01-15').set('Content-Type', 'application/x-www-form-urlencoded').send('city=Paris');
    expect(posted.body).toEqual({ seen: 'Paris' });
    const file = 'hello-file';
    const multipart = `--b\r\nContent-Disposition: form-data; name="city"\r\n\r\nParis\r\n--b\r\nContent-Disposition: form-data; name="photo"; filename="a.txt"\r\n\r\n${file}\r\n--b--`;
    const uploaded = await request(application).post('/files').set('Api-Version', '2026-01-15').set('Content-Type', 'multipart/form-data; boundary=b').send(multipart);
    expect(uploaded.text).toContain(file);
    expect(uploaded.text).toContain('name="locality"');
    const buffered = await request(application).post('/buffered').set('Api-Version', '2026-01-15').set('Content-Type', 'application/x-www-form-urlencoded');
    expect(buffered.body).toEqual({ seen: 'Lyon' });
  });
});
