import { describe, expect, it } from 'vitest';
import { runOp } from '../helpers.js';

describe('enum.rename', () => {
  const op = { op: 'enum.rename', schema: 'Hotel', path: 'status', from: 'open', to: 'available' };

  it('renames both ways and round-trips', () => {
    expect(runOp(op, { status: 'open' }, 'up')).toEqual({ status: 'available' });
    expect(runOp(op, { status: 'available' }, 'down')).toEqual({ status: 'open' });
    expect(runOp(op, { status: null }, 'up')).toEqual({ status: null });
    expect(runOp(op, {}, 'up')).toEqual({});
    expect(runOp(op, runOp(op, { status: 'open' }, 'up'), 'down')).toEqual({ status: 'open' });
  });
});
