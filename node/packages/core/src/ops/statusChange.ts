import type { Direction } from '../errors.js';
import type { RawOp } from '../model.js';

/** Map the head status back to the old status on the way down. */
export function statusChange(status: number | undefined, op: RawOp, when: Direction): number | undefined {
  if (when !== 'down' || status === undefined || op.to === undefined || op.from === undefined) return status;
  if (status === Number(op.to)) return Number(op.from);
  return status;
}
