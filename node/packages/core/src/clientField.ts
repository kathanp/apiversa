import type { Bundle } from './bundle/load.js';

/** A head validation path translated into the client's field name. */
export type ClientField = { field: string; headPath?: string };

export type FieldIssue = { path?: (string | number)[]; message?: string };

export type SchemaParser = {
  safeParse: (value: unknown) => { success: boolean; error?: { issues?: FieldIssue[] } };
};

export type ClientIssue = { field: string; path?: string; message: string };

type Seg = { name: string; index?: string };

/**
 * The field name an old client understands.
 * A field added after that version is `_head`, and `headPath` keeps the head path.
 */
export function clientField(bundle: Bundle, version: string, schema: string, headPath: string): ClientField {
  let path = headPath;
  let introduced = false;
  const newer = bundle.changes.filter((change) => change.version > version);
  newer.sort((left, right) => (left.version < right.version ? 1 : left.version > right.version ? -1 : left.id < right.id ? 1 : left.id > right.id ? -1 : 0));
  for (const change of newer) {
    for (const op of [...change.ops].reverse()) {
      if (op.schema && op.schema !== schema) continue;
      if ((op.op === 'field.rename' || op.op === 'field.move' || op.op === 'field.alias') && op.to && op.from) path = replacePath(path, op.to, op.from);
      else if (op.op === 'field.copy' && op.to && covers(path, op.to)) introduced = true;
      else if (op.op === 'field.add' && op.path && covers(path, op.path)) introduced = true;
    }
  }
  return introduced ? { field: '_head', headPath } : { field: path };
}

/**
 * When a head schema rejects an upgraded body, report each issue with the client's field name.
 * A passing parse returns undefined. A head-only field is `_head`, never the head name.
 */
export function clientValidation(bundle: Bundle, version: string, schema: string, body: unknown, parser: SchemaParser): ClientIssue[] | undefined {
  const parsed = parser.safeParse(body);
  if (parsed.success) return undefined;
  return (parsed.error?.issues ?? []).map((issue) => {
    const headPath = joinIssue(issue.path ?? []);
    const client = clientField(bundle, version, schema, headPath);
    return { field: client.field, ...(client.headPath !== undefined ? { path: client.headPath } : {}), message: issue.message ?? '' };
  });
}

function joinIssue(path: (string | number)[]): string {
  let out = '';
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else out += out.length === 0 ? part : `.${part}`;
  }
  return out;
}

function replacePath(actual: string, to: string, from: string): string {
  const actualSegs = splitPath(actual);
  const toSegs = splitPath(to);
  if (toSegs.length === 0 || actualSegs.length < toSegs.length) return actual;
  for (let i = 0; i < toSegs.length; i += 1) if (actualSegs[i]!.name !== toSegs[i]!.name) return actual;
  const fromSegs = splitPath(from);
  const out: Seg[] = [];
  for (let i = 0; i < fromSegs.length; i += 1) {
    let index = fromSegs[i]!.index;
    const actualIndex = actualSegs[i]?.index;
    if (actualIndex !== undefined && actualIndex !== '[]') index = actualIndex;
    out.push({ name: fromSegs[i]!.name, index });
  }
  for (let i = toSegs.length; i < actualSegs.length; i += 1) out.push(actualSegs[i]!);
  return joinPath(out);
}

function covers(actual: string, added: string): boolean {
  const actualSegs = splitPath(actual);
  const addedSegs = splitPath(added);
  if (addedSegs.length === 0 || actualSegs.length < addedSegs.length) return false;
  for (let i = 0; i < addedSegs.length; i += 1) if (actualSegs[i]!.name !== addedSegs[i]!.name) return false;
  return true;
}

function splitPath(path: string): Seg[] {
  if (path.length === 0) return [];
  return path.split('.').map((part) => {
    const bracket = part.indexOf('[');
    if (bracket < 0) return { name: part };
    return { name: part.slice(0, bracket), index: part.slice(bracket) };
  });
}

function joinPath(segs: Seg[]): string {
  return segs.map((seg) => `${seg.name}${seg.index ?? ''}`).join('.');
}
