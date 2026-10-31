import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../src/bundle/load.js';
import { execute } from '../../src/chain/run.js';

describe('query.remove', () => {
  it('drops the named parameter on the way up', () => {
    const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = {
      version: '2026-03-01',
      id: 'query-remove',
      description: 'Query remove for the unit test.',
      changes: [{ op: 'query.remove', method: 'GET', path: '/hotels', name: 'town' }],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: { Hotel: {} } });
    const up = execute(bundle, { schema: 'Hotel', version: '2026-01-15', query: [{ name: 'town', value: 'x' }, { name: 'city', value: 'y' }], trace: false }, 'up');
    expect(up.query).toEqual([{ name: 'city', value: 'y' }]);
    const down = execute(bundle, { schema: 'Hotel', version: '2026-01-15', query: [{ name: 'town', value: 'x' }], trace: false }, 'down');
    expect(down.query).toEqual([{ name: 'town', value: 'x' }]);
  });
});
