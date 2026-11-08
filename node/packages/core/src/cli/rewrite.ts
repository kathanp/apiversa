import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadBundle } from '../bundle/load.js';
import { execute } from '../chain/run.js';
import { ApiversaError, type Direction, type ErrorCode } from '../errors.js';
import { encodeJson } from '../json/encode.js';
import { fromPlain } from '../json/parse.js';

export type RewriteFailure = { ok: false; code: ErrorCode; line?: number };
export type RewriteResult = { ok: true; bytes: string } | RewriteFailure;

/** Read JSONL and write each line in the other version. A failure removes `--out`. */
export function rewriteJsonl(dir: string, options: { schema: string; direction: Direction; version: string; input: string; out: string }): RewriteResult {
  const bundle = loadBundle(dir);
  const lines = linesOf(readFileSync(options.input, 'utf8'));
  if (lines.length > bundle.limits.maxArrayItems) return fail(options.out, 'AV-E019');
  const written: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.trim() === '') return fail(options.out, 'AV-E016', index + 1);
    try {
      const body = execute(bundle, { schema: options.schema, version: options.version, body: line, trace: false }, options.direction).body;
      written.push(encodeJson(fromPlain(body, options.direction), options.direction));
    } catch (error) {
      const code = error instanceof ApiversaError ? error.code : 'AV-E016';
      return fail(options.out, code, index + 1);
    }
  }
  const bytes = written.length === 0 ? '' : `${written.join('\n')}\n`;
  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(options.out, bytes);
  return { ok: true, bytes };
}

export function rewriteFailure(result: RewriteFailure): string {
  return result.line === undefined ? result.code : `line ${result.line}: ${result.code}`;
}

function linesOf(text: string): string[] {
  let body = text;
  if (body.endsWith('\r\n')) body = body.slice(0, -2);
  else if (body.endsWith('\n')) body = body.slice(0, -1);
  if (body.length === 0) return [];
  return body.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
}

function fail(out: string, code: ErrorCode, line?: number): RewriteFailure {
  if (existsSync(out)) rmSync(out);
  return line === undefined ? { ok: false, code } : { ok: false, code, line };
}
