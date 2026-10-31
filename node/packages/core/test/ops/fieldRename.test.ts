import { describe, expect, it } from 'vitest';
import { runOp } from '../helpers.js';

describe('field.rename', () => {
  it('renames on the way up and back on the way down', () => {
    const op = { op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality' };
    expect(runOp(op, { city: 'Paris' }, 'up')).toEqual({ locality: 'Paris' });
    expect(runOp(op, { locality: 'Paris' }, 'down')).toEqual({ city: 'Paris' });
    expect(runOp(op, { locality: null }, 'down')).toEqual({ city: null });
    expect(runOp(op, {}, 'up')).toEqual({});
    expect(runOp(op, runOp(op, { city: 'Paris' }, 'up'), 'down')).toEqual({ city: 'Paris' });
  });

  it('renames every array item', () => {
    const op = { op: 'field.rename', schema: 'Hotel', from: 'rooms[].city', to: 'rooms[].locality' };
    expect(runOp(op, { rooms: [{ city: 'A' }, { city: null }, {}] }, 'up')).toEqual({ rooms: [{ locality: 'A' }, { locality: null }, {}] });
  });
});
