import { describe, expect, it } from 'vitest';
import { ApiversaError } from '../../src/errors.js';
import { fromPlain } from '../../src/json/parse.js';
import type { Change } from '../../src/model.js';
import { moveParam, type MoveInput } from '../../src/ops/paramMove.js';

const rename: Change = {
  version: '2026-03-01',
  id: 'rename-route',
  description: 'Hotel path changed.',
  ops: [{ op: 'endpoint.rename', from: '/hotels/:id', to: '/places/:id', method: 'GET' }],
};

function input(overrides: Partial<MoveInput> = {}): MoveInput {
  return {
    op: { op: 'param.move', from: 'query:city', to: 'header:X-City' },
    method: 'GET',
    rewrittenMethod: undefined,
    originalPath: '/hotels',
    path: '/hotels',
    query: [{ name: 'city', value: 'Paris' }],
    headers: [],
    body: undefined,
    changes: [],
    ...overrides,
  };
}

describe('param.move', () => {
  it('moves a query value onto a header and refuses a bad location', () => {
    const moved = moveParam(input());
    expect(moved.headers).toEqual([{ name: 'X-City', value: 'Paris' }]);
    expect(moved.query).toEqual([]);
    expect(() => moveParam(input({ op: { op: 'param.move', from: 'nope', to: 'query:city' } }))).toThrow(ApiversaError);
    const skipped = moveParam(input({ op: { op: 'param.move', from: 'query:city', to: 'header:X-City', method: 'POST' } }));
    expect(skipped.headers).toEqual([]);
    const same = moveParam(input({ op: { op: 'param.move', from: 'query:city', to: 'query:city' } }));
    expect(same.query).toEqual([{ name: 'city', value: 'Paris' }]);
  });

  it('moves body scalars and arrays onto the query string', () => {
    const flag = moveParam(input({
      op: { op: 'param.move', from: 'body:ok', to: 'query:ok' },
      query: [],
      body: fromPlain({ ok: true }, 'up'),
    }));
    expect(flag.query).toEqual([{ name: 'ok', value: 'true' }]);
    const tags = moveParam(input({
      op: { op: 'param.move', from: 'body:tags', to: 'query:tag' },
      query: [],
      body: fromPlain({ tags: ['a', 'b'] }, 'up'),
    }));
    expect(tags.query.map((pair) => pair.value)).toEqual(['a', 'b']);
    expect(() => moveParam(input({
      op: { op: 'param.move', from: 'body:tags', to: 'header:X-Tag' },
      query: [],
      body: fromPlain({ tags: ['a'] }, 'up'),
    }))).toThrow(expect.objectContaining({ code: 'AV-E016' }));
    expect(() => moveParam(input({
      op: { op: 'param.move', from: 'body:tags', to: 'query:tag' },
      query: [],
      body: fromPlain({ tags: [{ id: 1 }] }, 'up'),
    }))).toThrow(expect.objectContaining({ code: 'AV-E016' }));
  });

  it('writes a path segment through an endpoint rename and refuses a conflicting value', () => {
    const written = moveParam(input({
      op: { op: 'param.move', from: 'query:id', to: 'path:id', path: '/hotels/:id' },
      originalPath: '/hotels/1',
      path: '/hotels',
      query: [{ name: 'id', value: '9' }],
      changes: [rename],
    }));
    expect(written.path).toBe('/hotels/9');
    expect(() => moveParam(input({
      op: { op: 'param.move', from: 'query:id', to: 'path:id', path: '/hotels/:id' },
      originalPath: '/hotels/1',
      path: '/hotels/1',
      query: [{ name: 'id', value: '9' }],
      changes: [rename],
    }))).toThrow(expect.objectContaining({ code: 'AV-E017' }));
    expect(() => moveParam(input({
      op: { op: 'param.move', from: 'query:city', to: 'header:X-City' },
      headers: [{ name: 'x-city', value: 'Lyon' }],
    }))).toThrow(expect.objectContaining({ code: 'AV-E017' }));
    const matched = moveParam(input({
      op: { op: 'param.move', from: 'header:X-City', to: 'header:x-city' },
      query: [],
      headers: [{ name: 'X-City', value: 'Paris' }],
    }));
    expect(matched.headers).toEqual([{ name: 'X-City', value: 'Paris' }]);
    expect(() => moveParam(input({
      op: { op: 'param.move', from: 'query:id', to: 'body:id' },
      query: [{ name: 'id', value: '9' }],
    }))).toThrow(expect.objectContaining({ code: 'AV-E016' }));
    const number = moveParam(input({
      op: { op: 'param.move', from: 'body:count', to: 'query:count' },
      query: [],
      body: fromPlain({ count: 3, flags: [false] }, 'up'),
    }));
    expect(number.query).toEqual([{ name: 'count', value: '3' }]);
    const flags = moveParam(input({
      op: { op: 'param.move', from: 'body:flags', to: 'query:flag' },
      query: [],
      body: fromPlain({ flags: [false, 1] }, 'up'),
    }));
    expect(flags.query.map((pair) => pair.value)).toEqual(['false', '1']);
    const bare = moveParam(input({
      op: { op: 'param.move', from: 'query:id', to: 'path:id', path: '/hotels/:id' },
      originalPath: '/hotels/1',
      path: 'hotels',
      query: [{ name: 'id', value: '9' }],
      changes: [rename],
    }));
    expect(bare.path).toBe('hotels/9');
    const wrongRoute = moveParam(input({
      op: { op: 'param.move', from: 'query:city', to: 'header:X-City', path: '/other/:id' },
      originalPath: '/hotels/1',
    }));
    expect(wrongRoute.headers).toEqual([]);
  });
});
