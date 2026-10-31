import { fail, type Direction } from '../errors.js';
import { fromPlain } from '../json/parse.js';
import { sameJson } from '../json/encode.js';
import { deleteKey, setKey, type JObject, type JValue } from '../json/value.js';
import { inspectPath, type Leaf } from '../path/path.js';

export function leaves(root: JObject, path: string, when: Direction): Leaf[] {
  const info = inspectPath(root, path);
  if (info.problem) throw fail('AV-E016', when, path);
  return info.leaves;
}

export function asJson(value: unknown, when: Direction): JValue {
  return fromPlain(value, when);
}

export function equalsJson(a: JValue, b: JValue): boolean {
  return sameJson(a, b);
}

export function writeLeaf(leaf: Leaf, value: JValue): void {
  setKey(leaf.parent, leaf.key, value);
}

export function clearLeaf(leaf: Leaf): void {
  deleteKey(leaf.parent, leaf.key);
}
