import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HeadField } from './generate.js';
import { parseYaml } from '../yaml/parse.js';

export type SchemaDiff = { schema: string; kind: 'added' | 'removed' | 'renamed' | 'type'; path: string; from?: string; to?: string };

export type CheckResult = { ok: boolean; diffs: SchemaDiff[]; summary: string; suggested?: string };

type ChangeFile = { version: string; id: string; description: string; draft: boolean; changes: { op?: string; method?: string; path?: string; schema?: string }[] };

/** Compare head.json with the newest snapshot. A field change needs a change file for the new head version. */
export function checkBundle(dir: string, options?: { format?: 'text' | 'markdown'; suggest?: boolean }): CheckResult {
  const headPath = join(dir, 'head.json');
  if (!existsSync(headPath)) return { ok: false, diffs: [], summary: 'api-versions/head.json is missing.' };
  const head = JSON.parse(readFileSync(headPath, 'utf8')) as Record<string, HeadField[]>;
  const versions = parseYaml(readFileSync(join(dir, 'versions.yaml'), 'utf8')) as { head?: string };
  const headDate = String(versions.head ?? '');
  const snapshot = newestSnapshot(dir);
  const files = readChanges(dir);
  const summary = renderSummary(files, readRoutes(dir), options?.format === 'markdown');
  if (!snapshot) return { ok: true, diffs: [], summary: summary || 'No snapshot yet.' };
  const diffs = diffSchemas(snapshot.schemas, head);
  const covered = headDate !== snapshot.date && files.some((file) => !file.draft && file.version === headDate);
  const ok = diffs.length === 0 || covered;
  let suggested: string | undefined;
  if (!ok && options?.suggest) suggested = writeDraft(dir, headDate, diffs);
  const diffText = diffs.map(renderDiff).join('\n');
  const body = [summary, diffText].filter((part) => part.length > 0).join('\n');
  return { ok, diffs, summary: body || 'No version changes.', suggested };
}

function newestSnapshot(dir: string): { date: string; schemas: Record<string, HeadField[]> } | undefined {
  const folder = join(dir, 'snapshots');
  if (!existsSync(folder)) return undefined;
  const names = readdirSync(folder).filter((name) => name.endsWith('.json')).sort();
  if (names.length === 0) return undefined;
  const name = names[names.length - 1]!;
  return { date: name.replace(/\.json$/, ''), schemas: JSON.parse(readFileSync(join(folder, name), 'utf8')) as Record<string, HeadField[]> };
}

function diffSchemas(before: Record<string, HeadField[]>, after: Record<string, HeadField[]>): SchemaDiff[] {
  const diffs: SchemaDiff[] = [];
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const schema of names) {
    const oldFields = before[schema] ?? [];
    const newFields = after[schema] ?? [];
    const removed = oldFields.filter((field) => !newFields.some((item) => item.name === field.name));
    const added = newFields.filter((field) => !oldFields.some((item) => item.name === field.name));
    if (removed.length === 1 && added.length === 1) {
      diffs.push({ schema, kind: 'renamed', path: added[0]!.name, from: removed[0]!.name, to: added[0]!.name });
    } else {
      for (const field of removed) diffs.push({ schema, kind: 'removed', path: field.name });
      for (const field of added) diffs.push({ schema, kind: 'added', path: field.name });
    }
    for (const field of newFields) {
      const previous = oldFields.find((item) => item.name === field.name);
      if (previous && (previous.type ?? 'unknown') !== (field.type ?? 'unknown')) {
        diffs.push({ schema, kind: 'type', path: field.name, from: previous.type, to: field.type });
      }
    }
  }
  return diffs;
}

function readChanges(dir: string): ChangeFile[] {
  if (!existsSync(dir)) return [];
  const files: ChangeFile[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.yaml') || name === 'versions.yaml') continue;
    const doc = parseYaml(readFileSync(join(dir, name), 'utf8'));
    if (!doc || typeof doc !== 'object') continue;
    const file = doc as { version?: string; id?: string; description?: string; draft?: boolean; changes?: ChangeFile['changes'] };
    files.push({ version: String(file.version ?? ''), id: String(file.id ?? name), description: String(file.description ?? ''), draft: file.draft === true, changes: file.changes ?? [] });
  }
  return files;
}

function readRoutes(dir: string): { method?: string; path?: string; schema?: string }[] {
  const routesPath = join(dir, 'routes.json');
  if (!existsSync(routesPath)) return [];
  const parsed = JSON.parse(readFileSync(routesPath, 'utf8')) as unknown;
  return Array.isArray(parsed) ? (parsed as { method?: string; path?: string; schema?: string }[]) : [];
}

function renderSummary(files: ChangeFile[], routes: { method?: string; path?: string; schema?: string }[], markdown: boolean): string {
  const active = files.filter((file) => !file.draft);
  if (active.length === 0) return markdown ? '## apiversa\n\nNo version changes.' : 'No version changes.';
  const lines = markdown ? ['## apiversa', ''] : [];
  for (const file of active) {
    const endpoints = endpointsFor(file, routes);
    const text = `${file.version} ${file.id}: ${file.description} Endpoints: ${endpoints.join(', ') || '(none declared)'}`;
    lines.push(markdown ? `- ${text}` : text);
  }
  return lines.join('\n');
}

function endpointsFor(file: ChangeFile, routes: { method?: string; path?: string; schema?: string }[]): string[] {
  const fromOps = file.changes.filter((op) => String(op.op ?? '').startsWith('endpoint.') && op.path).map((op) => `${op.method ?? 'GET'} ${op.path}`);
  if (fromOps.length > 0) return fromOps;
  const schemas = new Set(file.changes.map((op) => op.schema).filter((schema): schema is string => Boolean(schema)));
  return routes.filter((route) => route.schema && schemas.has(route.schema)).map((route) => `${route.method ?? 'GET'} ${route.path ?? ''}`);
}

function renderDiff(diff: SchemaDiff): string {
  if (diff.kind === 'renamed') return `${diff.schema}.${diff.from} renamed to ${diff.to}`;
  if (diff.kind === 'type') return `${diff.schema}.${diff.path} type ${diff.from ?? 'unknown'} -> ${diff.to ?? 'unknown'}`;
  return `${diff.schema}.${diff.path} ${diff.kind}`;
}

function writeDraft(dir: string, headDate: string, diffs: SchemaDiff[]): string | undefined {
  const ops = diffs.filter((diff) => diff.kind === 'added' || diff.kind === 'removed' || diff.kind === 'renamed');
  if (ops.length === 0 || !headDate) return undefined;
  const file = join(dir, `${headDate}.suggested.yaml`);
  if (existsSync(file)) return file;
  const changes = ops.map((diff) => {
    if (diff.kind === 'renamed') return `  - op: field.rename\n    schema: ${diff.schema}\n    from: ${diff.from}\n    to: ${diff.to}`;
    if (diff.kind === 'removed') return `  - op: field.remove\n    schema: ${diff.schema}\n    path: ${diff.path}\n    default: null`;
    return `  - op: field.add\n    schema: ${diff.schema}\n    path: ${diff.path}\n    default: null`;
  });
  const text = `version: "${headDate}"\nid: suggested\ndescription: "Draft from apiversa check."\ndraft: true\nchanges:\n${changes.join('\n')}\n`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, text);
  return file;
}
