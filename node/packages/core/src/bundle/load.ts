import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertReleasedLock } from '../cli/lock.js';
import { fail } from '../errors.js';
import type { Registry } from '../json/parse.js';
import { DEFAULT_LIMITS, type Limits } from '../limits.js';
import { opRuns, type Change, type Converter, type PinStore, type RawOp } from '../model.js';
import { validateDocument } from '../schema/validate.js';
import { parseYaml } from '../yaml/parse.js';

export type Policy = 'latest' | 'oldest' | 'pin-on-first-call';

export type Bundle = {
  head: string;
  dates: string[];
  oldest: string;
  policy: Policy;
  changes: Change[];
  registry: Registry;
  converters: Record<string, Converter>;
  limits: Limits;
  pins?: PinStore;
  oversize: 'error' | 'passthrough';
};

const DATE = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export function loadBundle(
  dir: string,
  options?: { today?: string; registry?: Registry; converters?: Record<string, Converter>; limits?: Limits; pins?: PinStore; oversize?: 'error' | 'passthrough' },
): Bundle {
  assertReleasedLock(dir);
  const versions = parseYaml(readFileSync(join(dir, 'versions.yaml'), 'utf8'));
  const changes = readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') && name !== 'versions.yaml')
    .sort()
    .map((name) => parseYaml(readFileSync(join(dir, name), 'utf8')))
    .filter((doc) => doc !== null && !(typeof doc === 'object' && doc && Object.keys(doc).length === 0));
  return buildBundle(versions, changes, options);
}

export function buildBundle(
  versionsDoc: unknown,
  changeDocs: unknown[],
  options?: { today?: string; registry?: Registry; converters?: Record<string, Converter>; limits?: Limits; pins?: PinStore; oversize?: 'error' | 'passthrough' },
): Bundle {
  const today = options?.today ?? new Date().toISOString().slice(0, 10);
  assertPaths(changeDocs);
  validateDocument(versionsDoc);
  for (const doc of changeDocs) {
    if (doc === null) continue;
    validateDocument(doc);
  }
  const versions = versionsDoc as {
    head: string;
    default?: Policy;
    versions: { date: string; deprecated?: boolean; sunset?: string }[];
  };
  const dates = versions.versions.map((item) => item.date);
  if (new Set(dates).size !== dates.length) throw fail('AV-E001', 'startup', 'duplicate date');
  for (let i = 1; i < dates.length; i += 1) {
    if (dates[i]! >= dates[i - 1]!) throw fail('AV-E001', 'startup', 'dates are not descending');
  }
  if (versions.head !== dates[0]) throw fail('AV-E001', 'startup', 'head is not the newest date');
  for (const date of dates) {
    if (!realDate(date)) throw fail('AV-E001', 'startup', `malformed date ${date}`);
    if (date > today) throw fail('AV-E003', 'startup', date);
  }
  const policy: Policy = versions.default ?? 'oldest';
  const pins = options?.pins;
  if (policy === 'pin-on-first-call' && !pins) throw fail('AV-E005', 'startup');
  const converters = options?.converters ?? {};
  const registry = options?.registry ?? {};
  const changes: Change[] = [];
  const seen = new Set<string>();
  for (const doc of changeDocs) {
    if (doc === null || typeof doc !== 'object') continue;
    const file = doc as { version: string; id: string; description: string; draft?: boolean; changes: RawOp[] };
    if (file.draft === true) throw fail('AV-E013', 'startup', file.id);
    const key = `${file.version}:${file.id}`;
    if (seen.has(key)) throw fail('AV-E001', 'startup', `duplicate change ${key}`);
    seen.add(key);
    if (!dates.includes(file.version)) throw fail('AV-E001', 'startup', `change date ${file.version} is not listed`);
    for (const op of file.changes) {
      if (op.schema && !(op.schema in registry)) throw fail('AV-E001', 'startup', `unknown schema ${op.schema}`);
      if (op.op === 'custom' && (!op.converter || !converters[op.converter])) {
        throw fail('AV-E001', 'startup', `missing converter ${op.converter ?? ''}`);
      }
    }
    changes.push({ version: file.version, id: file.id, description: file.description, ops: file.changes });
  }
  return {
    head: versions.head,
    dates,
    oldest: dates[dates.length - 1]!,
    policy,
    changes,
    registry,
    converters,
    limits: options?.limits ?? DEFAULT_LIMITS,
    pins,
    oversize: options?.oversize ?? 'error',
  };
}

function assertPaths(docs: unknown[]): void {
  for (const doc of docs) {
    if (!doc || typeof doc !== 'object' || !('changes' in doc)) continue;
    const ops = (doc as { changes?: RawOp[] }).changes ?? [];
    for (const op of ops) {
      for (const key of ['path', 'from', 'to', 'into'] as const) {
        const value = op[key];
        if (typeof value === 'string' && value.split('.').length > 32) throw fail('AV-E004', 'startup', value);
      }
      for (const field of op.fields ?? []) {
        if (field.split('.').length > 32) throw fail('AV-E004', 'startup', field);
      }
    }
  }
}

function realDate(date: string): boolean {
  if (!DATE.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month! - 1 && utc.getUTCDate() === day;
}

/** True when this direction has at least one body, query, header, or status op. */
export function directionHasWork(bundle: Bundle, version: string, direction: import('../errors.js').Direction, schema: string | undefined): boolean {
  return planFor(bundle, version, direction).some((step) => {
    if (step.op.op === 'error.shape') return false;
    if (step.op.schema && schema && step.op.schema !== schema && !schemaMentions(bundle.registry, schema, step.op.schema)) return false;
    return true;
  });
}

export type Planned = { version: string; id: string; op: RawOp };

export function planFor(bundle: Bundle, version: string, direction: import('../errors.js').Direction): Planned[] {
  const selected = bundle.changes.filter((change) => change.version > version);
  selected.sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const steps: Planned[] = [];
  for (const change of selected) {
    for (const op of change.ops) {
      if (opRuns(op, direction, bundle.converters)) steps.push({ version: change.version, id: change.id, op });
    }
  }
  if (direction === 'down') steps.reverse();
  return steps;
}

function schemaMentions(registry: Registry, root: string, target: string, seen = new Set<string>()): boolean {
  if (root === target) return true;
  if (seen.has(root)) return false;
  seen.add(root);
  const def = registry[root];
  if (!def?.fields) return false;
  return def.fields.some((field) => (field.schema && schemaMentions(registry, field.schema, target, seen)) || (field.items && schemaMentions(registry, field.items, target, seen)));
}
