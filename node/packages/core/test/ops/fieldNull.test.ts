import { describe, expect, it } from 'vitest';
import { runOp } from '../helpers.js';

const op = { op: 'field.null', schema: 'Hotel', path: 'stars' };

describe('field.null', () => {
  it('writes null for an absent key and removes only that null', () => {
    expect(runOp(op, {}, 'up', ['stars'])).toEqual({ stars: null });
    expect(runOp(op, { stars: null }, 'up', ['stars'])).toEqual({ stars: null });
    expect(runOp(op, { stars: null }, 'down', ['stars'])).toEqual({});
    expect(runOp(op, { stars: 0 }, 'up', ['stars'])).toEqual({ stars: 0 });
    expect(runOp(op, { stars: 0 }, 'down', ['stars'])).toEqual({ stars: 0 });
    expect(runOp(op, { stars: false }, 'down', ['stars'])).toEqual({ stars: false });
    expect(runOp(op, { stars: '' }, 'down', ['stars'])).toEqual({ stars: '' });
  });

  it('CORE-35 refuses deleting 0', () => {
    expect(runOp(op, { stars: 0 }, 'down', ['stars'])).toEqual({ stars: 0 });
  });

  it('CORE-35 refuses deleting false', () => {
    expect(runOp(op, { stars: false }, 'down', ['stars'])).toEqual({ stars: false });
  });

  it('CORE-35 refuses deleting an empty string or calling the network', () => {
    expect(runOp(op, { stars: '' }, 'up', ['stars'])).toEqual({ stars: '' });
  });
});
