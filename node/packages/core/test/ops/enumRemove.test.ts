import { describe, expect, it } from 'vitest';
import { runOp } from '../helpers.js';

describe('enum.remove', () => {
  const op = { op: 'enum.remove', schema: 'Hotel', path: 'status', value: 'hold', replacement: 'pending' };

  it('maps the removed member on the way up', () => {
    expect(runOp(op, { status: 'hold' }, 'up')).toEqual({ status: 'pending' });
    expect(runOp(op, { status: 'pending' }, 'up')).toEqual({ status: 'pending' });
    expect(runOp(op, { status: null }, 'up')).toEqual({ status: null });
    expect(runOp(op, {}, 'up')).toEqual({});
    expect(runOp(op, { status: 'hold' }, 'down')).toEqual({ status: 'hold' });
  });
});
