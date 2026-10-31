import type { Direction } from '../errors.js';
import { cloneJ, type JObject, type JValue } from '../json/value.js';
import type { RawOp } from '../model.js';
import { asJson, clearLeaf, equalsJson, leaves, writeLeaf } from './edit.js';

/** Add a field on the way up. Null stays null. Absent becomes `default`. */
export function fieldAdd(root: JObject, op: RawOp, when: Direction): void {
  const found = leaves(root, op.path!, when);
  const fallback = asJson(op.default, when);
  for (const leaf of found) {
    if (when === 'up') {
      if (!leaf.exists) writeLeaf(leaf, cloneJ(fallback));
      continue;
    }
    if (!leaf.exists) continue;
    const current = leaf.parent.values.get(leaf.key) as JValue;
    if (current === null) continue;
    if (equalsJson(current, fallback)) clearLeaf(leaf);
  }
}
