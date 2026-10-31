import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../src/bundle/load.js';
import { execute } from '../../src/chain/run.js';

function run(op: Record<string, unknown>, query: { name: string; value: string }[], direction: 'up' | 'down' = 'up') {
  const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
  const change = { version: '2026-03-01', id: 'query-change', description: 'Query change for the unit test.', changes: [op] };
  const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: { Hotel: {} } });
  return execute(bundle, { schema: 'Hotel', version: '2026-01-15', query, trace: false }, direction).query;
}

describe('query.rename', () => {
  it('renames and keeps repeated parameters in order', () => {
    const op = { op: 'query.rename', method: 'GET', path: '/hotels', from: 'town', to: 'city' };
    expect(run(op, [{ name: 'town', value: 'x' }, { name: 'town', value: 'y' }])).toEqual([
      { name: 'city', value: 'x' },
      { name: 'city', value: 'y' },
    ]);
    expect(run(op, [{ name: 'city', value: 'x' }], 'down')).toEqual([{ name: 'city', value: 'x' }]);
  });
});
