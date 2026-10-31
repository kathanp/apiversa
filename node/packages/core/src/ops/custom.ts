import { fail, type Direction } from '../errors.js';
import { fromPlain, toPlain, type Registry } from '../json/parse.js';
import { type JObject, type JValue } from '../json/value.js';
import type { Converter, RawOp } from '../model.js';

/** Run a named code converter. In development its input is frozen. */
export function customOp(
  root: JObject,
  op: RawOp,
  when: Direction,
  converters: Record<string, Converter>,
  registry: Registry,
  schema: string | undefined,
  development: boolean,
  change?: string,
): JValue {
  const converter = op.converter ? converters[op.converter] : undefined;
  const fn = converter?.[when];
  if (!fn) return root;
  const plain = toPlain(root, schema, registry);
  if (development) deepFreeze(plain);
  let result: unknown;
  try {
    result = fn(plain);
  } catch (error) {
    if (error instanceof TypeError) throw fail('AV-E007', when, change ?? op.converter);
    throw error;
  }
  if (result === undefined) throw fail('AV-E016', when, op.converter);
  return fromPlain(result, when);
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) deepFreeze((value as Record<string, unknown>)[key]);
}
