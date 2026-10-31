import type { Direction } from '../errors.js';
import type { QueryPair, RawOp } from '../model.js';

export function queryRemove(query: QueryPair[], op: RawOp, when: Direction): QueryPair[] {
  if (when !== 'up') return query;
  return query.filter((pair) => pair.name !== op.name);
}
