import type { Direction } from '../errors.js';
import { cloneJ, type JObject } from '../json/value.js';
import type { RawOp } from '../model.js';
import { evalExpr } from '../expr/eval.js';
import { leaves, writeLeaf } from './edit.js';

/** Replace the value at `path` with the expression for this direction. */
export function fieldType(root: JObject, op: RawOp, when: Direction): void {
  const found = leaves(root, op.path!, when);
  const present = found.filter((leaf) => leaf.exists);
  if (present.length === 0) return;
  const expr = when === 'down' ? op.down : op.up;
  const result = evalExpr(expr, root, when);
  present.forEach((leaf, index) => {
    writeLeaf(leaf, index === 0 ? result : cloneJ(result));
  });
}
