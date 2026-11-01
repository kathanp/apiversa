import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle } from '../bundle/load.js';
import { schemaFieldsAt, type HeadField } from './generate.js';

/**
 * TypeScript field diff of each schema between a version and the one before it.
 * The text is for `apiversa changelog --types`. Nothing is sent.
 */
export function typeDiff(dir: string, today?: string): string {
  const headPath = join(dir, 'head.json');
  if (!existsSync(headPath)) return '';
  const head = JSON.parse(readFileSync(headPath, 'utf8')) as Record<string, HeadField[]>;
  const bundle = loadBundle(dir, { today, registry: registry(head) });
  const lines: string[] = ['# Types', ''];
  for (let index = 0; index < bundle.dates.length - 1; index += 1) {
    const date = bundle.dates[index]!;
    const older = bundle.dates[index + 1]!;
    const next = schemaFieldsAt(head, bundle, date);
    const prev = schemaFieldsAt(head, bundle, older);
    lines.push(`## ${date}`, '');
    for (const name of Object.keys(next)) {
      const diff = fieldsDiff(prev[name] ?? [], next[name] ?? []);
      if (diff.length === 0) continue;
      lines.push(`### ${name}`, '```ts', ...diff, '```', '');
    }
  }
  return lines.join('\n').trimEnd();
}

function registry(head: Record<string, HeadField[]>) {
  const out: Record<string, { fields: { name: string }[] }> = {};
  for (const [name, fields] of Object.entries(head)) out[name] = { fields: fields.map((field) => ({ name: field.name })) };
  return out;
}

function fieldsDiff(before: HeadField[], after: HeadField[]): string[] {
  const lines: string[] = [];
  const beforeNames = new Map(before.map((field) => [field.name, field.type ?? 'unknown']));
  const afterNames = new Map(after.map((field) => [field.name, field.type ?? 'unknown']));
  for (const [name, type] of beforeNames) if (!afterNames.has(name)) lines.push(`- ${name}: ${type}`);
  for (const [name, type] of afterNames) if (!beforeNames.has(name)) lines.push(`+ ${name}: ${type}`);
  return lines;
}
