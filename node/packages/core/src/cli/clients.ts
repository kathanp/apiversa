import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle } from '../bundle/load.js';
import { ApiversaError } from '../errors.js';
import { schemaFieldsAt, type HeadField } from './generate.js';

export type ClientLang = 'java' | 'python';

/** One source file per schema per date. `java` is the CLIENT-03 record. */
export function clientSources(dir: string, lang: ClientLang, today?: string, pkg = 'apiversa.client.generated'): { name: string; text: string }[] {
  const head = JSON.parse(readFileSync(join(dir, 'head.json'), 'utf8')) as Record<string, HeadField[]>;
  const bundle = loadBundle(dir, { today, registry: registry(head) });
  const names = new Set(Object.keys(head));
  const files: { name: string; text: string }[] = [];
  for (const date of bundle.dates) {
    const shapes = schemaFieldsAt(head, bundle, date);
    for (const [schema, fields] of Object.entries(shapes)) {
      const type = `${schema}_${date.replaceAll('-', '_')}`;
      if (lang === 'python') files.push({ name: `${type}.py`, text: pythonFile(type, fields, date, names) });
      else files.push({ name: `${type}.java`, text: javaFile(pkg, type, fields) });
    }
  }
  return files;
}

/** Write `generated/` for one language. Omitting the language is Java. */
export function writeClientFiles(dir: string, lang: ClientLang = 'java', today?: string, pkg = 'apiversa.client.generated'): string[] {
  if (lang !== 'java' && lang !== 'python') throw new ApiversaError('AV-E001', 'startup');
  const outDir = join(dir, 'generated');
  mkdirSync(outDir, { recursive: true });
  return clientSources(dir, lang, today, pkg).map((file) => {
    const path = join(outDir, file.name);
    writeFileSync(path, file.text);
    return path;
  });
}

function registry(head: Record<string, HeadField[]>): Record<string, { fields: { name: string }[] }> {
  const out: Record<string, { fields: { name: string }[] }> = {};
  for (const [name, fields] of Object.entries(head)) out[name] = { fields: fields.map((field) => ({ name: field.name })) };
  return out;
}

function pythonFile(type: string, fields: HeadField[], date: string, names: Set<string>): string {
  const lines = [`class ${type}:`];
  if (fields.length === 0) lines.push('    pass');
  else for (const field of fields) lines.push(`    ${field.name}: ${pythonType(field.type, date, names)}`);
  return `${lines.join('\n')}\n`;
}

function pythonType(type: string | undefined, date: string, names: Set<string>): string {
  if (type === 'boolean') return 'bool';
  if (type === 'integer') return 'int';
  if (type === 'number') return 'float';
  if (type === 'array' || type === 'list') return 'list';
  if (type && names.has(type)) return `${type}_${date.replaceAll('-', '_')}`;
  return 'str';
}

function javaFile(pkg: string, type: string, fields: HeadField[]): string {
  const params = fields.map((field) => `${javaType(field.type)} ${field.name}`).join(', ');
  return `package ${pkg};\n\npublic record ${type}(${params}) {}\n`;
}

function javaType(type: string | undefined): string {
  if (type === 'boolean') return 'Boolean';
  if (type === 'integer') return 'long';
  if (type === 'number') return 'double';
  return 'String';
}
