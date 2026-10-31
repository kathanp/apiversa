import { describe, expect, it } from 'vitest';
import { runOp } from '../helpers.js';

describe('enum.add', () => {
  const op = { op: 'enum.add', schema: 'Hotel', path: 'status', value: 'waitlisted', fallback: 'pending' };

  it('maps the new member on the way down and leaves null', () => {
    expect(runOp(op, { status: 'waitlisted' }, 'down')).toEqual({ status: 'pending' });
    expect(runOp(op, { status: 'pending' }, 'down')).toEqual({ status: 'pending' });
    expect(runOp(op, { status: null }, 'down')).toEqual({ status: null });
    expect(runOp(op, {}, 'down')).toEqual({});
    expect(runOp(op, { status: 'waitlisted' }, 'up')).toEqual({ status: 'waitlisted' });
  });
});
