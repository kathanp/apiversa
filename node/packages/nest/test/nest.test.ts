import 'reflect-metadata';
import { Body, Controller, Get, HttpException, Post, VersioningType, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApiversa, type Apiversa } from 'apiversa';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lastValueFrom, of, throwError } from 'rxjs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ApiversaInterceptor, ApiversaModule, ApiversaRoute } from '../src/index.js';

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

function bundle(resolve?: (request: unknown) => string | undefined, trace = true): Apiversa {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-nest-'));
  writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), CHANGE);
  return createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace, resolve });
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
  missing(): never {
    throw new HttpException({ detail: 'missing', code: 'not_found' }, 404);
  }

  text(): string {
    return 'plain';
  }

  numbered(): { code: number; locality: string } {
    return { code: 1, locality: 'Paris' };
  }

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
decorate(Hotels.prototype, 'missing', [Get('missing'), ApiversaRoute({ response: 'Hotel' })]);
decorate(Hotels.prototype, 'text', [Get('text'), ApiversaRoute({ response: 'Hotel' })]);
decorate(Hotels.prototype, 'numbered', [Get('numbered'), ApiversaRoute({ response: 'Hotel' })]);

class Health {
  ok(): { ok: boolean } {
    return { ok: true };
  }
}
Controller()(Health);
decorate(Health.prototype, 'ok', [Get('health')]);

class VersionedHotels {
  one(): { locality: string } {
    return { locality: 'Paris' };
  }
}
Controller({ path: 'hotels', version: '1' })(VersionedHotels);
decorate(VersionedHotels.prototype, 'one', [Get(':id'), ApiversaRoute({ response: 'Hotel' })]);

async function expressApp(av: Apiversa, versioned = false) {
  const moduleRef = await Test.createTestingModule({
    imports: [ApiversaModule.forRoot(av)],
    controllers: versioned ? [VersionedHotels] : [Hotels, Health],
  }).compile();
  const app = moduleRef.createNestApplication();
  if (versioned) app.enableVersioning({ type: VersioningType.URI });
  await app.init();
  return app;
}

async function fastifyApp(av: Apiversa) {
  const moduleRef = await Test.createTestingModule({
    imports: [ApiversaModule.forRoot(av)],
    controllers: [Hotels, Health],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('nest adapter', () => {
  it('downgrades on Express and leaves undecorated routes alone', async () => {
    const app = await expressApp(bundle());
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const old = await request(server).get('/hotels/h_1').set('Api-Version', '2026-01-15');
    expect(old.status).toBe(200);
    expect(old.body).toEqual({ city: 'Paris' });
    expect(old.headers['apiversa-trace']).toBe('2026-03-01.rename-city');
    const head = await request(server).get('/hotels/h_1').set('Api-Version', '2026-03-01');
    expect(head.body).toEqual({ locality: 'Paris' });
    const health = await request(server).get('/health').set('Api-Version', '2026-01-15');
    expect(health.body).toEqual({ ok: true });
    const posted = await request(server).post('/hotels').set('Api-Version', '2026-01-15').send({ city: 'Paris' });
    expect(posted.body).toEqual({ city: 'Paris' });
    const missing = await request(server).get('/hotels/missing').set('Api-Version', '2026-01-15');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: 'missing' });
    const text = await request(server).get('/hotels/text').set('Api-Version', '2026-01-15');
    expect(text.text).toContain('plain');
    const numbered = await request(server).get('/hotels/numbered').set('Api-Version', '2026-01-15');
    expect(numbered.body).toEqual({ code: 1, city: 'Paris' });
    const unknown = await request(server).get('/hotels/h_1').set('Api-Version', '2026-02-01');
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('AV-E002');
    await app.close();
  });

  it('downgrades on Fastify', async () => {
    const app = await fastifyApp(bundle());
    const old = await app.inject({ method: 'GET', url: '/hotels/h_1', headers: { 'Api-Version': '2026-01-15' } });
    expect(old.statusCode).toBe(200);
    expect(old.json()).toEqual({ city: 'Paris' });
    expect(old.headers['apiversa-trace']).toBe('2026-03-01.rename-city');
    const head = await app.inject({ method: 'GET', url: '/hotels/h_1', headers: { 'api-version': '2026-03-01' } });
    expect(head.json()).toEqual({ locality: 'Paris' });
    const health = await app.inject({ method: 'GET', url: '/health', headers: { 'Api-Version': '2026-01-15' } });
    expect(health.json()).toEqual({ ok: true });
    const posted = await app.inject({ method: 'POST', url: '/hotels', headers: { 'Api-Version': '2026-01-15', 'content-type': 'application/json' }, payload: { city: 'Paris' } });
    expect(posted.json()).toEqual({ city: 'Paris' });
    const missing = await app.inject({ method: 'GET', url: '/hotels/missing', headers: { 'Api-Version': '2026-01-15' } });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ message: 'missing' });
    await app.close();
  });

  it('runs next to Nest URI versioning', async () => {
    const app = await expressApp(bundle(), true);
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const old = await request(server).get('/v1/hotels/h_1').set('Api-Version', '2026-01-15');
    expect(old.status).toBe(200);
    expect(old.body).toEqual({ city: 'Paris' });
    await app.close();
  });

  it('returns 500 when the host resolver throws', async () => {
    const app = await expressApp(bundle(() => {
      throw new Error('boom');
    }));
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/hotels/h_1');
    expect(response.status).toBe(500);
    await app.close();
  });

  it('writes the error envelope on each reply shape', async () => {
    const av = bundle();
    const interceptor = new ApiversaInterceptor(av);
    const handler = function hotel() {
      return { locality: 'Paris' };
    };
    ApiversaRoute({ response: 'Hotel' })(handler, 'hotel', Object.getOwnPropertyDescriptor(handler, 'hotel') ?? { value: handler });
    const seen: string[] = [];
    const replies = [
      { code(status: number) { seen.push(`code:${status}`); }, setHeader(name: string, value: string) { seen.push(`${name}:${value}`); } },
      { status(status: number) { seen.push(`status:${status}`); }, header(name: string, value: string) { seen.push(`${name}:${value}`); } },
      { statusCode: 200 },
    ];
    for (const res of replies) {
      const value = await lastValueFrom(interceptor.intercept(fake(handler, { headers: { 'Api-Version': '2020-01-01' }, method: 'GET', path: '/hotels/h_1' }, res), { handle: () => of({ locality: 'Paris' }) }));
      expect((value as { error: { code: string } }).error.code).toBe('AV-E012');
    }
    expect(seen.some((line) => line.startsWith('code:'))).toBe(true);
    expect(seen.some((line) => line.startsWith('status:'))).toBe(true);
    expect(seen.some((line) => line.startsWith('Link:'))).toBe(true);
    const query = await lastValueFrom(interceptor.intercept(fake(handler, { headers: { 'Api-Version': '2026-01-15' }, method: 'GET', originalUrl: '/hotels/h_1?city=Paris' }, { statusCode: 200, setHeader() {} }), { handle: () => of({ locality: 'Paris' }) }));
    expect(query).toEqual({ city: 'Paris' });
    const urlOnly = await lastValueFrom(interceptor.intercept(fake(handler, { headers: { 'Api-Version': '2026-01-15' }, method: 'GET', url: '/hotels/h_1' }, { statusCode: 200, setHeader() {} }), { handle: () => of({ locality: 'Paris' }) }));
    expect(urlOnly).toEqual({ city: 'Paris' });
    const bare = await lastValueFrom(interceptor.intercept(fake(handler, { headers: { 'Api-Version': '2026-03-01' }, method: 'GET' }, { setHeader() {} }), { handle: () => of({ locality: 'Paris' }) }));
    expect(bare).toEqual({ locality: 'Paris' });
    const emptyBody = await lastValueFrom(interceptor.intercept(fake(handler, { headers: { 'Api-Version': '2026-01-15' }, method: 'GET', path: '/hotels/h_1' }, { statusCode: 200, setHeader() {} }), { handle: () => of(null) }));
    expect(emptyBody).toBeNull();
    const stringError = await lastValueFrom(interceptor.intercept(fake(handler, { headers: { 'Api-Version': '2026-01-15' }, method: 'GET', path: '/hotels/h_1' }, { statusCode: 200, header() {} }), { handle: () => throwError(() => new HttpException('gone', 404)) })).catch((error: unknown) => error);
    expect(stringError).toEqual({ message: 'gone' });
    await expect(lastValueFrom(interceptor.intercept(fake(handler, { headers: { 'Api-Version': '2026-01-15' }, method: 'GET', path: '/hotels/h_1' }, {}), { handle: () => throwError(() => new Error('boom')) }))).rejects.toThrow('boom');
    const passed = await lastValueFrom(interceptor.intercept(fake(function plain() { return { ok: true }; }, { headers: {}, method: 'GET', path: '/health' }, {}), { handle: () => of({ ok: true }) }));
    expect(passed).toEqual({ ok: true });
    const posted = await lastValueFrom(interceptor.intercept(fake(Hotels.prototype.create as unknown as () => void, { headers: { 'Api-Version': '2026-01-15' }, method: 'POST', path: '/hotels', body: { city: 'Paris' } }, { statusCode: 200, setHeader() {} }), { handle: () => of({ locality: 'Paris' }) }));
    expect(posted).toEqual({ city: 'Paris' });
    const headPost = await lastValueFrom(interceptor.intercept(fake(Hotels.prototype.create as unknown as () => void, { headers: { 'Api-Version': '2026-03-01' }, method: 'POST', path: '/hotels', body: { locality: 'Paris' } }, { setHeader() {} }), { handle: () => of({ locality: 'Paris' }) }));
    expect(headPost).toEqual({ locality: 'Paris' });
    const noBody = await lastValueFrom(interceptor.intercept(fake(Hotels.prototype.create as unknown as () => void, { headers: { 'Api-Version': '2026-01-15' }, method: 'POST', path: '' }, { statusCode: 200, setHeader() {} }), { handle: () => of({ locality: 'Paris' }) }));
    expect(noBody).toEqual({ city: 'Paris' });
    const quiet = new ApiversaInterceptor(bundle(undefined, false));
    const untraced = await lastValueFrom(quiet.intercept(fake(handler, { headers: { 'Api-Version': '2026-01-15' }, method: 'GET', path: '/hotels/h_1' }, { statusCode: 200 }), { handle: () => of({ locality: 'Paris' }) }));
    expect(untraced).toEqual({ city: 'Paris' });
    const req = { headers: { 'Api-Version': '2026-01-15' }, method: 'POST', path: '/hotels', body: { city: 'Paris' } as unknown };
    function take() { return req.body; }
    ApiversaRoute({ body: 'Hotel' })(take, 'take', { value: take, writable: true, configurable: true, enumerable: false });
    const upgraded = await lastValueFrom(interceptor.intercept(fake(take, req, {}), { handle: () => of(req.body) }));
    expect(req.body).toEqual({ locality: 'Paris' });
    expect(upgraded).toEqual({ locality: 'Paris' });
  });
});

function fake(handler: object, req: Record<string, unknown>, res: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Hotels,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res, getNext: () => undefined }),
  } as unknown as ExecutionContext;
}
