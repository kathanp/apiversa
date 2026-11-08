import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle, type Bundle } from '../bundle/load.js';
import type { Registry } from '../json/parse.js';
import { schemaFieldsAt, type HeadField } from './generate.js';

type Property = { type?: string; deprecated?: boolean };
type JsonSchema = { properties?: Record<string, Property>; required?: string[] };
type AsyncDocument = {
  asyncapi?: string;
  components?: { schemas?: Record<string, JsonSchema> };
};

export type AsyncApiResult = { ok: true; files: string[] } | { ok: false; code: 'AV-E001' };

/** One AsyncAPI 3.0.0 document per date. A missing input writes nothing. */
export function writeAsyncApi(dir: string, today?: string): AsyncApiResult {
  const source = join(dir, 'asyncapi.json');
  if (!existsSync(source)) return { ok: true, files: [] };
  const head = JSON.parse(readFileSync(source, 'utf8')) as AsyncDocument;
  if (head.asyncapi !== '3.0.0') return { ok: false, code: 'AV-E001' };
  const headFields = readHeadFields(head);
  const bundle = loadBundle(dir, { today, registry: registryFor(headFields) });
  const outDir = join(dir, 'asyncapi');
  mkdirSync(outDir, { recursive: true });
  const files: string[] = [];
  for (const date of bundle.dates) {
    const file = join(outDir, `${date}.json`);
    writeFileSync(file, `${JSON.stringify(documentAt(head, headFields, bundle, date))}\n`);
    files.push(file);
  }
  return { ok: true, files };
}

function documentAt(head: AsyncDocument, headFields: Record<string, HeadField[]>, bundle: Bundle, date: string): AsyncDocument {
  const doc = JSON.parse(JSON.stringify(head)) as AsyncDocument;
  applySchemas(doc, schemaFieldsAt(headFields, bundle, date), deprecatedAt(bundle, date));
  return doc;
}

function deprecatedAt(bundle: Bundle, date: string): Map<string, Set<string>> {
  const marks = new Map<string, Set<string>>();
  for (const change of bundle.changes) {
    if (change.version > date) continue;
    for (const op of change.ops) {
      if (op.op !== 'field.deprecate' || !op.schema || !op.path) continue;
      const set = marks.get(op.schema) ?? new Set<string>();
      set.add(op.path);
      marks.set(op.schema, set);
    }
  }
  return marks;
}

function applySchemas(doc: AsyncDocument, fields: Record<string, HeadField[]>, deprecated: Map<string, Set<string>>): void {
  const schemas = doc.components?.schemas;
  if (!schemas) return;
  for (const [name, shape] of Object.entries(fields)) {
    const schema = schemas[name];
    if (!schema) continue;
    const marks = deprecated.get(name);
    const properties: Record<string, Property> = {};
    for (const field of shape) {
      const property: Property = field.type ? { type: field.type } : {};
      if (marks?.has(field.name)) property.deprecated = true;
      properties[field.name] = property;
    }
    schema.properties = properties;
    if (Array.isArray(schema.required)) schema.required = schema.required.filter((item) => item in properties);
  }
}

function readHeadFields(head: AsyncDocument): Record<string, HeadField[]> {
  const fields: Record<string, HeadField[]> = {};
  for (const [name, schema] of Object.entries(head.components?.schemas ?? {})) {
    fields[name] = Object.entries(schema.properties ?? {}).map(([field, def]) => ({ name: field, type: def.type }));
  }
  return fields;
}

function registryFor(head: Record<string, HeadField[]>): Registry {
  const registry: Registry = {};
  for (const [name, fields] of Object.entries(head)) registry[name] = { fields: fields.map((field) => ({ name: field.name })) };
  return registry;
}
