import type { Direction } from '../errors.js';
import { encodeJson } from '../json/encode.js';
import { isObject, type JValue } from '../json/value.js';
import type { Change, QueryPair, RawOp } from '../model.js';
import { leaves, writeLeaf } from './edit.js';
import { pathParams } from './endpoint.js';

const SAFE = 9007199254740991;

export type PrefixState = { path: string; query: QueryPair[]; body: JValue | undefined };

/** Add or strip one fixed prefix. Path and query change only on the way up. */
export function applyPrefix(state: PrefixState, op: RawOp, direction: Direction, changes: Change[]): void {
  const target = op.target ?? '';
  const split = target.indexOf(':');
  const kind = target.slice(0, split);
  const name = target.slice(split + 1);
  const prefix = op.prefix ?? '';
  if (!name || (kind !== 'body' && kind !== 'path' && kind !== 'query')) return;
  if ((kind === 'path' || kind === 'query') && direction !== 'up') return;
  if (kind === 'query') {
    state.query = state.query.map((pair) => (pair.name === name ? { name, value: prefix + pair.value } : pair));
    return;
  }
  if (kind === 'path') {
    const pattern = patternFor(changes, state.path, name);
    if (!pattern) return;
    const current = pathParams(pattern, state.path)?.[name];
    if (current === undefined) return;
    state.path = writeSegment(pattern, state.path, name, `${prefix}${current}`);
    return;
  }
  if (!state.body || !isObject(state.body)) return;
  const found = leaves(state.body, name, direction);
  const leaf = found[0];
  if (!leaf?.exists) return;
  const value = leaf.parent.values.get(leaf.key);
  if (value === undefined || value === null) return;
  if (direction === 'up') {
    if (typeof value === 'string') writeLeaf(leaf, prefix + value);
    else if (typeof value === 'number') writeLeaf(leaf, prefix + encodeJson(value, 'up'));
    return;
  }
  if (typeof value !== 'string' || !value.startsWith(prefix)) return;
  const rest = value.slice(prefix.length);
  writeLeaf(leaf, op.numeric === true ? (safeInteger(rest) ?? rest) : rest);
}

function patternFor(changes: Change[], actual: string, name: string): string | undefined {
  for (const change of changes) {
    for (const op of change.ops) {
      if (!op.op.startsWith('endpoint.')) continue;
      for (const pattern of [op.path, op.from, op.to]) {
        if (!pattern?.includes(`:${name}`)) continue;
        if (pathParams(pattern, actual)?.[name] !== undefined) return pattern;
      }
    }
  }
  return undefined;
}

function writeSegment(pattern: string, actual: string, name: string, value: string): string {
  const parts = pattern.split('/').filter(Boolean);
  const index = parts.findIndex((part) => part === `:${name}`);
  const segs = actual.split('/').filter(Boolean);
  if (index < 0 || index >= segs.length) return actual;
  segs[index] = encodeURIComponent(value);
  return `${actual.startsWith('/') ? '/' : ''}${segs.join('/')}`;
}

function safeInteger(text: string): number | undefined {
  if (!/^-?\d+$/.test(text)) return undefined;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || Math.abs(value) > SAFE) return undefined;
  if (Object.is(value, -0)) return 0;
  if (String(value) !== text) return undefined;
  return value;
}
