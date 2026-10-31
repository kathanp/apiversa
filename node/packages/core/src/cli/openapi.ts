import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle, type Bundle } from '../bundle/load.js';
import type { Registry } from '../json/parse.js';
import type { Change, RawOp } from '../model.js';
import { schemaFieldsAt, type HeadField } from './generate.js';

export type OpenApiDocument = {
  openapi?: string;
  info?: { title?: string; version?: string };
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, { properties?: Record<string, { type?: string }>; required?: string[] }> };
};

export type VersionPicker = {
  swagger: { urls: { url: string; name: string }[]; 'urls.primaryName': string };
  scalar: { sources: { title: string; url: string }[] };
};

/**
 * One OpenAPI 3.1 document per version.
 * An `endpoint.add` disappears from older documents. An `endpoint.remove` reappears.
 * Schema properties match `schemaFieldsAt` for that date.
 */
export function openApiVersions(dir: string, headDoc: OpenApiDocument, today?: string): Record<string, OpenApiDocument> {
  const headFields = readHeadFields(dir, headDoc);
  const bundle = loadBundle(dir, { today, registry: registryFor(headFields) });
  const out: Record<string, OpenApiDocument> = {};
  for (const date of bundle.dates) out[date] = documentAt(headDoc, headFields, bundle, date);
  return out;
}

/** Swagger UI `urls` and Scalar `sources` for the same version list. Head is first. */
export function versionPicker(dates: string[], urlFor: (date: string) => string = (date) => `/openapi/${date}.json`): VersionPicker {
  const urls = dates.map((date) => ({ url: urlFor(date), name: date }));
  return {
    swagger: { urls, 'urls.primaryName': dates[0] ?? '' },
    scalar: { sources: urls.map((item) => ({ title: item.name, url: item.url })) },
  };
}

/** Write `openapi/<date>.json` and `openapi/picker.json`. The head document is `openapi.json`. */
export function writeOpenApi(dir: string, today?: string): string[] {
  const headPath = join(dir, 'openapi.json');
  if (!existsSync(headPath)) throw new Error('api-versions/openapi.json is missing.');
  const headDoc = JSON.parse(readFileSync(headPath, 'utf8')) as OpenApiDocument;
  const docs = openApiVersions(dir, headDoc, today);
  const outDir = join(dir, 'openapi');
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const [date, doc] of Object.entries(docs)) {
    const file = join(outDir, `${date}.json`);
    writeFileSync(file, `${JSON.stringify(doc)}\n`);
    written.push(file);
  }
  const picker = join(outDir, 'picker.json');
  writeFileSync(picker, `${JSON.stringify(versionPicker(Object.keys(docs)))}\n`);
  written.push(picker);
  return written;
}

function documentAt(headDoc: OpenApiDocument, headFields: Record<string, HeadField[]>, bundle: Bundle, date: string): OpenApiDocument {
  const doc = JSON.parse(JSON.stringify(headDoc)) as OpenApiDocument;
  doc.info = { ...(doc.info ?? {}), version: date };
  const paths = (doc.paths ??= {});
  const newer = bundle.changes.filter((change) => change.version > date);
  newer.sort((left, right) => right.version.localeCompare(left.version) || right.id.localeCompare(left.id));
  for (const change of newer) {
    for (const op of [...change.ops].reverse()) applyEndpoint(paths, change, op);
  }
  applySchemas(doc, schemaFieldsAt(headFields, bundle, date));
  return doc;
}

function applyEndpoint(paths: Record<string, Record<string, unknown>>, change: Change, op: RawOp): void {
  const method = (op.method ?? 'GET').toLowerCase();
  if (op.op === 'endpoint.add' && op.path) {
    const key = findPath(paths, op.path);
    if (!key || !paths[key]) return;
    delete paths[key][method];
    if (Object.keys(paths[key]).length === 0) delete paths[key];
  } else if (op.op === 'endpoint.remove' && op.path) {
    const key = findPath(paths, op.path) ?? openApiPath(op.path);
    const ops = (paths[key] ??= {});
    if (!ops[method]) ops[method] = { responses: { '200': { description: change.description } } };
  } else if (op.op === 'endpoint.rename' && op.from && op.to) {
    const fromKey = findPath(paths, op.to);
    if (!fromKey || !paths[fromKey]?.[method]) return;
    const target = findPath(paths, op.from) ?? openApiPath(op.from);
    if (target === fromKey) return;
    const ops = (paths[target] ??= {});
    ops[method] = paths[fromKey][method];
    delete paths[fromKey][method];
    if (Object.keys(paths[fromKey]).length === 0) delete paths[fromKey];
  }
}

function applySchemas(doc: OpenApiDocument, fields: Record<string, HeadField[]>): void {
  const schemas = doc.components?.schemas;
  if (!schemas) return;
  for (const [name, shape] of Object.entries(fields)) {
    const schema = schemas[name];
    if (!schema) continue;
    const properties: Record<string, { type?: string }> = {};
    for (const field of shape) properties[field.name] = field.type ? { type: field.type } : {};
    schema.properties = properties;
    if (Array.isArray(schema.required)) schema.required = schema.required.filter((item) => item in properties);
  }
}

function readHeadFields(dir: string, headDoc: OpenApiDocument): Record<string, HeadField[]> {
  const headPath = join(dir, 'head.json');
  if (existsSync(headPath)) return JSON.parse(readFileSync(headPath, 'utf8')) as Record<string, HeadField[]>;
  const fields: Record<string, HeadField[]> = {};
  for (const [name, schema] of Object.entries(headDoc.components?.schemas ?? {})) {
    fields[name] = Object.entries(schema.properties ?? {}).map(([field, def]) => ({ name: field, type: def.type }));
  }
  return fields;
}

function registryFor(head: Record<string, HeadField[]>): Registry {
  const registry: Registry = {};
  for (const [name, fields] of Object.entries(head)) registry[name] = { fields: fields.map((field) => ({ name: field.name })) };
  return registry;
}

function findPath(paths: Record<string, unknown>, path: string): string | undefined {
  return Object.keys(paths).find((key) => samePath(key, path));
}

function samePath(left: string, right: string): boolean {
  const a = segments(left);
  const b = segments(right);
  return a.length === b.length && a.every((part, index) => part === b[index]);
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean).map((part) => (part.startsWith(':') ? `{${part.slice(1)}}` : part));
}

function openApiPath(path: string): string {
  const prefix = path.startsWith('/') ? '/' : '';
  return prefix + path.split('/').filter(Boolean).map((part) => (part.startsWith(':') ? `{${part.slice(1)}}` : part)).join('/');
}
