import { describe, expect, it } from 'vitest';
import { fromPlain, toPlain } from '../../src/json/parse.js';
import type { Change } from '../../src/model.js';
import { applyPrefix, type PrefixState } from '../../src/ops/prefix.js';

const endpoint: Change = {
  version: '2026-03-01',
  id: 'route',
  description: 'Hotel route.',
  ops: [{ op: 'endpoint.deprecate', path: '/hotels/:id', method: 'GET' }],
};

function state(body?: unknown): PrefixState {
  return { path: '/hotels/1', query: [{ name: 'q', value: '1' }, { name: 'other', value: 'x' }], body: body === undefined ? undefined : fromPlain(body, 'up') };
}

describe('value.prefix', () => {
  it('prefixes a query value on the way up and leaves it on the way down', () => {
    const up = state();
    applyPrefix(up, { op: 'value.prefix', target: 'query:q', prefix: 'p' }, 'up', []);
    expect(up.query).toEqual([{ name: 'q', value: 'p1' }, { name: 'other', value: 'x' }]);
    const down = state();
    applyPrefix(down, { op: 'value.prefix', target: 'query:q', prefix: 'p' }, 'down', []);
    expect(down.query[0]?.value).toBe('1');
    const ignored = state();
    applyPrefix(ignored, { op: 'value.prefix', target: 'nope' }, 'up', []);
    expect(ignored.query[0]?.value).toBe('1');
  });

  it('rewrites a path segment when an endpoint pattern names it', () => {
    const up = state();
    applyPrefix(up, { op: 'value.prefix', target: 'path:id', prefix: 'h_' }, 'up', [endpoint]);
    expect(up.path).toBe('/hotels/h_1');
    const missing = state();
    applyPrefix(missing, { op: 'value.prefix', target: 'path:missing', prefix: 'h_' }, 'up', [endpoint]);
    expect(missing.path).toBe('/hotels/1');
    const down = state();
    applyPrefix(down, { op: 'value.prefix', target: 'path:id', prefix: 'h_' }, 'down', [endpoint]);
    expect(down.path).toBe('/hotels/1');
  });

  it('prefixes body text and numbers, and strips a numeric prefix on the way down', () => {
    const text = state({ code: 'ab' });
    applyPrefix(text, { op: 'value.prefix', target: 'body:code', prefix: 'x-' }, 'up', []);
    expect(toPlain(text.body!, undefined, {})).toEqual({ code: 'x-ab' });
    const number = state({ code: 12 });
    applyPrefix(number, { op: 'value.prefix', target: 'body:code', prefix: 'n' }, 'up', []);
    expect(toPlain(number.body!, undefined, {})).toEqual({ code: 'n12' });
    const stripped = state({ code: 'x-12' });
    applyPrefix(stripped, { op: 'value.prefix', target: 'body:code', prefix: 'x-', numeric: true }, 'down', []);
    expect(toPlain(stripped.body!, undefined, {})).toEqual({ code: 12 });
    const kept = state({ code: 'x-012' });
    applyPrefix(kept, { op: 'value.prefix', target: 'body:code', prefix: 'x-', numeric: true }, 'down', []);
    expect(toPlain(kept.body!, undefined, {})).toEqual({ code: '012' });
    const untouched = state({ code: 'ab' });
    applyPrefix(untouched, { op: 'value.prefix', target: 'body:code', prefix: 'x-' }, 'down', []);
    expect(toPlain(untouched.body!, undefined, {})).toEqual({ code: 'ab' });
    const empty = state(null);
    applyPrefix(empty, { op: 'value.prefix', target: 'body:code', prefix: 'x-' }, 'up', []);
    expect(empty.body).toBeNull();
  });
});
