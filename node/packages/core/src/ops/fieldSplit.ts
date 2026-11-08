import { fail, type Direction, type ErrorCode } from '../errors.js';
import type { JValue } from '../json/value.js';
import type { RawOp } from '../model.js';
import type { Leaf } from '../path/path.js';
import { clearLeaf, leaves, writeLeaf } from './edit.js';

/** A separator is a literal string. A regex literal, an empty string, or more than 32 characters is AV-E001. */
export function checkSeparator(separator: unknown): void {
  if (typeof separator !== 'string' || separator.length < 1 || separator.length > 32 || regexLiteral(separator)) {
    throw fail('AV-E001', 'startup', 'separator must be a literal string of 1 to 32 characters');
  }
}

function regexLiteral(value: string): boolean {
  if (!value.startsWith('/') || value.length < 3) return false;
  const end = value.lastIndexOf('/');
  if (end <= 0) return false;
  const flags = value.slice(end + 1);
  for (const ch of flags) if (!'gimsuy'.includes(ch)) return false;
  return true;
}

/**
 * Up splits `from` on the first literal separator into `left` and `right`.
 * Down joins those strings back into `from`.
 */
export function fieldSplit(root: Parameters<typeof leaves>[0], op: RawOp, when: Direction): void {
  checkSeparator(op.separator);
  const separator = op.separator!;
  const fromLeaves = leaves(root, op.from!, when);
  const leftLeaves = leaves(root, op.left!, when);
  const rightLeaves = leaves(root, op.right!, when);
  const count = Math.max(fromLeaves.length, leftLeaves.length, rightLeaves.length);
  for (let i = 0; i < count; i += 1) {
    const from = fromLeaves[i];
    const left = leftLeaves[i];
    const right = rightLeaves[i];
    if (when === 'up') splitUp(from, left, right, separator, when);
    else splitDown(from, left, right, separator, when);
  }
}

function splitUp(from: Leaf | undefined, left: Leaf | undefined, right: Leaf | undefined, separator: string, when: Direction): void {
  if (present(left) || present(right)) throw fail('AV-E020', when);
  if (!present(from) || !from) return;
  const value = stringValue(from, 'AV-E016', when);
  const at = value.indexOf(separator);
  if (at < 0) throw fail('AV-E021', when);
  if (!left || !right) throw fail('AV-E016', when);
  writeLeaf(left, value.slice(0, at));
  writeLeaf(right, value.slice(at + separator.length));
  clearLeaf(from);
}

function splitDown(from: Leaf | undefined, left: Leaf | undefined, right: Leaf | undefined, separator: string, when: Direction): void {
  if (present(from)) throw fail('AV-E020', when);
  if (!present(left) || !present(right) || !left || !right) throw fail('AV-E021', when);
  const joined = `${stringValue(left, 'AV-E021', when)}${separator}${stringValue(right, 'AV-E021', when)}`;
  if (!from) throw fail('AV-E016', when);
  writeLeaf(from, joined);
  clearLeaf(left);
  clearLeaf(right);
}

function present(leaf: Leaf | undefined): boolean {
  return Boolean(leaf?.exists);
}

function stringValue(leaf: Leaf, code: ErrorCode, when: Direction): string {
  const value = leaf.parent.values.get(leaf.key) as JValue | undefined;
  if (typeof value !== 'string') throw fail(code, when);
  return value;
}
