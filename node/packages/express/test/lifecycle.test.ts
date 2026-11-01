import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { route } from '../src/index.js';

describe('express deprecation headers', () => {
  it('sends Deprecation, Sunset, and Link for a deprecated client', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-ex-life-'));
    writeFileSync(join(dir, 'versions.yaml'), `head: "2026-03-01"
default: oldest
versions:
  - date: "2026-03-01"
  - date: "2026-01-15"
    deprecated: true
    sunset: "2026-06-01"
`);
    writeFileSync(join(dir, '2026-03-01.add-name.yaml'), `version: "2026-03-01"
id: add-name
description: Hotel.name was added.
changes:
  - op: field.add
    schema: Hotel
    path: name
    default: Bay
`);
    const av = createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: false });
    const app = express();
    app.get('/hotels/:id', route(av, { response: 'Hotel' }), (_req, res) => {
      res.json({ id: 'h_1', name: 'Bay' });
    });
    const response = await request(app).get('/hotels/h_1').set('Api-Version', '2026-01-15');
    expect(response.headers.deprecation).toBe(`@${Date.parse('2026-01-15T00:00:00.000Z') / 1000}`);
    expect(response.headers.sunset).toBe('Mon, 01 Jun 2026 00:00:00 GMT');
    expect(response.headers.link).toBe('</apiversa/upgrade>; rel="deprecation"');
    expect(av.stats().requests['2026-01-15']).toBe(1);
  });
});