import { fail, type Direction } from '../errors.js';
import { cloneJ, isArray, type JValue } from '../json/value.js';
import type { RawOp } from '../model.js';
import type { Leaf } from '../path/path.js';
import { clearLeaf, leaves, writeLeaf } from './edit.js';

/** The same `from` and `to` path is rejected at startup. */
export function checkListPaths(from: string | undefined, to: string | undefined): void {
  if (!from || !to || from === to) throw fail('AV-E001', 'startup', 'field.list from and to must be different paths');
}

/** Up wraps `from` in a one-element array. Down unwraps that array. */
export function fieldList(root: Parameters<typeof leaves>[0], op: RawOp, when: Direction): void {
  checkListPaths(op.from, op.to);
  const fromLeaves = leaves(root, op.from!, when);
  const toLeaves = leaves(root, op.to!, when);
  const count = Math.max(fromLeaves.length, toLeaves.length);
  for (let i = 0; i < count; i += 1) {
    if (when === 'up') listUp(fromLeaves[i], toLeaves[i], when);
    else listDown(fromLeaves[i], toLeaves[i], when);
  }
}

function listUp(from: Leaf | undefined, to: Leaf | undefined, when: Direction): void {
  if (present(to)) throw fail('AV-E020', when);
  if (!present(from) || !from) return;
  if (!to) throw fail('AV-E016', when);
  writeLeaf(to, { kind: 'array', items: [cloneJ(read(from))] });
  clearLeaf(from);
}

function listDown(from: Leaf | undefined, to: Leaf | undefined, when: Direction): void {
  if (!present(to) || !to) return;
  if (present(from)) throw fail('AV-E020', when);
  const value = read(to);
  if (!isArray(value) || value.items.length !== 1) throw fail('AV-E023', when);
  if (!from) throw fail('AV-E016', when);
  writeLeaf(from, cloneJ(value.items[0]!));
  clearLeaf(to);
}

function present(leaf: Leaf | undefined): boolean {
  return Boolean(leaf?.exists);
}

function read(leaf: Leaf): JValue {
  return (leaf.parent.values.get(leaf.key) as JValue | undefined) ?? null;
}
