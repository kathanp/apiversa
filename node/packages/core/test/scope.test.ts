import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';
import { ApiversaError } from '../src/errors.js';

const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
const registry = { Hotel: { fields: [{ name: 'city' }, { name: 'id' }] } };

function bundle(changes: Record<string, unknown>[]) {
  return buildBundle(versions, changes, { today: '2026-10-30', registry });
}

describe('op scope, envelopes, and prefixes', () => {
  it('does not rename a request when the op is scoped to the response', () => {
    const av = bundle([{
      version: '2026-03-01',
      id: 'rename-city',
      description: 'city became locality.',
      changes: [{ op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality', scope: { on: 'response' } }],
    }]);
    const up = execute(av, { schema: 'Hotel', version: '2026-01-15', method: 'POST', path: '/hotels', body: { city: 'Paris' }, trace: false }, 'up');
    expect(up.body).toEqual({ city: 'Paris' });
    const down = execute(av, { schema: 'Hotel', version: '2026-01-15', method: 'POST', path: '/hotels', body: { locality: 'Paris' }, trace: false }, 'down');
    expect(down.body).toEqual({ city: 'Paris' });
  });

  it('limits a rename to the listed routes and skips events', () => {
    const av = bundle([{
      version: '2026-03-01',
      id: 'rename-city',
      description: 'city became locality on one route.',
      changes: [{ op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality', scope: { routes: ['GET /hotels/:id'] } }],
    }]);
    const hit = execute(av, { schema: 'Hotel', version: '2026-01-15', method: 'GET', path: '/hotels/h_1', body: { city: 'Paris' }, trace: false }, 'up');
    expect(hit.body).toEqual({ locality: 'Paris' });
    const miss = execute(av, { schema: 'Hotel', version: '2026-01-15', method: 'GET', path: '/rooms/h_1', body: { city: 'Paris' }, trace: false }, 'up');
    expect(miss.body).toEqual({ city: 'Paris' });
    const event = execute(av, { schema: 'Hotel', version: '2026-01-15', body: { city: 'Paris' }, trace: false }, 'up');
    expect(event.body).toEqual({ city: 'Paris' });
  });

  it('rejects an unknown or wildcard route pattern at startup', () => {
    const change = (route: string) => ({
      version: '2026-03-01',
      id: 'rename-city',
      description: 'city became locality.',
      changes: [{ op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality', scope: { routes: [route] } }],
    });
    expect(() => bundle([change('GET /hotels/{id}')])).toThrow(expect.objectContaining({ code: 'AV-E001' }));
    expect(() => bundle([change('GET /hotels/*')])).toThrow(expect.objectContaining({ code: 'AV-E001' }));
  });

  it('unwraps the first page for an older client and leaves head as a page', () => {
    const av = bundle([{
      version: '2026-03-01',
      id: 'page-hotels',
      description: 'Hotel list became a page.',
      changes: [{ op: 'response.envelope', method: 'GET', path: '/hotels', items: 'data', cursorHeader: 'X-Cursor' }],
    }]);
    const page = { data: [{ id: 'h_1' }], next_cursor: 'c1' };
    const old = execute(av, { version: '2026-01-15', method: 'GET', path: '/hotels', body: page, trace: false }, 'down');
    expect(old.body).toEqual([{ id: 'h_1' }]);
    expect(old.headers).toEqual([{ name: 'X-Cursor', value: 'c1' }]);
    const head = execute(av, { version: '2026-03-01', method: 'GET', path: '/hotels', body: page, trace: false }, 'down');
    expect(head.body).toEqual(page);
    expect(head.headers).toEqual([]);
    const dropped = bundle([{
      version: '2026-03-01',
      id: 'page-hotels',
      description: 'Hotel list became a page.',
      changes: [{ op: 'response.envelope', method: 'GET', path: '/hotels', items: 'data' }],
    }]);
    const bare = execute(dropped, { version: '2026-01-15', method: 'GET', path: '/hotels', body: page, trace: false }, 'down');
    expect(bare.body).toEqual([{ id: 'h_1' }]);
    expect(bare.headers).toEqual([]);
    expect(() => execute(av, { version: '2026-01-15', method: 'GET', path: '/hotels', body: { data: 'nope' }, trace: false }, 'down')).toThrow(ApiversaError);
  });

  it('prefixes a path param on the way up and a numeric id on the way down', () => {
    const paths = bundle([{
      version: '2026-03-01',
      id: 'prefix-id',
      description: 'Hotel ids gained a prefix.',
      changes: [
        { op: 'endpoint.deprecate', method: 'GET', path: '/hotels/:id' },
        { op: 'value.prefix', target: 'path:id', prefix: 'h_' },
      ],
    }]);
    const up = execute(paths, { version: '2026-01-15', method: 'GET', path: '/hotels/123', trace: false }, 'up');
    expect(up.path).toBe('/hotels/h_123');
    const ids = bundle([{
      version: '2026-03-01',
      id: 'prefix-id',
      description: 'Hotel ids gained a prefix.',
      changes: [{ op: 'value.prefix', target: 'body:id', prefix: 'h_', numeric: true }],
    }]);
    expect(execute(ids, { schema: 'Hotel', version: '2026-01-15', body: { id: 'h_123' }, trace: false }, 'down').body).toEqual({ id: 123 });
    expect(execute(ids, { schema: 'Hotel', version: '2026-01-15', body: { id: 'x_9' }, trace: false }, 'down').body).toEqual({ id: 'x_9' });
    expect(execute(ids, { schema: 'Hotel', version: '2026-01-15', body: { id: null }, trace: false }, 'down').body).toEqual({ id: null });
    expect(execute(ids, { schema: 'Hotel', version: '2026-01-15', body: {}, trace: false }, 'down').body).toEqual({});
    const query = execute(paths, { version: '2026-01-15', method: 'GET', path: '/hotels/1', query: [{ name: 'id', value: '123' }], trace: false }, 'up');
    expect(query.query).toEqual([{ name: 'id', value: '123' }]);
    const queried = bundle([{
      version: '2026-03-01',
      id: 'prefix-query',
      description: 'Query ids gained a prefix.',
      changes: [{ op: 'value.prefix', target: 'query:id', prefix: 'h_' }],
    }]);
    expect(execute(queried, { version: '2026-01-15', method: 'GET', path: '/hotels', query: [{ name: 'id', value: '123' }], trace: false }, 'up').query).toEqual([{ name: 'id', value: 'h_123' }]);
  });
});
