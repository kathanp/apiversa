import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { directionHasWork } from '../src/bundle/load.js';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';
import { api, parseQuery, supportedVersions } from '../src/create.js';
import { evalExpr } from '../src/expr/eval.js';
import { ApiversaError, statusFor } from '../src/errors.js';
import { encodeJson, sameJson } from '../src/json/encode.js';
import { fromPlain, parseJson, toPlain } from '../src/json/parse.js';
import { customOp } from '../src/ops/custom.js';
import { errorShape } from '../src/ops/errorShape.js';
import { objectWrap } from '../src/ops/objectWrap.js';
import { queryAdd } from '../src/ops/queryAdd.js';
import { queryRemove } from '../src/ops/queryRemove.js';
import { queryRename } from '../src/ops/queryRename.js';
import { cloneJ, deleteKey, jObject, type JObject } from '../src/json/value.js';
import { inspectPath, readOne } from '../src/path/path.js';
import { init } from '../src/cli/init.js';
import { parseYaml } from '../src/yaml/parse.js';

describe('parsers, paths, and encoding', () => {
  it('encodes canonical JSON and rejects values that are not JSON', () => {
    const parsed = parseJson('{"b":true,"a":[1,null,"x\\"y"],"n":1.5,"z":-0}', { when: 'up' });
    expect(encodeJson(parsed, 'up')).toBe('{"b":true,"a":[1,null,"x\\"y"],"n":1.5,"z":0}');
    expect(sameJson(parsed, parseJson(encodeJson(parsed, 'up'), { when: 'up' }))).toBe(true);
    expect(() => fromPlain(Symbol('x'), 'up')).toThrow(expect.objectContaining({ code: 'AV-E016' }));
    expect(() => parseJson('{', { when: 'up' })).toThrow(SyntaxError);
    expect(() => parseJson('{"a":1} trailing', { when: 'down' })).toThrow(SyntaxError);
    expect(() => parseJson('"\\u0041"', { when: 'up' })).not.toThrow();
    expect(parseJson('"\\n"', { when: 'up' })).toBe('\n');
    expect(() => parseJson('"\\q"', { when: 'up' })).toThrow(SyntaxError);
    expect(() => parseJson('[1,]', { when: 'up' })).toThrow(SyntaxError);
    expect(() => parseJson('{"a" 1}', { when: 'up' })).toThrow(SyntaxError);
  });

  it('clones objects, drops a missing key, and walks star paths', () => {
    const root = fromPlain({ rooms: [{ city: 'A' }], extra: true }, 'up');
    deleteKey(jObject(), 'missing');
    const cloned = cloneJ(root);
    expect(toPlain(cloned, undefined, {})).toEqual({ rooms: [{ city: 'A' }], extra: true });
    if (typeof cloned === 'object' && cloned && 'kind' in cloned && cloned.kind === 'object') {
      const star = inspectPath(cloned, 'rooms[].*');
      expect(star.leaves.map((leaf) => leaf.key)).toEqual(['city']);
      expect(readOne(cloned, 'extra', 'up')).toBe(true);
      expect(() => readOne(cloned, 'missing', 'down')).toThrow(expect.objectContaining({ code: 'AV-E016' }));
    }
    expect(() => inspectPath(fromPlain({}, 'up'), Array.from({ length: 33 }, () => 'a').join('.'))).toThrow(expect.objectContaining({ code: 'AV-E004' }));
  });

  it('parses the YAML subset used by change files', () => {
    expect(parseYaml('')).toBeNull();
    expect(parseYaml('tags:\n  - a\n  - b\nflag: false\nnote: "say \\"hi\\""\nempty: []\nwrap: { a: 1, b: [2, 3] }\n')).toMatchObject({
      tags: ['a', 'b'],
      flag: false,
      empty: [],
      wrap: { a: 1, b: [2, 3] },
    });
    expect(parseYaml('name: yes\n')).toEqual({ name: 'yes' });
    expect(() => parseYaml('a: 1\nb: 2\na: 3\n')).toThrow(expect.objectContaining({ code: 'AV-E001' }));
    expect(() => parseYaml('a:\t1\n')).toThrow(expect.objectContaining({ code: 'AV-E001' }));
    expect(() => parseYaml('&anchor: 1\n')).toThrow(expect.objectContaining({ code: 'AV-E001' }));
    const banned = parseYaml('ok: 1\n__proto__: 2\n') as { ok?: number };
    expect(banned.ok).toBe(1);
    expect(() => parseYaml('note: "unterminated\n')).toThrow(ApiversaError);
  });

  it('evaluates expression forms', () => {
    const root = fromPlain({ price: 89, city: 'Paris' }, 'up');
    if (typeof root !== 'object' || root === null || !('kind' in root) || root.kind !== 'object') throw new Error('object');
    expect(evalExpr('$.city', root, 'up')).toBe('Paris');
    expect(evalExpr({ from: 'price' }, root, 'down')).toBe(89);
    expect(evalExpr({ value: { currency: 'USD' } }, root, 'up')).toMatchObject({ kind: 'object' });
    expect(evalExpr({ literal: 'USD' }, root, 'up')).toBe('USD');
    expect(evalExpr(['$.city', true, null], root, 'up')).toMatchObject({ kind: 'array' });
    expect(() => evalExpr(undefined, root, 'up')).toThrow(expect.objectContaining({ code: 'AV-E016' }));
  });

  it('reports whether a direction has work and parses query strings', () => {
    const versions = { head: '2026-03-01', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = { version: '2026-03-01', id: 'rename', description: 'Rename.', changes: [{ op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality' }] };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: { Booking: { fields: [{ name: 'hotel', schema: 'Hotel' }] }, Hotel: {} } });
    expect(directionHasWork(bundle, '2026-01-15', 'up', 'Booking')).toBe(true);
    expect(directionHasWork(bundle, '2026-03-01', 'down', 'Hotel')).toBe(false);
    expect(parseQuery('?town=Paris+Nord&bare&city=')).toEqual([
      { name: 'town', value: 'Paris Nord' },
      { name: 'bare', value: '' },
      { name: 'city', value: '' },
    ]);
    expect(parseQuery('')).toEqual([]);
    expect(supportedVersions(new ApiversaError('AV-E002', 'up'))).toEqual([]);
    expect(supportedVersions(new Error('x'))).toEqual([]);
    expect(statusFor('AV-E006', 'up')).toBeUndefined();
    expect(statusFor('AV-E004', 'down')).toBe(500);
  });

  it('rethrows a filesystem error that is not an existing file', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'apiversa-eis-'));
    mkdirSync(join(cwd, 'api-versions', 'versions.yaml'), { recursive: true });
    expect(() => init(cwd)).toThrow();
  });

  it('renames a field and a header in one plan', () => {
    const versions = { head: '2026-03-01', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = {
      version: '2026-03-01',
      id: 'both',
      description: 'Rename a field and a header.',
      changes: [
        { op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality' },
        { op: 'header.rename', from: 'X-City', to: 'X-Locality' },
      ],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: { Hotel: {} } });
    const result = execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: { city: 'Paris' }, headers: [{ name: 'X-City', value: 'Paris' }], trace: true }, 'up');
    expect(result.body).toEqual({ locality: 'Paris' });
    expect(result.headers).toEqual([{ name: 'X-Locality', value: 'Paris' }]);
    expect(result.trace).toBe('2026-03-01.both');
  });

  it('walks an items schema and the sides of each op', () => {
    const versions = { head: '2026-03-01', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = { version: '2026-03-01', id: 'rename', description: 'Rename city inside a page.', changes: [{ op: 'field.rename', schema: 'Hotel', from: 'city', to: 'locality' }] };
    const bundle = buildBundle(versions, [change], {
      today: '2026-10-30',
      registry: { Page: { fields: [{ name: 'data', items: 'Hotel' }] }, Hotel: {} },
    });
    expect(execute(bundle, { schema: 'Page', version: '2026-01-15', body: { data: [{ city: 'Paris' }] }, trace: false }, 'up').body).toEqual({ data: [{ locality: 'Paris' }] });
    expect(() => runMissingParent()).toThrow(expect.objectContaining({ code: 'AV-E016' }));
    const client = api(buildBundle(versions, [], { today: '2026-10-30', registry: { Hotel: {} } }), { header: 'Api-Version', development: false, trace: false });
    expect(client.convertRequest({ schema: 'Hotel', version: '2026-03-01', body: { id: 'h_1' }, headers: [['X-City', 'Paris']] })).toEqual({ id: 'h_1' });
    expect(client.prepare('up', { version: '2026-03-01', headers: { 'X-Empty': undefined, 'X-Many': ['a', 'b'] } }).headers).toEqual([
      { name: 'X-Many', value: 'a' },
      { name: 'X-Many', value: 'b' },
    ]);
  });
});

function runMissingParent(): unknown {
  const versions = { head: '2026-03-01', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
  const change = { version: '2026-03-01', id: 'deep-rename', description: 'Rename into a missing parent.', changes: [{ op: 'field.rename', schema: 'Hotel', from: 'city', to: 'address.city' }] };
  const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: { Hotel: {} } });
  return execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: { city: 'Paris' }, trace: false }, 'up').body;
}

describe('op edges', () => {
  it('covers the direction and absence branches', () => {
    const query = [{ name: 'other', value: '1' }];
    expect(queryRename(query, { op: 'query.rename', from: 'town', to: 'city' }, 'down')).toEqual(query);
    expect(queryRename(query, { op: 'query.rename', from: 'town', to: 'city' }, 'up')).toEqual(query);
    expect(queryAdd([], { op: 'query.add', name: 'guestCount' }, 'down')).toEqual([]);
    expect(queryAdd([], { op: 'query.add', name: 'guestCount', default: null }, 'up')).toEqual([{ name: 'guestCount', value: '' }]);
    expect(queryRemove(query, { op: 'query.remove', name: 'other' }, 'down')).toEqual(query);
    const root = fromPlain({ city: 'Paris', note: null }, 'up') as JObject;
    expect(errorShape(root, { op: 'error.shape' }, 'up', 400, 'x')).toBe(root);
    expect(errorShape(root, { op: 'error.shape', code: 'missing', status: 404 }, 'down', 400, 'missing')).toBe(root);
    expect(errorShape(root, { op: 'error.shape' }, 'down', 400, 'x')).toBe(root);
    const empty = fromPlain({}, 'up') as JObject;
    objectWrap(empty, { op: 'object.wrap', into: 'price' }, 'down');
    expect(() => objectWrap(empty, { op: 'object.wrap', into: 'address.city' }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E016' }));
    const converters = { split: { up: () => undefined, down: () => { throw new Error('nope'); } } };
    expect(customOp(root, { op: 'custom' }, 'up', converters, {}, 'Hotel', false)).toBe(root);
    expect(() => customOp(root, { op: 'custom', converter: 'split' }, 'up', converters, {}, 'Hotel', true)).toThrow(expect.objectContaining({ code: 'AV-E016' }));
    expect(() => customOp(root, { op: 'custom', converter: 'split' }, 'down', converters, {}, 'Hotel', false)).toThrow(Error);
  });
});
