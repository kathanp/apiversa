import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseYaml } from '../yaml/parse.js';

export type ChangelogDocument = { versions: { date: string; changes: { id: string; description: string; endpoints: string[] }[] }[] };

type ChangeFile = { version: string; id: string; description: string; draft: boolean; changes: { op?: string; method?: string; path?: string; from?: string; to?: string; schema?: string }[] };

/**
 * Markdown and JSON for the API changelog.
 * Each version lists the description of every change and the endpoints it touches.
 */
export function changelogBundle(dir: string): { markdown: string; json: ChangelogDocument } {
  const versions = parseYaml(readFileSync(join(dir, 'versions.yaml'), 'utf8')) as { versions?: { date?: string }[] };
  const dates = (versions.versions ?? []).map((item) => String(item.date ?? '')).filter(Boolean);
  const files = readChanges(dir).filter((file) => !file.draft);
  const routes = readRoutes(dir);
  const json: ChangelogDocument = {
    versions: dates.map((date) => ({
      date,
      changes: files
        .filter((file) => file.version === date)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((file) => ({ id: file.id, description: file.description, endpoints: endpointsFor(file, routes) })),
    })),
  };
  return { markdown: render(json), json };
}

/** Write `changelog.md` and `changelog.json` next to the bundle. */
export function writeChangelog(dir: string): { markdown: string; json: ChangelogDocument; markdownPath: string; jsonPath: string } {
  const result = changelogBundle(dir);
  const markdownPath = join(dir, 'changelog.md');
  const jsonPath = join(dir, 'changelog.json');
  writeFileSync(markdownPath, `${result.markdown}\n`);
  writeFileSync(jsonPath, `${JSON.stringify(result.json)}\n`);
  return { ...result, markdownPath, jsonPath };
}

function render(doc: ChangelogDocument): string {
  const lines: string[] = [];
  for (const version of doc.versions) {
    lines.push(`## ${version.date}`, '');
    if (version.changes.length === 0) lines.push('_No changes._', '');
    for (const change of version.changes) {
      lines.push(`- ${change.id}: ${change.description}`);
      lines.push(`  Endpoints: ${change.endpoints.join(', ') || '(none declared)'}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
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

function endpointsFor(file: ChangeFile, routes: { method?: string; path?: string; schema?: string }[]): string[] {
  const fromOps = file.changes
    .filter((op) => String(op.op ?? '').startsWith('endpoint.'))
    .map((op) => {
      if (op.op === 'endpoint.method' && op.path) return `${op.from ?? 'GET'} ${op.path} -> ${op.to ?? 'GET'} ${op.path}`;
      if (op.path) return `${op.method ?? 'GET'} ${op.path}`;
      if (op.from && op.to) return `${op.method ?? 'GET'} ${op.from} -> ${op.to}`;
      return '';
    })
    .filter(Boolean);
  if (fromOps.length > 0) return fromOps;
  const schemas = new Set(file.changes.map((op) => op.schema).filter((schema): schema is string => Boolean(schema)));
  return routes.filter((route) => route.schema && schemas.has(route.schema)).map((route) => `${route.method ?? 'GET'} ${route.path ?? ''}`);
}
