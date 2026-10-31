import { describe, expect, it } from 'vitest';
import { ApiversaError } from '../../src/errors.js';
import { runOp } from '../helpers.js';

describe('field.type', () => {
  const op = {
    op: 'field.type',
    schema: 'Hotel',
    path: 'price',
    down: { from: 'price.amount' },
    up: { value: { amount: '$.price', currency: 'USD' } },
  };

  it('replaces the field from the expression and is a no-op when absent', () => {
    expect(runOp(op, { price: { amount: 89, currency: 'USD' } }, 'down')).toEqual({ price: 89 });
    expect(runOp(op, { price: 89 }, 'up')).toEqual({ price: { amount: 89, currency: 'USD' } });
    expect(runOp(op, { name: 'Bay' }, 'down')).toEqual({ name: 'Bay' });
  });

  it('refuses a read through the wrong shape', () => {
    expect(() => runOp(op, { price: 89 }, 'down')).toThrow(expect.objectContaining({ code: 'AV-E016' }));
    try {
      runOp(op, { price: 89 }, 'down');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiversaError);
      expect((error as ApiversaError).message).toBe('Expression could not be read.');
    }
  });
});
