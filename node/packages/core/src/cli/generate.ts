import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle, type Bundle } from '../bundle/load.js';
import type { Registry } from '../json/parse.js';
import type { RawOp } from '../model.js';

export type HeadField = { name: string; type?: string };

/**
 * Write `generated/<date>.ts` for every version.
 * `head.json` lists each head schema's fields in order.
 * Older files drop fields a later `field.add` introduced and undo top-level renames and moves.
 */
export function generate(dir: string, today?: string): string[] {
  const head = JSON.parse(readFileSync(join(dir, 'head.json'), 'utf8')) as Record<string, HeadField[]>;
  const registry: Registry = {};
  for (const [name, fields] of Object.entries(head)) registry[name] = { fields: fields.map((field) => ({ name: field.name })) };
  return writeGenerated(dir, loadBundle(dir, { today, registry }), head);
}

/** Write one Zod module per version from an already loaded bundle. */
export function writeGenerated(dir: string, bundle: Bundle, head: Record<string, HeadField[]>): string[] {
  const outDir = join(dir, 'generated');
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const date of bundle.dates) {
    const file = join(outDir, `${date}.ts`);
    writeFileSync(file, render(shapesAt(head, bundle, date), date));
    written.push(file);
  }
  return written;
}

/** Fields each schema had on `date`, rewound from the head list. */
export function schemaFieldsAt(head: Record<string, HeadField[]>, bundle: Bundle, date: string): Record<string, HeadField[]> {
  return shapesAt(head, bundle, date);
}

function shapesAt(head: Record<string, HeadField[]>, bundle: Bundle, date: string): Record<string, HeadField[]> {
  const schemas: Record<string, HeadField[]> = {};
  for (const [name, fields] of Object.entries(head)) schemas[name] = fields.map((field) => ({ ...field }));
  const newer = bundle.changes.filter((change) => change.version > date);
  newer.sort((left, right) => right.version.localeCompare(left.version) || right.id.localeCompare(left.id));
  for (const change of newer) {
    for (const op of [...change.ops].reverse()) applyOlder(schemas, op);
  }
  return schemas;
}

function applyOlder(schemas: Record<string, HeadField[]>, op: RawOp): void {
  if (!op.schema || !schemas[op.schema]) return;
  const fields = schemas[op.schema]!;
  if (op.op === 'field.add' && simple(op.path)) {
    const index = fields.findIndex((field) => field.name === op.path);
    if (index >= 0) fields.splice(index, 1);
  } else if (op.op === 'field.remove' && simple(op.path)) {
    if (!fields.some((field) => field.name === op.path)) fields.push({ name: op.path, type: 'unknown' });
  } else if (op.op === 'field.copy' && simple(op.to)) {
    const index = fields.findIndex((field) => field.name === op.to);
    if (index >= 0) fields.splice(index, 1);
  } else if ((op.op === 'field.rename' || op.op === 'field.move' || op.op === 'field.alias') && simple(op.from) && simple(op.to)) {
    const field = fields.find((item) => item.name === op.to);
    if (field) field.name = op.from!;
  } else if (op.op === 'field.type' && simple(op.path)) {
    const field = fields.find((item) => item.name === op.path);
    if (field) field.type = 'unknown';
  } else if (op.op === 'field.join' && simple(op.from) && simple(op.left) && simple(op.right)) {
    const index = fields.findIndex((field) => field.name === op.from);
    const left = { name: op.left, type: 'string' };
    const right = { name: op.right, type: 'string' };
    if (index >= 0) fields.splice(index, 1, left, right);
    else {
      if (!fields.some((field) => field.name === op.left)) fields.push(left);
      if (!fields.some((field) => field.name === op.right)) fields.push(right);
    }
  } else if (op.op === 'field.list' && simple(op.from) && simple(op.to)) {
    const field = fields.find((item) => item.name === op.to);
    if (field) {
      field.name = op.from;
      if (field.type === 'array' || field.type === 'list') field.type = 'string';
    }
  } else if (op.op === 'field.null' && simple(op.path)) {
    const index = fields.findIndex((field) => field.name === op.path);
    if (index >= 0) fields.splice(index, 1);
  }
}

function simple(path: string | undefined): path is string {
  return Boolean(path && /^[A-Za-z_][A-Za-z0-9_]*$/.test(path));
}

function render(schemas: Record<string, HeadField[]>, date: string): string {
  const lines = ["import { z } from 'zod';", ''];
  for (const [name, fields] of Object.entries(schemas)) {
    const id = `${name}_${date.replaceAll('-', '_')}`;
    const body = fields.map((field) => `  ${JSON.stringify(field.name)}: ${zodType(field.type)},`).join('\n');
    lines.push(`export const ${id} = z.object({`, body, '});');
    lines.push(`export type ${id} = z.infer<typeof ${id}>;`, '');
  }
  return `${lines.join('\n')}`;
}

function zodType(type: string | undefined): string {
  switch (type) {
    case 'string':
      return 'z.string()';
    case 'number':
      return 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    default:
      return 'z.unknown()';
  }
}
