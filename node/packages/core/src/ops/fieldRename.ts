import { fail, type Direction } from '../errors.js';
import { cloneJ, type JObject } from '../json/value.js';
import type { RawOp } from '../model.js';
import { clearLeaf, leaves, writeLeaf } from './edit.js';

function sameParent(a: string, b: string): boolean {
  const left = a.split('.');
  const right = b.split('.');
  if (left.length !== right.length) return false;
  return left.slice(0, -1).every((seg, i) => seg === right[i]);
}

/** Rename `from` to `to` on the way up, and the reverse on the way down. */
export function fieldRename(root: JObject, op: RawOp, when: Direction): void {
  const from = when === 'up' ? op.from! : op.to!;
  const to = when === 'up' ? op.to! : op.from!;
  const found = leaves(root, from, when).filter((leaf) => leaf.exists);
  if (found.length === 0) return;
  const destKey = to.split('.').at(-1)!;
  const paired = sameParent(from, to);
  const dest = paired ? [] : leaves(root, to, when);
  found.forEach((leaf, index) => {
    const value = leaf.parent.values.get(leaf.key);
    if (value === undefined) return;
    clearLeaf(leaf);
    if (paired) {
      writeLeaf({ parent: leaf.parent, key: destKey, exists: false }, cloneJ(value));
      return;
    }
    const target = dest[index];
    if (!target) throw fail('AV-E016', when, to);
    writeLeaf(target, cloneJ(value));
  });
}
