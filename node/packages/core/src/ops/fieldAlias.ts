import { fail, type Direction } from '../errors.js';
import { cloneJ } from '../json/value.js';
import type { RawOp } from '../model.js';
import type { Leaf } from '../path/path.js';
import { clearLeaf, leaves, writeLeaf } from './edit.js';

function present(leaf: Leaf | undefined): boolean {
  return Boolean(leaf?.exists);
}

/**
 * Up accepts `from` or `to`. Both present is AV-E018 and no body is returned.
 * Down writes `from` and removes `to`. Both present keeps the `from` value.
 */
export function fieldAlias(root: Parameters<typeof leaves>[0], op: RawOp, when: Direction): void {
  const from = op.from!;
  const to = op.to!;
  const fromLeaves = leaves(root, from, when);
  const toLeaves = leaves(root, to, when);
  const count = Math.max(fromLeaves.length, toLeaves.length);
  if (when === 'up') {
    for (let i = 0; i < count; i += 1) {
      if (present(fromLeaves[i]) && present(toLeaves[i])) throw fail('AV-E018', 'up');
    }
  }
  for (let i = 0; i < count; i += 1) {
    const src = fromLeaves[i];
    const dest = toLeaves[i];
    if (when === 'up') {
      if (!present(src) || present(dest) || !src) continue;
      move(src, dest, to, when);
    } else if (present(dest) && dest) {
      if (!present(src)) move(dest, src, from, when);
      clearLeaf(dest);
    }
  }
}

function move(from: Leaf, to: Leaf | undefined, path: string, when: Direction): void {
  if (!to) throw fail('AV-E016', when, path);
  const value = from.parent.values.get(from.key);
  clearLeaf(from);
  if (value === undefined) return;
  writeLeaf(to, cloneJ(value));
}
