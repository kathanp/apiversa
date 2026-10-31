import type { Direction } from '../errors.js';
import { isArray, isObject, type JValue } from '../json/value.js';
import type { Registry } from '../json/parse.js';
import { MAX_DEPTH } from '../limits.js';
import { fail } from '../errors.js';
import type { Converter, RawOp } from '../model.js';
import { customOp } from './custom.js';
import { enumAdd } from './enumAdd.js';
import { enumRemove } from './enumRemove.js';
import { enumRename } from './enumRename.js';
import { errorShape } from './errorShape.js';
import { fieldAdd } from './fieldAdd.js';
import { fieldMove } from './fieldMove.js';
import { fieldRemove } from './fieldRemove.js';
import { fieldRename } from './fieldRename.js';
import { fieldType } from './fieldType.js';
import { objectWrap } from './objectWrap.js';

export type ApplyContext = {
  when: Direction;
  converters: Record<string, Converter>;
  registry: Registry;
  development: boolean;
  status?: number;
  errorCode?: string;
  change?: string;
};

/** Apply one data op at every object whose schema matches, then walk nested schemas. */
export function applyData(value: JValue, schema: string | undefined, op: RawOp, ctx: ApplyContext, depth = 0): JValue {
  if (depth > MAX_DEPTH) throw fail('AV-E004', ctx.when);
  if (isArray(value)) {
    return { kind: 'array', items: value.items.map((item) => applyData(item, schema, op, ctx, depth + 1)) };
  }
  if (!isObject(value)) return value;
  let current: JValue = value;
  if (op.op !== 'error.shape' && (op.schema === undefined || op.schema === schema)) {
    current = applyOnObject(value, schema, op, ctx);
  }
  if (op.op === 'error.shape' && (op.schema === undefined || op.schema === schema) && isObject(current)) {
    current = errorShape(current, op, ctx.when, ctx.status, ctx.errorCode);
  }
  if (!isObject(current)) return current;
  const fields = schema ? ctx.registry[schema]?.fields : undefined;
  if (!fields) return current;
  for (const field of fields) {
    const child = current.values.get(field.name);
    if (child === undefined) continue;
    if (field.schema) {
      current.values.set(field.name, applyData(child, field.schema, op, ctx, depth + 1));
    } else if (field.items && isArray(child)) {
      current.values.set(field.name, {
        kind: 'array',
        items: child.items.map((item) => applyData(item, field.items, op, ctx, depth + 1)),
      });
    }
  }
  return current;
}

function applyOnObject(obj: import('../json/value.js').JObject, schema: string | undefined, op: RawOp, ctx: ApplyContext): JValue {
  switch (op.op) {
    case 'field.rename':
      fieldRename(obj, op, ctx.when);
      return obj;
    case 'field.add':
      fieldAdd(obj, op, ctx.when);
      return obj;
    case 'field.remove':
      fieldRemove(obj, op, ctx.when);
      return obj;
    case 'field.move':
      fieldMove(obj, op, ctx.when);
      return obj;
    case 'field.type':
      fieldType(obj, op, ctx.when);
      return obj;
    case 'enum.add':
      enumAdd(obj, op, ctx.when);
      return obj;
    case 'enum.rename':
      enumRename(obj, op, ctx.when);
      return obj;
    case 'enum.remove':
      enumRemove(obj, op, ctx.when);
      return obj;
    case 'object.wrap':
      objectWrap(obj, op, ctx.when);
      return obj;
    case 'custom':
      return customOp(obj, op, ctx.when, ctx.converters, ctx.registry, schema, ctx.development, ctx.change);
    default:
      return obj;
  }
}
