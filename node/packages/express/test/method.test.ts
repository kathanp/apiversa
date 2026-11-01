import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiversa } from 'apiversa';
import { apiversa } from '@apiversa/express';

describe('express method rewrite', () => {
  it('sends an older POST /search to GET and leaves a head POST unmatched', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-method-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.method.yaml'), 'version: "2026-03-01"\nid: method-search\ndescription: "POST /search became GET /search."\nchanges:\n  - op: endpoint.method\n    path: /search\n    from: POST\n    to: GET\n');
    const av = createApiversa({ dir, schemas: {}, development: false, trace: false, now: '2026-10-31' });
    const application = express();
    application.use(apiversa(av));
    application.get('/search', (_req, res) => {
      res.json({ method: 'GET' });
    });
    const old = await request(application).post('/search').set('Api-Version', '2026-01-15');
    expect(old.status).toBe(200);
    expect(old.body).toEqual({ method: 'GET' });
    const head = await request(application).post('/search').set('Api-Version', '2026-03-01');
    expect(head.status).toBe(404);
  });
});
