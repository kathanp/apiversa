import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';
import { api } from '../src/create.js';
import { ApiversaError } from '../src/errors.js';

describe('chains, limits, and the head path', () => {
  it('applies same-date files in id order and reverses them on the way down', () => {
    const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const rename = { version: '2026-03-01', id: 'a-rename', description: 'Rename city.', changes: [{ op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality' }] };
    const add = { version: '2026-03-01', id: 'b-add', description: 'Add city back.', changes: [{ op: 'field.add', schema: 'Hotel', path: 'city', default: 'unset' }] };
    const bundle = buildBundle(versions, [add, rename], { today: '2026-10-30', registry: { Hotel: { fields: [{ name: 'locality' }, { name: 'city' }] } } });
    expect(execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: { city: 'Paris' }, trace: false }, 'up').body).toEqual({ locality: 'Paris', city: 'unset' });
  });

  it('does not parse a head body', () => {
    const versions = { head: '2026-03-01', versions: [{ date: '2026-03-01' }] };
    const change = { version: '2026-03-01', id: 'rename', description: 'Rename.', changes: [{ op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality' }] };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: { Hotel: {} } });
    const body = { city: 'Paris' };
    const av = api(bundle, { header: 'Api-Version', development: false, trace: false });
    expect(av.convertResponse({ schema: 'Hotel', version: '2026-03-01', body })).toBe(body);
    expect(av.planIsEmpty('2026-03-01', 'Hotel', 'down')).toBe(true);
  });

  it('drops pollution keys and rejects duplicate keys, unsafe integers, and oversized arrays', () => {
    const versions = { head: '2026-03-01', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = { version: '2026-03-01', id: 'touch', description: 'Touch id.', changes: [{ op: 'field.add', schema: 'Hotel', path: 'id', default: 'missing' }] };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: { Hotel: { fields: [{ name: 'id' }] } }, limits: { maxBodyBytes: 1024 * 1024, maxArrayItems: 2 } });
    expect(execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: { id: 'h_1', __proto__: { polluted: true } }, trace: false }, 'up').body).toEqual({ id: 'h_1' });
    expect(() => execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: '{"id":"h_1","id":"h_2"}', trace: false }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E015' }));
    expect(() => execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: '{"id":"h_1","n":9007199254740992}', trace: false }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E014' }));
    expect(() => execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: { id: 'h', items: [1, 2, 3] }, trace: false }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E009' }));
  });

  it('refuses a 33-segment path at startup', () => {
    const path = Array.from({ length: 33 }, () => 'a').join('.');
    const versions = { head: '2026-03-01', versions: [{ date: '2026-03-01' }] };
    const change = { version: '2026-03-01', id: 'deep', description: 'Too deep.', changes: [{ op: 'field.rename', schema: 'Hotel', from: path, to: 'b' }] };
    expect(() => buildBundle(versions, [change], { today: '2026-10-30', registry: { Hotel: {} } })).toThrow(expect.objectContaining({ code: 'AV-E004' }));
  });

  it('converts one Hotel change inside a booking and an array', () => {
    const versions = { head: '2026-03-01', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = { version: '2026-03-01', id: 'rename', description: 'Rename city.', changes: [{ op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality' }] };
    const bundle = buildBundle(versions, [change], {
      today: '2026-10-30',
      registry: { Hotel: {}, Booking: { fields: [{ name: 'hotel', schema: 'Hotel' }] } },
    });
    expect(execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: [{ city: 'Paris' }], trace: false }, 'up').body).toEqual([{ locality: 'Paris' }]);
    expect(execute(bundle, { schema: 'Booking', version: '2026-01-15', body: { hotel: { city: 'Paris' } }, trace: false }, 'up').body).toEqual({ hotel: { locality: 'Paris' } });
  });
});

void ApiversaError;
