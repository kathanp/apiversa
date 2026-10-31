import { describe, expect, it } from 'vitest';
import { ApiversaError } from '../../src/errors.js';
import { runOp } from '../helpers.js';

describe('object.wrap', () => {
  const op = { op: 'object.wrap', schema: 'Hotel', fields: ['amount', 'currency'], into: 'price' };

  it('wraps present fields, keeps null, and round-trips', () => {
    expect(runOp(op, { amount: 89, currency: 'USD' }, 'up')).toEqual({ price: { amount: 89, currency: 'USD' } });
    expect(runOp(op, { amount: null }, 'up')).toEqual({ price: { amount: null } });
    expect(runOp(op, {}, 'up')).toEqual({ price: {} });
    const up = runOp(op, { amount: 89, currency: 'USD' }, 'up');
    expect(runOp(op, up, 'down')).toEqual({ amount: 89, currency: 'USD' });
  });

  it('refuses a null wrapper on the way down', () => {
    expect(() => runOp(op, { price: null }, 'down')).toThrow(expect.objectContaining({ code: 'AV-E016' }));
    expect(() => runOp(op, { price: null }, 'down')).toThrow(ApiversaError);
  });
});
