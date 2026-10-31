import { fail, type Direction } from '../errors.js';
import { isObject, jObject, type JObject, type JValue } from '../json/value.js';
import type { RawOp } from '../model.js';
import { clearLeaf, leaves, writeLeaf } from './edit.js';

/** Wrap listed fields under `into` on the way up, and unwrap on the way down. */
export function objectWrap(root: JObject, op: RawOp, when: Direction): void {
  if (when === 'up') {
    const wrapped = jObject();
    for (const field of op.fields ?? []) {
      const found = leaves(root, field, when).filter((leaf) => leaf.exists);
      for (const leaf of found) {
        const value = leaf.parent.values.get(leaf.key) as JValue;
        writeLeaf({ parent: wrapped, key: leaf.key, exists: false }, value);
        clearLeaf(leaf);
      }
    }
    const into = leaves(root, op.into!, when);
    const slot = into[0];
    if (!slot) throw fail('AV-E016', when, op.into);
    writeLeaf(slot, wrapped);
    return;
  }
  const into = leaves(root, op.into!, when);
  const slot = into[0];
  if (!slot || !slot.exists) return;
  const value = slot.parent.values.get(slot.key) as JValue;
  if (value === null || !isObject(value)) throw fail('AV-E016', when, op.into);
  for (const key of [...value.keys]) {
    const child = value.values.get(key);
    if (child === undefined) continue;
    writeLeaf({ parent: slot.parent, key, exists: slot.parent.values.has(key) }, child);
  }
  clearLeaf(slot);
}
