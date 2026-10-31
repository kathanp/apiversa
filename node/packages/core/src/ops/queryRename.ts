import type { Direction } from '../errors.js';
import type { QueryPair, RawOp } from '../model.js';

export function queryRename(query: QueryPair[], op: RawOp, when: Direction): QueryPair[] {
  if (when !== 'up') return query;
  return query.map((pair) => (pair.name === op.from ? { name: op.to!, value: pair.value } : pair));
}
