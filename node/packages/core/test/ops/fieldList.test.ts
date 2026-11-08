import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../src/bundle/load.js';
import { runOp } from '../helpers.js';

const op = { op: 'field.list', schema: 'Hotel', from: 'city', to: 'cities' };

describe('field.list', () => {
  it('wraps one value on the way up and unwraps that array on the way down', () => {
    expect(runOp(op, { city: 'Paris' }, 'up', ['cities'])).toEqual({ cities: ['Paris'] });
    expect(runOp(op, { cities: ['Paris'] }, 'down', ['city'])).toEqual({ city: 'Paris' });
  });

  it('returns AV-E023 when the array length is not 1', () => {
    expect(() => runOp(op, { cities: ['Paris', 'Lyon'] }, 'down')).toThrow(expect.objectContaining({ code: 'AV-E023', status: 500, message: 'List length is not 1.' }));
    expect(() => runOp(op, { city: 'Paris', cities: ['Lyon'] }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E020', status: 400 }));
  });

  it('CORE-34 refuses inventing a second element', () => {
    const body = runOp(op, { city: 'Paris' }, 'up', ['cities']) as { cities: string[] };
    expect(body.cities).toEqual(['Paris']);
  });

  it('CORE-34 refuses dropping extra elements', () => {
    expect(() => runOp(op, { cities: ['Paris', 'Lyon'] }, 'down')).toThrow(expect.objectContaining({ code: 'AV-E023' }));
  });

  it('CORE-34 refuses calling the network', () => {
    expect(runOp(op, { city: 'Paris' }, 'up', ['cities'])).toEqual({ cities: ['Paris'] });
  });

  it('rejects the same path at startup', () => {
    expect(() =>
      buildBundle(
        { head: '2026-03-01', default: 'oldest', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] },
        [{ version: '2026-03-01', id: 'list-city', description: 'city became a list.', changes: [{ op: 'field.list', schema: 'Hotel', from: 'city', to: 'city' }] }],
        { today: '2026-10-30', registry: { Hotel: {} } },
      ),
    ).toThrow(expect.objectContaining({ code: 'AV-E001' }));
  });

  it('leaves a missing side alone and rejects a value that is not an array', () => {
    expect(runOp(op, {}, 'up', ['city', 'cities'])).toEqual({});
    expect(runOp(op, {}, 'down', ['city', 'cities'])).toEqual({});
    expect(() => runOp(op, { city: 'Paris', cities: ['Lyon'] }, 'down')).toThrow(expect.objectContaining({ code: 'AV-E020', status: 500 }));
    expect(() => runOp(op, { cities: 'Paris' }, 'down')).toThrow(expect.objectContaining({ code: 'AV-E023' }));
  });
});
