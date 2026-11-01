import { fail } from '../errors.js';
import { encodeJson } from '../json/encode.js';
import { isArray, isObject, type JValue } from '../json/value.js';
import type { Change, HeaderPair, QueryPair, RawOp } from '../model.js';
import { clearLeaf, leaves, writeLeaf } from './edit.js';
import { pathParams } from './endpoint.js';

type Location = { kind: 'path' | 'query' | 'header' | 'body'; name: string };
type Moved = string | string[];

export type MoveInput = {
  op: RawOp;
  method: string | undefined;
  rewrittenMethod: string | undefined;
  originalPath: string;
  path: string;
  query: QueryPair[];
  headers: HeaderPair[];
  body: JValue | undefined;
  changes: Change[];
};

export type MoveResult = { path: string; query: QueryPair[]; headers: HeaderPair[]; body: JValue | undefined };

/** Move one value on the way up. An absent source is a no-op. A different target value is AV-E017. */
export function moveParam(input: MoveInput): MoveResult {
  const state: MoveResult = { path: input.path, query: input.query.map((pair) => ({ ...pair })), headers: input.headers.map((pair) => ({ ...pair })), body: input.body };
  const op = input.op;
  if (op.method && op.method !== input.method && op.method !== input.rewrittenMethod) return state;
  if (op.path && input.originalPath && pathParams(op.path, input.originalPath) === undefined) return state;
  const from = location(op.from);
  const to = location(op.to);
  const value = read(state, from, op, input.originalPath);
  if (value === undefined) return state;
  const existing = read(state, to, op, state.path);
  if (existing !== undefined && !same(existing, value)) throw fail('AV-E017', 'up');
  if (existing === undefined) write(state, to, value, op, input.changes, input.method ?? input.rewrittenMethod ?? 'GET');
  if (!samePlace(from, to)) clear(state, from, op, input.originalPath);
  return state;
}

function location(spec: string | undefined): Location {
  const text = spec ?? '';
  const index = text.indexOf(':');
  const kind = text.slice(0, index);
  const name = text.slice(index + 1);
  if ((kind !== 'path' && kind !== 'query' && kind !== 'header' && kind !== 'body') || name.length === 0) throw fail('AV-E016', 'up');
  return { kind, name };
}

function read(state: MoveResult, loc: Location, op: RawOp, originalPath: string): Moved | undefined {
  if (loc.kind === 'query') return readQuery(state.query, loc.name);
  if (loc.kind === 'header') return readHeader(state.headers, loc.name);
  if (loc.kind === 'path') return pathParams(op.path ?? '', originalPath)?.[loc.name];
  return readBody(state.body, loc.name);
}

function write(state: MoveResult, loc: Location, value: Moved, op: RawOp, changes: Change[], method: string): void {
  if (loc.kind === 'query') {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) state.query.push({ name: loc.name, value: item });
    return;
  }
  if (Array.isArray(value)) throw fail('AV-E016', 'up');
  if (loc.kind === 'header') {
    state.headers.push({ name: loc.name, value });
    return;
  }
  if (loc.kind === 'path') {
    state.path = writePath(state.path, op.path ?? '', loc.name, value, changes, method);
    return;
  }
  writeBody(state, loc.name, value);
}

function clear(state: MoveResult, loc: Location, op: RawOp, originalPath: string): void {
  if (loc.kind === 'query') {
    state.query = state.query.filter((pair) => pair.name !== loc.name);
    return;
  }
  if (loc.kind === 'header') {
    state.headers = state.headers.filter((header) => header.name.toLowerCase() !== loc.name.toLowerCase());
    return;
  }
  if (loc.kind === 'body') clearBody(state, loc.name);
  void op;
  void originalPath;
}

function readQuery(query: QueryPair[], name: string): Moved | undefined {
  const hits = query.filter((pair) => pair.name === name).map((pair) => pair.value);
  if (hits.length === 0) return undefined;
  if (hits.length === 1) return hits[0];
  return hits;
}

function readHeader(headers: HeaderPair[], name: string): string | undefined {
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value;
}

function readBody(body: JValue | undefined, path: string): Moved | undefined {
  if (body === undefined || !isObject(body)) return undefined;
  const found = leaves(body, path, 'up');
  const leaf = found[0];
  if (!leaf?.exists) return undefined;
  const value = leaf.parent.values.get(leaf.key);
  if (value === undefined) return undefined;
  return scalar(value);
}

function writeBody(state: MoveResult, path: string, value: string): void {
  if (state.body === undefined || !isObject(state.body)) throw fail('AV-E016', 'up');
  const found = leaves(state.body, path, 'up');
  const leaf = found[0];
  if (!leaf) throw fail('AV-E016', 'up');
  writeLeaf(leaf, value);
}

function clearBody(state: MoveResult, path: string): void {
  if (state.body === undefined || !isObject(state.body)) return;
  const found = leaves(state.body, path, 'up');
  const leaf = found[0];
  if (leaf?.exists) clearLeaf(leaf);
}

function scalar(value: JValue): Moved {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return encodeJson(value, 'up');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (isArray(value)) {
    return value.items.map((item) => {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return scalar(item) as string;
      throw fail('AV-E016', 'up');
    });
  }
  throw fail('AV-E016', 'up');
}

function writePath(actual: string, route: string, name: string, value: string, changes: Change[], method: string): string {
  const pattern = headPattern(changes, route, method);
  const parts = pattern.split('/').filter(Boolean);
  const index = parts.findIndex((part) => part === `:${name}`);
  if (index < 0) throw fail('AV-E016', 'up');
  const segs = actual.split('/').filter(Boolean);
  while (segs.length < parts.length) segs.push('');
  const encoded = encodeURIComponent(value);
  const slot = segs[index] ?? '';
  if (slot !== '' && slot !== `:${name}` && slot !== encoded) throw fail('AV-E017', 'up');
  segs[index] = encoded;
  return `${actual.startsWith('/') ? '/' : ''}${segs.join('/')}`;
}

function headPattern(changes: Change[], route: string, method: string): string {
  let current = route;
  const ordered = [...changes].sort((a, b) => a.version.localeCompare(b.version) || a.id.localeCompare(b.id));
  for (const change of ordered) {
    for (const op of change.ops) {
      if (op.op !== 'endpoint.rename' || op.from !== current || !op.to) continue;
      if (op.method && op.method !== method) continue;
      current = op.to;
    }
  }
  return current;
}

function same(left: Moved, right: Moved): boolean {
  const a = Array.isArray(left) ? left : [left];
  const b = Array.isArray(right) ? right : [right];
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function samePlace(left: Location, right: Location): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'header') return left.name.toLowerCase() === right.name.toLowerCase();
  return left.name === right.name;
}
