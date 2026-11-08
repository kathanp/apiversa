import { fail, type Direction } from '../errors.js';
import { cloneJ, type JValue } from '../json/value.js';
import type { RawOp } from '../model.js';
import type { Leaf } from '../path/path.js';
import { clearLeaf, equalsJson, leaves, writeLeaf } from './edit.js';

/**
 * Up removes `to` when it equals `from`. A different `to` is AV-E020.
 * Down copies `from` onto an absent `to`. `from` stays.
 */
export function fieldCopy(root: Parameters<typeof leaves>[0], op: RawOp, when: Direction): void {
  const fromLeaves = leaves(root, op.from!, when);
  const toLeaves = leaves(root, op.to!, when);
  const count = Math.max(fromLeaves.length, toLeaves.length);
  for (let i = 0; i < count; i += 1) {
    const from = fromLeaves[i];
    const to = toLeaves[i];
    if (when === 'up') copyUp(from, to, when);
    else copyDown(from, to, when);
  }
}

function copyUp(from: Leaf | undefined, to: Leaf | undefined, when: Direction): void {
  if (!present(to) || !to) return;
  if (!present(from) || !from || !equalsJson(read(from), read(to))) throw fail('AV-E020', when);
  clearLeaf(to);
}

function copyDown(from: Leaf | undefined, to: Leaf | undefined, when: Direction): void {
  if (!present(from) || !from) return;
  if (!to) throw fail('AV-E016', when);
  const source = read(from);
  if (!present(to)) {
    writeLeaf(to, cloneJ(source));
    return;
  }
  if (!equalsJson(source, read(to))) throw fail('AV-E020', when);
}

function present(leaf: Leaf | undefined): boolean {
  return Boolean(leaf?.exists);
}

function read(leaf: Leaf): JValue {
  return (leaf.parent.values.get(leaf.key) as JValue | undefined) ?? null;
}
