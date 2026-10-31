import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail } from '../errors.js';

type Schema = Record<string, unknown>;

let cached: Schema | undefined;

/** Load `schema/change-file.schema.json` by walking up from this file and from cwd. */
export function loadChangeSchema(): Schema {
  if (cached) return cached;
  const starts = [dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let n = 0; n < 8; n += 1) {
      const candidate = join(dir, 'schema', 'change-file.schema.json');
      try {
        cached = JSON.parse(readFileSync(candidate, 'utf8')) as Schema;
        return cached;
      } catch {
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
  }
  throw fail('AV-E001', 'startup', 'change-file.schema.json not found');
}

/** Validate a versions file or a change file against the shared JSON Schema. */
export function validateDocument(data: unknown): void {
  const root = loadChangeSchema();
  try {
    check(root, data, root);
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiversaError') throw error;
    throw fail('AV-E001', 'startup', error instanceof Error ? error.message : 'schema');
  }
}

function check(schema: Schema, data: unknown, root: Schema): void {
  if (typeof schema.$ref === 'string') {
    check(resolveRef(root, schema.$ref), data, root);
    return;
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = (schema.oneOf as Schema[]).filter((branch) => matchesBranch(branch, data, root));
    if (matches.length !== 1) throw fail('AV-E001', 'startup', `oneOf matched ${matches.length}`);
    return;
  }
  if (Array.isArray(schema.anyOf)) {
    const ok = (schema.anyOf as Schema[]).some((branch) => matchesBranch(branch, data, root));
    if (!ok) throw fail('AV-E001', 'startup', 'anyOf');
  }
  if (schema.const !== undefined && data !== schema.const) throw fail('AV-E001', 'startup', 'const');
  if (Array.isArray(schema.enum) && !schema.enum.includes(data)) throw fail('AV-E001', 'startup', 'enum');
  const type = schema.type;
  if (type === 'object' || schema.properties || schema.additionalProperties === false) checkObject(schema, data, root);
  else if (type === 'array') checkArray(schema, data, root);
  else if (type === 'string') checkString(schema, data);
  else if (type === 'integer' || type === 'number') checkNumber(schema, data, type === 'integer');
  else if (type === 'boolean' && typeof data !== 'boolean') throw fail('AV-E001', 'startup', 'boolean');
}

function matchesBranch(schema: Schema, data: unknown, root: Schema): boolean {
  try {
    check(schema, data, root);
    return true;
  } catch {
    return false;
  }
}

function checkObject(schema: Schema, data: unknown, root: Schema): void {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw fail('AV-E001', 'startup', 'object');
  const record = data as Record<string, unknown>;
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  for (const key of required) if (!(key in record)) throw fail('AV-E001', 'startup', `missing ${key}`);
  const properties = (schema.properties ?? {}) as Record<string, Schema>;
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) {
      if (!(key in properties)) throw fail('AV-E001', 'startup', `unexpected ${key}`);
    }
  }
  for (const [key, sub] of Object.entries(properties)) {
    if (key in record) check(sub, record[key], root);
  }
}

function checkArray(schema: Schema, data: unknown, root: Schema): void {
  if (!Array.isArray(data)) throw fail('AV-E001', 'startup', 'array');
  if (typeof schema.minItems === 'number' && data.length < schema.minItems) throw fail('AV-E001', 'startup', 'minItems');
  if (schema.items && typeof schema.items === 'object') {
    for (const item of data) check(schema.items as Schema, item, root);
  }
}

function checkString(schema: Schema, data: unknown): void {
  if (typeof data !== 'string') throw fail('AV-E001', 'startup', 'string');
  if (typeof schema.minLength === 'number' && data.length < schema.minLength) throw fail('AV-E001', 'startup', 'minLength');
  if (typeof schema.maxLength === 'number' && data.length > schema.maxLength) throw fail('AV-E001', 'startup', 'maxLength');
  if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(data)) {
    throw fail('AV-E001', 'startup', `pattern ${schema.pattern}`);
  }
}

function checkNumber(schema: Schema, data: unknown, integer: boolean): void {
  if (typeof data !== 'number' || !Number.isFinite(data)) throw fail('AV-E001', 'startup', 'number');
  if (integer && !Number.isInteger(data)) throw fail('AV-E001', 'startup', 'integer');
  if (typeof schema.minimum === 'number' && data < schema.minimum) throw fail('AV-E001', 'startup', 'minimum');
  if (typeof schema.maximum === 'number' && data > schema.maximum) throw fail('AV-E001', 'startup', 'maximum');
}

function resolveRef(root: Schema, ref: string): Schema {
  if (!ref.startsWith('#/')) throw fail('AV-E001', 'startup', `bad $ref ${ref}`);
  let cursor: unknown = root;
  for (const part of ref.slice(2).split('/')) {
    if (typeof cursor !== 'object' || cursor === null || !(part in (cursor as Record<string, unknown>))) {
      throw fail('AV-E001', 'startup', `missing $ref ${ref}`);
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor as Schema;
}
