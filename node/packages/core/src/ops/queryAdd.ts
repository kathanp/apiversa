import type { Direction } from '../errors.js';
import type { QueryPair, RawOp } from '../model.js';

/** An absent parameter becomes `default`. An empty value stays empty. */
export function queryAdd(query: QueryPair[], op: RawOp, when: Direction): QueryPair[] {
  if (when !== 'up') return query;
  if (query.some((pair) => pair.name === op.name)) return query;
  return [...query, { name: op.name!, value: String(op.default ?? '') }];
}
