import { fail } from '../errors.js';
import { encodeJson } from '../json/encode.js';
import { isArray, isObject, type JValue } from '../json/value.js';
import type { HeaderPair, RawOp } from '../model.js';
import { leaves } from './edit.js';

/** Replace a page object with its items array. The cursor is copied once and is not followed. */
export function unwrapEnvelope(body: JValue, op: RawOp, headers: HeaderPair[]): JValue {
  if (!isObject(body)) throw fail('AV-E016', 'down');
  const found = leaves(body, op.items || 'data', 'down');
  const leaf = found[0];
  if (!leaf?.exists) throw fail('AV-E016', 'down');
  const value = leaf.parent.values.get(leaf.key);
  if (value === undefined || !isArray(value)) throw fail('AV-E016', 'down');
  if (op.cursorHeader) {
    const cursor = body.values.get('next_cursor');
    if (typeof cursor === 'string') headers.push({ name: op.cursorHeader, value: cursor });
    else if (typeof cursor === 'number') headers.push({ name: op.cursorHeader, value: encodeJson(cursor, 'down') });
  }
  return value;
}
