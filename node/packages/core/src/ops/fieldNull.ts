import { type Direction } from '../errors.js';
import type { JValue } from '../json/value.js';
import type { RawOp } from '../model.js';
import type { Leaf } from '../path/path.js';
import { clearLeaf, leaves, writeLeaf } from './edit.js';

/** Up writes JSON null for an absent key. Down removes a JSON null. */
export function fieldNull(root: Parameters<typeof leaves>[0], op: RawOp, when: Direction): void {
  for (const leaf of leaves(root, op.path!, when)) {
    if (when === 'up') {
      if (!leaf.exists) writeLeaf(leaf, null);
      continue;
    }
    if (leaf.exists && read(leaf) === null) clearLeaf(leaf);
  }
}

function read(leaf: Leaf): JValue {
  return (leaf.parent.values.get(leaf.key) as JValue | undefined) ?? null;
}
