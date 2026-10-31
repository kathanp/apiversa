import type { Direction } from '../errors.js';
import type { JObject } from '../json/value.js';
import type { RawOp } from '../model.js';
import { fieldRename } from './fieldRename.js';

/** Move is a rename between two paths. */
export function fieldMove(root: JObject, op: RawOp, when: Direction): void {
  fieldRename(root, op, when);
}
