/** JSON value used inside the converter. Objects keep insertion order in `keys`. */

export type JObject = { kind: 'object'; keys: string[]; values: Map<string, JValue> };
export type JArray = { kind: 'array'; items: JValue[] };
export type JValue = null | boolean | number | string | JObject | JArray;

export function jObject(): JObject {
  return { kind: 'object', keys: [], values: new Map() };
}

export function isObject(v: JValue): v is JObject {
  return typeof v === 'object' && v !== null && (v as JObject).kind === 'object';
}

export function isArray(v: JValue): v is JArray {
  return typeof v === 'object' && v !== null && (v as JArray).kind === 'array';
}

export const BANNED_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

export function setKey(obj: JObject, key: string, value: JValue): void {
  if (BANNED_KEYS.has(key)) return;
  if (!obj.values.has(key)) obj.keys.push(key);
  obj.values.set(key, value);
}

export function deleteKey(obj: JObject, key: string): void {
  if (!obj.values.has(key)) return;
  obj.values.delete(key);
  obj.keys = obj.keys.filter((k) => k !== key);
}

export function cloneJ(v: JValue): JValue {
  if (!isObject(v) && !isArray(v)) return v;
  if (isArray(v)) return { kind: 'array', items: v.items.map(cloneJ) };
  const copy = jObject();
  for (const key of v.keys) {
    const child = v.values.get(key);
    if (child !== undefined) setKey(copy, key, cloneJ(child));
  }
  return copy;
}
