import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';
import { openApiVersions } from '../src/cli/openapi.js';
import { ApiversaError } from '../src/errors.js';
import { endpointDeprecationHeaders } from '../src/lifecycle.js';

const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };

describe('route-level ops', () => {
  it('leaves the method alone on a head request', () => {
    const change = {
      version: '2026-03-01',
      id: 'method-search',
      description: 'POST /search became GET /search.',
      changes: [{ op: 'endpoint.method', path: '/search', from: 'POST', to: 'GET' }],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: {} });
    expect(execute(bundle, { version: '2026-03-01', method: 'POST', path: '/search', trace: false }, 'up').method).toBe('POST');
  });

  it('moves a body field to a query parameter and to a header', () => {
    const change = {
      version: '2026-03-01',
      id: 'move-body',
      description: 'Body fields moved out of the document.',
      changes: [
        { op: 'param.move', method: 'GET', path: '/hotels', from: 'body:hotelId', to: 'query:hotelId' },
        { op: 'param.move', method: 'GET', path: '/hotels', from: 'body:trace', to: 'header:X-Trace' },
      ],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: { Hotel: { fields: [{ name: 'hotelId' }, { name: 'trace' }] } } });
    const moved = execute(bundle, { schema: 'Hotel', version: '2026-01-15', method: 'GET', path: '/hotels', body: { hotelId: 'h_1', trace: true }, trace: false }, 'up');
    expect(moved.query).toEqual([{ name: 'hotelId', value: 'h_1' }]);
    expect(moved.headers).toEqual([{ name: 'X-Trace', value: 'true' }]);
    expect(moved.body).toEqual({});
  });

  it('rejects a target that already has a different value', () => {
    const change = {
      version: '2026-03-01',
      id: 'move-conflict',
      description: 'Hotel id moved to the query.',
      changes: [{ op: 'param.move', method: 'GET', path: '/hotels/:hotelId', from: 'path:hotelId', to: 'query:hotelId' }],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: {} });
    expect(() => execute(bundle, { version: '2026-01-15', method: 'GET', path: '/hotels/h_1', query: [{ name: 'hotelId', value: 'other' }], trace: false }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E017', message: 'Parameter target is already set.' }));
    expect(new ApiversaError('AV-E017', 'up').status).toBe(400);
  });

  it('sends route deprecation headers on an old version and on head', () => {
    const change = {
      version: '2026-03-01',
      id: 'deprecate-search',
      description: 'GET /search is deprecated.',
      changes: [{ op: 'endpoint.deprecate', method: 'GET', path: '/search', sunset: '2026-06-01', docs: '/docs/search' }],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: {} });
    const names = (version: string) => endpointDeprecationHeaders(bundle, version, 'GET', '/search').map((header) => header.name);
    expect(names('2026-01-15')).toEqual(['Deprecation', 'Sunset', 'Link']);
    expect(names('2026-03-01')).toEqual(['Deprecation', 'Sunset', 'Link']);
    expect(execute(bundle, { version: '2026-01-15', method: 'GET', path: '/search', body: { city: 'Paris' }, trace: false }, 'down').body).toEqual({ city: 'Paris' });
  });

  it('marks OpenAPI deprecated only at or after the change', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-depr-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.deprecate.yaml'), 'version: "2026-03-01"\nid: deprecate-search\ndescription: "GET /search is deprecated."\nchanges:\n  - op: endpoint.deprecate\n    method: GET\n    path: /search\n');
    const head = { openapi: '3.1.0', paths: { '/search': { get: { responses: { '200': { description: 'ok' } } } } } };
    const docs = openApiVersions(dir, head, '2026-10-31');
    expect((docs['2026-01-15']?.paths?.['/search']?.get as { deprecated?: boolean }).deprecated).toBeUndefined();
    expect((docs['2026-03-01']?.paths?.['/search']?.get as { deprecated?: boolean }).deprecated).toBe(true);
  });
});
