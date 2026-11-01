import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { clientField, clientValidation } from '../src/clientField.js';

const versions = {
  head: '2026-03-01',
  default: 'oldest',
  versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }],
};

const change = {
  version: '2026-03-01',
  id: 'reshape',
  description: 'Rename, move, and add fields.',
  changes: [
    { op: 'field.rename', schema: 'Hotel', from: 'town', to: 'city' },
    { op: 'field.move', schema: 'Hotel', from: 'location.city', to: 'address.city' },
    { op: 'field.rename', schema: 'Hotel', from: 'guests[].fullName', to: 'guests[].name' },
    { op: 'field.add', schema: 'Hotel', path: 'nickname', default: '' },
  ],
};

describe('validation errors in the client version', () => {
  const bundle = buildBundle(versions, [change], { today: '2026-10-31', registry: { Hotel: {} } });

  it('maps a rename, a move, a nested array, and a head-only field', () => {
    expect(clientField(bundle, '2026-01-15', 'Hotel', 'city')).toEqual({ field: 'town' });
    expect(clientField(bundle, '2026-01-15', 'Hotel', 'address.city')).toEqual({ field: 'location.city' });
    expect(clientField(bundle, '2026-01-15', 'Hotel', 'guests[0].name')).toEqual({ field: 'guests[0].fullName' });
    expect(clientField(bundle, '2026-01-15', 'Hotel', 'nickname')).toEqual({ field: '_head', headPath: 'nickname' });
    expect(clientField(bundle, '2026-03-01', 'Hotel', 'city')).toEqual({ field: 'city' });
    expect(clientField(bundle, '2026-01-15', 'Hotel', 'other')).toEqual({ field: 'other' });
    const rejected = clientValidation(bundle, '2026-01-15', 'Hotel', { nickname: 1 }, {
      safeParse: () => ({ success: false, error: { issues: [{ path: ['nickname'], message: 'bad' }, { path: ['guests', 0, 'name'], message: 'required' }] } }),
    });
    expect(rejected).toEqual([
      { field: '_head', path: 'nickname', message: 'bad' },
      { field: 'guests[0].fullName', message: 'required' },
    ]);
    expect(clientValidation(bundle, '2026-01-15', 'Hotel', {}, { safeParse: () => ({ success: true }) })).toBeUndefined();
    expect(clientValidation(bundle, '2026-01-15', 'Hotel', {}, { safeParse: () => ({ success: false }) })).toEqual([]);
  });
});
