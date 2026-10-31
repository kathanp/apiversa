import type { Direction } from '../errors.js';
import type { JObject } from '../json/value.js';
import type { RawOp } from '../model.js';
import { asJson, equalsJson, leaves, writeLeaf } from './edit.js';

/** Rename an enum member. Null and every other value stay. */
export function enumRename(root: JObject, op: RawOp, when: Direction): void {
  const from = asJson(when === 'up' ? op.from : op.to, when);
  const to = asJson(when === 'up' ? op.to : op.from, when);
  for (const leaf of leaves(root, op.path!, when)) {
    if (!leaf.exists) continue;
    const current = leaf.parent.values.get(leaf.key)!;
    if (current !== null && equalsJson(current, from)) writeLeaf(leaf, to);
  }
}
