import type { Direction } from './errors.js';
import { parseQuery, type Apiversa } from './create.js';

export type FormResult = { fields: Record<string, string>; body: string };

/**
 * Convert `application/x-www-form-urlencoded` or the text fields of `multipart/form-data`
 * with the same field ops as JSON. A part with a filename is copied through unchanged.
 */
export function convertForm(av: Apiversa, body: string, contentType: string, schema: string, version: string, direction: Direction): FormResult {
  if (contentType.includes('multipart/form-data')) return convertMultipart(av, body, contentType, schema, version, direction);
  if (!contentType.includes('application/x-www-form-urlencoded')) return { fields: {}, body };
  const fields = fold(parseQuery(body));
  const converted = applyFields(av, fields, schema, version, direction);
  return { fields: converted, body: encodeForm(converted) };
}

function convertMultipart(av: Apiversa, body: string, contentType: string, schema: string, version: string, direction: Direction): FormResult {
  const boundary = readBoundary(contentType);
  if (!boundary) return { fields: {}, body };
  const marker = `--${boundary}`;
  const chunks = body.split(marker);
  const text: Record<string, string> = {};
  const names: string[] = [];
  for (const chunk of chunks) {
    if (isFilePart(chunk)) continue;
    const name = partName(chunk);
    if (!name) continue;
    names.push(name);
    text[name] = partValue(chunk);
  }
  const converted = applyFields(av, text, schema, version, direction);
  const rename = renamed(text, converted);
  let out = chunks[0] ?? '';
  const closing = chunks.length > 0 ? chunks[chunks.length - 1] ?? '' : '';
  const middle = chunks.slice(1, -1);
  const emitted = new Set<string>();
  for (const chunk of middle) {
    if (isFilePart(chunk)) {
      out += marker + chunk;
      continue;
    }
    const name = partName(chunk);
    if (!name) {
      out += marker + chunk;
      continue;
    }
    const next = rename.get(name);
    if (!next) continue;
    emitted.add(next);
    out += marker + rewritePart(chunk, next, converted[next] ?? '');
  }
  for (const [name, value] of Object.entries(converted)) {
    if (emitted.has(name) || names.includes(name)) continue;
    out += `${marker}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  }
  if (chunks.length > 1) out += marker + closing;
  return { fields: converted, body: out };
}

function applyFields(av: Apiversa, fields: Record<string, string>, schema: string, version: string, direction: Direction): Record<string, string> {
  const prepared = av.prepare(direction, { schema, body: fields, version });
  const body = prepared.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    out[key] = value === null ? '' : String(value);
  }
  return out;
}

function fold(pairs: { name: string; value: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const pair of pairs) fields[pair.name] = pair.value;
  return fields;
}

function encodeForm(fields: Record<string, string>): string {
  return Object.entries(fields).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}

function readBoundary(contentType: string): string | undefined {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  return boundary && boundary.length > 0 ? boundary : undefined;
}

function isFilePart(chunk: string): boolean {
  const header = chunk.split(/\r?\n\r?\n/)[0] ?? '';
  return /filename=/i.test(header);
}

function partName(chunk: string): string | undefined {
  const header = chunk.split(/\r?\n\r?\n/)[0] ?? '';
  const match = /name="([^"]*)"|name=([^;\s]+)/i.exec(header);
  const name = match?.[1] ?? match?.[2];
  return name && name.length > 0 ? name : undefined;
}

function partValue(chunk: string): string {
  const split = chunk.split(/\r?\n\r?\n/);
  const value = split.slice(1).join('\n\n');
  return value.replace(/\r?\n$/, '');
}

function renamed(before: Record<string, string>, after: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const name of Object.keys(before)) {
    if (Object.prototype.hasOwnProperty.call(after, name)) {
      map.set(name, name);
      used.add(name);
    }
  }
  const created = Object.keys(after).filter((key) => !used.has(key));
  const removed = Object.keys(before).filter((name) => !map.has(name));
  removed.forEach((name, index) => {
    const next = created[index];
    if (next) map.set(name, next);
  });
  return map;
}

function rewritePart(chunk: string, name: string, value: string): string {
  const splitAt = chunk.search(/\r?\n\r?\n/);
  const header = splitAt === -1 ? chunk : chunk.slice(0, splitAt);
  const line = header.includes('\r\n') ? '\r\n' : '\n';
  const rewritten = header.replace(/name="[^"]*"|name=[^;\s]+/i, `name="${name}"`);
  return `${rewritten}${line}${line}${value}${line}`;
}
