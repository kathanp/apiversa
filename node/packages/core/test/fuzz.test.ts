import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { ApiversaError } from '../src/errors.js';
import { fromPlain } from '../src/json/parse.js';
import type { JObject } from '../src/json/value.js';
import { inspectPath } from '../src/path/path.js';
import { parseYaml } from '../src/yaml/parse.js';
import { fieldAdd } from '../src/ops/fieldAdd.js';
import { fieldMove } from '../src/ops/fieldMove.js';
import { fieldRemove } from '../src/ops/fieldRemove.js';
import { fieldRename } from '../src/ops/fieldRename.js';
import { fieldType } from '../src/ops/fieldType.js';
import { enumAdd } from '../src/ops/enumAdd.js';
import { enumRemove } from '../src/ops/enumRemove.js';
import { enumRename } from '../src/ops/enumRename.js';
import { objectWrap } from '../src/ops/objectWrap.js';
import { errorShape } from '../src/ops/errorShape.js';
import { customOp } from '../src/ops/custom.js';
import { queryAdd } from '../src/ops/queryAdd.js';
import { queryRemove } from '../src/ops/queryRemove.js';
import { queryRename } from '../src/ops/queryRename.js';
import { headerRename } from '../src/ops/headerRename.js';
import { statusChange } from '../src/ops/statusChange.js';
import { decideRoute } from '../src/ops/endpoint.js';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';

/** Fixed seed for CI. The HARDEN run records a fresh seed beside the result. */
const SEED = 0x41504956;
const INPUTS = 100_000;

describe('fuzz', () => {
  it('parses 100000 yaml inputs, 100000 paths, and 100000 inputs per op without a crash', () => {
    const before = Object.getOwnPropertyNames(Object.prototype);
    const yaml = mulberry32(SEED);
    for (let i = 0; i < INPUTS; i++) accept(parseYaml, sampleYaml(yaml));
    const paths = mulberry32(SEED + 1);
    for (let i = 0; i < INPUTS; i++) {
      const root = fromPlain({ name: token(paths), nested: { city: token(paths) } }, 'up');
      accept(() => inspectPath(root, samplePath(paths)));
    }
    const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const route = { version: '2026-03-01', id: 'add-route', description: 'Fuzz route.', changes: [{ op: 'endpoint.add', method: 'GET', path: '/hotels/:id' }] };
    const routed = buildBundle(versions, [route], { today: '2026-10-31', registry: {} });
    const ops = mulberry32(SEED + 2);
    for (let i = 0; i < INPUTS; i++) runOps(ops, routed);
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(before);
    const change = { version: '2026-03-01', id: 'fuzz-rename', description: 'Ten kilobyte budget.', changes: [{ op: 'field.rename', schema: 'Note', from: 'note', to: 'text' }] };
    const bundle = buildBundle(versions, [change], { today: '2026-10-31', registry: { Note: {} } });
    const body = { note: 'x'.repeat(10_000) };
    const started = performance.now();
    execute(bundle, { schema: 'Note', version: '2026-01-15', body, trace: false }, 'up');
    expect(performance.now() - started).toBeLessThan(10);
  }, 120_000);
});

function runOps(rng: () => number, bundle: ReturnType<typeof buildBundle>): void {
  const root = fromPlain({ name: token(rng), status: 'old', city: token(rng) }, 'up') as JObject;
  const when = rng() < 0.5 ? 'up' : 'down';
  accept(() => fieldRename(root, { op: 'field.rename', from: 'name', to: 'title' }, when));
  accept(() => fieldAdd(root, { op: 'field.add', path: 'guestCount', default: 1 }, when));
  accept(() => fieldRemove(root, { op: 'field.remove', path: 'city' }, when));
  accept(() => fieldMove(root, { op: 'field.move', from: 'city', to: 'town' }, when));
  accept(() => fieldType(root, { op: 'field.type', path: 'name', down: { from: 'name.amount' }, up: { value: { amount: '$.name', currency: 'USD' } } }, when));
  accept(() => enumAdd(root, { op: 'enum.add', path: 'status', value: 'new', default: 'old' }, when));
  accept(() => enumRemove(root, { op: 'enum.remove', path: 'status', value: 'old', default: 'new' }, when));
  accept(() => enumRename(root, { op: 'enum.rename', path: 'status', from: 'old', to: 'legacy' }, when));
  accept(() => objectWrap(root, { op: 'object.wrap', path: 'name', into: 'label', field: 'text' }, when));
  accept(() => errorShape(root, { op: 'error.shape', code: 'missing', down: { message: '$.name' } }, when, 404, 'missing'));
  accept(() => customOp(root, { op: 'custom', converter: 'identity' }, when, { identity: { up: (value) => value, down: (value) => value } }, {}, undefined, true, '2026-03-01.fuzz'));
  accept(() => queryRename([{ name: 'town', value: token(rng) }], { op: 'query.rename', from: 'town', to: 'city' }, when));
  accept(() => queryAdd([], { op: 'query.add', name: 'guestCount', default: '' }, when));
  accept(() => queryRemove([{ name: 'town', value: 'x' }], { op: 'query.remove', name: 'town' }, when));
  accept(() => headerRename([{ name: 'Api-Version', value: '2026-01-15' }], { op: 'header.rename', from: 'Api-Version', to: 'X-Version' }, when));
  accept(() => statusChange(200, { op: 'status.change', from: 200, to: 201 }, when));
  accept(() => decideRoute(bundle.changes, '2026-01-15', 'GET', '/hotels/h_1'));
}

function accept(fn: (text?: string) => unknown, text?: string): void {
  try {
    if (text === undefined) fn();
    else fn(text);
  } catch (error) {
    if (!(error instanceof ApiversaError) && !(error instanceof SyntaxError)) throw error;
  }
}

function sampleYaml(rng: () => number): string {
  const key = token(rng);
  const kind = Math.floor(rng() * 5);
  if (kind === 0) return '';
  if (kind === 1) return `${key}: ${token(rng)}\n__proto__: 1\n`;
  if (kind === 2) return `items:\n  - ${token(rng)}\n  - ${Math.floor(rng() * 10)}\n`;
  if (kind === 3) return '\tbad';
  return `${key}:\n  nested: ${token(rng)}\n`;
}

function samplePath(rng: () => number): string {
  const parts = ['name', 'nested', 'city', '*', '[]', token(rng)];
  const length = 1 + Math.floor(rng() * 4);
  let path = '';
  for (let i = 0; i < length; i++) path += (i === 0 ? '' : '.') + parts[Math.floor(rng() * parts.length)];
  return path;
}

function token(rng: () => number): string {
  const alphabet = 'abcxyz_012';
  let out = '';
  const length = 1 + Math.floor(rng() * 6);
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(rng() * alphabet.length)];
  return out;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
