import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../src/bundle/load.js';
import { execute } from '../../src/chain/run.js';

function run(op: Record<string, unknown>, query: { name: string; value: string }[]) {
  const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
  const change = { version: '2026-03-01', id: 'query-add', description: 'Query add for the unit test.', changes: [op] };
  const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: { Hotel: {} } });
  return execute(bundle, { schema: 'Hotel', version: '2026-01-15', query, trace: false }, 'up').query;
}

describe('query.add', () => {
  const op = { op: 'query.add', method: 'GET', path: '/hotels', name: 'guestCount', default: '1' };

  it('fills a missing parameter and keeps an empty value', () => {
    expect(run(op, [])).toEqual([{ name: 'guestCount', value: '1' }]);
    expect(run(op, [{ name: 'guestCount', value: '' }])).toEqual([{ name: 'guestCount', value: '' }]);
  });
});
