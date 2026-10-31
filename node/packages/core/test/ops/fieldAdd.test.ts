import { describe, expect, it } from 'vitest';
import { runOp } from '../helpers.js';

describe('field.add', () => {
  const op = { op: 'field.add', schema: 'Hotel', path: 'guestCount', default: 1 };

  it('fills an absent key and leaves null', () => {
    expect(runOp(op, { id: 'b_1' }, 'up', ['id', 'guestCount'])).toEqual({ id: 'b_1', guestCount: 1 });
    expect(runOp(op, { id: 'b_1', guestCount: null }, 'up', ['id', 'guestCount'])).toEqual({ id: 'b_1', guestCount: null });
    expect(runOp(op, { guestCount: 4 }, 'up')).toEqual({ guestCount: 4 });
  });

  it('round-trips absent and null', () => {
    expect(runOp(op, runOp(op, { id: 'b_1' }, 'up'), 'down')).toEqual({ id: 'b_1' });
    expect(runOp(op, runOp(op, { guestCount: null }, 'up'), 'down')).toEqual({ guestCount: null });
  });
});
