import { describe, expect, it } from 'vitest';
import { runOp } from '../helpers.js';

describe('field.move', () => {
  const op = { op: 'field.move', schema: 'Hotel', from: 'address.city', to: 'locality' };

  it('moves a nested value and round-trips', () => {
    expect(runOp(op, { address: { city: 'Paris' } }, 'up')).toEqual({ address: {}, locality: 'Paris' });
    expect(runOp(op, {}, 'up')).toEqual({});
    expect(runOp(op, { address: { city: null } }, 'up')).toEqual({ address: {}, locality: null });
    const up = runOp(op, { address: { city: 'Paris' } }, 'up');
    expect(runOp(op, up, 'down')).toEqual({ address: { city: 'Paris' }, locality: undefined } as unknown as { address: { city: string } });
  });
});
