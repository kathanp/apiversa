import type { Direction } from '../errors.js';
import type { JObject } from '../json/value.js';
import type { RawOp } from '../model.js';
import { asJson, equalsJson, leaves, writeLeaf } from './edit.js';

/** On the way up, map a removed enum member to `replacement`. */
export function enumRemove(root: JObject, op: RawOp, when: Direction): void {
  if (when !== 'up') return;
  const target = asJson(op.value, when);
  const replacement = asJson(op.replacement, when);
  for (const leaf of leaves(root, op.path!, when)) {
    if (!leaf.exists) continue;
    const current = leaf.parent.values.get(leaf.key)!;
    if (current !== null && equalsJson(current, target)) writeLeaf(leaf, replacement);
  }
}
