import type { Direction } from '../errors.js';
import { cloneJ, type JObject } from '../json/value.js';
import type { RawOp } from '../model.js';
import { asJson, clearLeaf, leaves, writeLeaf } from './edit.js';

/** Remove a field on the way up. On the way down, restore `default` when the key is absent. */
export function fieldRemove(root: JObject, op: RawOp, when: Direction): void {
  const found = leaves(root, op.path!, when);
  const fallback = asJson(op.default, when);
  for (const leaf of found) {
    if (when === 'up') {
      if (leaf.exists) clearLeaf(leaf);
      continue;
    }
    if (!leaf.exists) writeLeaf(leaf, cloneJ(fallback));
  }
}
