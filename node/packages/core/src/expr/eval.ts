import { fail, type Direction } from '../errors.js';
import { fromPlain } from '../json/parse.js';
import { jObject, setKey, type JObject, type JValue } from '../json/value.js';
import { readOne } from '../path/path.js';

/** Evaluate a change-file expression against one schema object. Reads see this object. */
export function evalExpr(expr: unknown, root: JObject, when: Direction): JValue {
  if (typeof expr === 'string') {
    if (expr.startsWith('$.')) {
      const path = expr.slice(2);
      return readOne(root, path, when);
    }
    return expr;
  }
  if (expr === null || typeof expr === 'boolean') return expr;
  if (typeof expr === 'number') return fromPlain(expr, when);
  if (Array.isArray(expr)) return { kind: 'array', items: expr.map((item) => evalExpr(item, root, when)) };
  if (typeof expr === 'object') {
    const record = expr as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 1 && keys[0] === 'from' && typeof record.from === 'string') return readOne(root, record.from, when);
    if (keys.length === 1 && keys[0] === 'value') return evalExpr(record.value, root, when);
    if (keys.length === 1 && keys[0] === 'literal' && typeof record.literal === 'string') return record.literal;
    const obj = jObject();
    for (const key of keys) setKey(obj, key, evalExpr(record[key], root, when));
    return obj;
  }
  throw fail('AV-E016', when, 'expression');
}
