import { fail, type Direction } from '../errors.js';
import { isArray, isObject, type JObject, type JValue } from '../json/value.js';

export type Leaf = { parent: JObject; key: string; exists: boolean };

export type Inspect = { leaves: Leaf[]; problem: boolean };

/**
 * Resolve a change-file path against one schema object.
 * A missing final key still yields a leaf so `field.add` can create it.
 * A missing parent, or a value of the wrong shape, is recorded on `problem` / an empty leaf list.
 */
export function inspectPath(root: JValue, path: string): Inspect {
  const segs = path.split('.');
  const leaves: Leaf[] = [];
  let problem = false;

  function walk(node: JValue, index: number): void {
    const head = segs[index];
    if (head === undefined) return;
    const last = index === segs.length - 1;
    if (head === '*') {
      if (!isObject(node)) {
        problem = true;
        return;
      }
      for (const key of [...node.keys]) {
        if (last) leaves.push({ parent: node, key, exists: true });
        else {
          const child = node.values.get(key);
          if (child === undefined) problem = true;
          else walk(child, index + 1);
        }
      }
      return;
    }
    const array = head.endsWith('[]');
    const name = array ? head.slice(0, -2) : head;
    if (!isObject(node)) {
      problem = true;
      return;
    }
    if (!array && last) {
      leaves.push({ parent: node, key: name, exists: node.values.has(name) });
      return;
    }
    if (!node.values.has(name)) return;
    const child = node.values.get(name)!;
    if (array) {
      if (!isArray(child)) {
        problem = true;
        return;
      }
      for (const item of child.items) walk(item, index + 1);
      return;
    }
    walk(child, index + 1);
  }

  if (segs.length > 32) throw fail('AV-E004', 'up', path);
  walk(root, 0);
  return { leaves, problem };
}

export function assertResolvable(info: Inspect, when: Direction): void {
  if (info.problem) throw fail('AV-E016', when);
}

/** Read one value. Wildcard paths are not read here. */
export function readOne(root: JValue, path: string, when: Direction): JValue {
  if (path === '') return root;
  const info = inspectPath(root, path);
  const leaf = info.leaves[0];
  if (info.problem || !leaf || info.leaves.length !== 1 || !leaf.exists) throw fail('AV-E016', when, path);
  const value = leaf.parent.values.get(leaf.key);
  if (value === undefined) throw fail('AV-E016', when, path);
  return value;
}
