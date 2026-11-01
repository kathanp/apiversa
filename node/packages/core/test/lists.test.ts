import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';

describe('lists and pagination', () => {
  it('converts a top-level array and a page item by item and leaves next_cursor', () => {
    const versions = { head: '2026-03-01', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = { version: '2026-03-01', id: 'rename-city', description: 'Hotel.city renamed to locality.', changes: [{ op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality' }] };
    const registry = { Page: { fields: [{ name: 'data', items: 'Hotel' }, { name: 'next_cursor' }] }, Hotel: {} };
    const bundle = buildBundle(versions, [change], { today: '2026-10-31', registry });
    expect(execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: [{ city: 'Paris' }, { city: 'Lyon' }], trace: false }, 'up').body).toEqual([{ locality: 'Paris' }, { locality: 'Lyon' }]);
    expect(execute(bundle, { schema: 'Page', version: '2026-01-15', body: { data: [{ city: 'Paris' }], next_cursor: 'c1' }, trace: false }, 'down').body).toEqual({ data: [{ city: 'Paris' }], next_cursor: 'c1' });
    const down = execute(bundle, { schema: 'Page', version: '2026-01-15', body: { data: [{ locality: 'Paris' }], next_cursor: 'c1' }, trace: false }, 'down');
    expect(down.body).toEqual({ data: [{ city: 'Paris' }], next_cursor: 'c1' });
  });
});
