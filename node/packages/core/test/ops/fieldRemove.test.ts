import { describe, expect, it } from 'vitest';
import { runOp } from '../helpers.js';

describe('field.remove', () => {
  const op = { op: 'field.remove', schema: 'Hotel', path: 'legacyRating', default: null };

  it('deletes on the way up, including null, and restores default when absent', () => {
    expect(runOp(op, { legacyRating: 4 }, 'up')).toEqual({});
    expect(runOp(op, { legacyRating: null }, 'up')).toEqual({});
    expect(runOp(op, {}, 'up')).toEqual({});
    expect(runOp(op, {}, 'down')).toEqual({ legacyRating: null });
    expect(runOp(op, { legacyRating: null }, 'down')).toEqual({ legacyRating: null });
  });
});
