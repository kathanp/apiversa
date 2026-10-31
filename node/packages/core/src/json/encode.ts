import { fail, type Direction } from '../errors.js';
import { isArray, isObject, type JValue } from './value.js';

/** Canonical JSON bytes. Key order is already stored on objects. */
export function encodeJson(value: JValue, when: Direction): string {
  return write(value, when);
}

function write(value: JValue, when: Direction): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return writeNumber(value, when);
  if (isArray(value)) return `[${value.items.map((item) => write(item, when)).join(',')}]`;
  if (isObject(value)) {
    const parts: string[] = [];
    for (const key of value.keys) {
      const child = value.values.get(key);
      if (child === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${write(child, when)}`);
    }
    return `{${parts.join(',')}}`;
  }
  throw fail('AV-E016', when, 'cannot encode');
}

function writeNumber(n: number, when: Direction): string {
  if (!Number.isFinite(n)) throw fail('AV-E014', when);
  if (Object.is(n, -0)) return '0';
  if (Number.isInteger(n)) {
    if (!Number.isSafeInteger(n)) throw fail('AV-E014', when);
    return String(n);
  }
  return JSON.stringify(n);
}

/** Structural compare using canonical bytes with each object's own key order. */
export function sameJson(a: JValue, b: JValue): boolean {
  return encodeJson(a, 'up') === encodeJson(b, 'up');
}
