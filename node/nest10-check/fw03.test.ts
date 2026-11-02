import 'reflect-metadata';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApiversa, type Apiversa } from 'apiversa';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ApiversaModule, ApiversaRoute } from '../packages/nest/src/index.js';

const VERSIONS = 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n';
const CHANGE = `version: "2026-03-01"
id: rename-city
description: "Hotel.city renamed to locality."
changes:
  - op: field.rename
    schema: Hotel
    from: city
    to: locality
`;

function bundle(): Apiversa {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-nest10-'));
  writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), CHANGE);
  return createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: true, now: '2026-11-01' });
}

function decorate(target: object, key: string, decorators: MethodDecorator[]): void {
  let descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) return;
  for (const decorator of decorators) {
    const next = decorator(target, key, descriptor);
    if (next) descriptor = next;
  }
  Object.defineProperty(target, key, descriptor);
}

class Hotels {
  one(): { locality: string } {
    return { locality: 'Paris' };
  }

  create(body: { locality?: string }): { locality?: string } {
    return body;
  }
}
Controller('hotels')(Hotels);
decorate(Hotels.prototype, 'one', [Get(':id'), ApiversaRoute({ response: 'Hotel' })]);
decorate(Hotels.prototype, 'create', [Post(), ApiversaRoute({ body: 'Hotel', response: 'Hotel' })]);
Body()(Hotels.prototype, 'create', 0);

describe('FW-03 Nest 10', () => {
  it('FW-03 passes on Nest 10 with Express', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ApiversaModule.forRoot(bundle())], controllers: [Hotels] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const old = await request(server).get('/hotels/h_1').set('Api-Version', '2026-01-15');
    expect(old.status).toBe(200);
    expect(old.body).toEqual({ city: 'Paris' });
    const posted = await request(server).post('/hotels').set('Api-Version', '2026-01-15').send({ city: 'Paris' });
    expect(posted.body).toEqual({ city: 'Paris' });
    await app.close();
  });

  it('FW-03 passes on Nest 10 with Fastify', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ApiversaModule.forRoot(bundle())], controllers: [Hotels] }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const old = await app.inject({ method: 'GET', url: '/hotels/h_1', headers: { 'Api-Version': '2026-01-15' } });
    expect(old.statusCode).toBe(200);
    expect(old.json()).toEqual({ city: 'Paris' });
    const posted = await app.inject({ method: 'POST', url: '/hotels', headers: { 'Api-Version': '2026-01-15', 'content-type': 'application/json' }, payload: { city: 'Paris' } });
    expect(posted.json()).toEqual({ city: 'Paris' });
    await app.close();
  });
});
