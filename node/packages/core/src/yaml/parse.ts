import { fail } from '../errors.js';

/**
 * Indent-based YAML subset. No anchors, aliases, tags, or tabs.
 * Enough for versions.yaml and change files. Not a general YAML library.
 */
export function parseYaml(text: string): unknown {
  if (text.includes('\0')) throw fail('AV-E001', 'startup', 'NUL in YAML');
  const lines = preprocess(text);
  if (lines.length === 0) return null;
  const cursor = { i: 0 };
  const value = parseBlock(lines, cursor, lines[0]!.indent);
  if (cursor.i < lines.length) throw fail('AV-E001', 'startup', 'trailing YAML');
  return value;
}

type Line = { indent: number; text: string };

function preprocess(text: string): Line[] {
  const out: Line[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.includes('\t')) throw fail('AV-E001', 'startup', 'tab in YAML');
    const stripped = stripComment(raw).trimEnd();
    if (stripped.trim() === '') continue;
    const indent = stripped.search(/\S/);
    out.push({ indent, text: stripped.slice(indent) });
  }
  return out;
}

function stripComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]!;
    if (quote) {
      if (c === quote && line[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '#') return line.slice(0, i);
  }
  return line;
}

function parseBlock(lines: Line[], cursor: { i: number }, indent: number): unknown {
  if (cursor.i >= lines.length) return null;
  const line = lines[cursor.i]!;
  if (line.indent < indent) return null;
  if (line.text.startsWith('- ') || line.text === '-') return parseSeq(lines, cursor, line.indent);
  return parseMap(lines, cursor, line.indent);
}

function parseSeq(lines: Line[], cursor: { i: number }, indent: number): unknown[] {
  const arr: unknown[] = [];
  while (cursor.i < lines.length && lines[cursor.i]!.indent === indent && lines[cursor.i]!.text.startsWith('-')) {
    const text = lines[cursor.i]!.text.replace(/^- /, '').replace(/^-/, '');
    cursor.i += 1;
    if (text === '') {
      arr.push(parseBlock(lines, cursor, indent + 1));
      continue;
    }
    if (text.startsWith('{') || text.startsWith('[')) {
      arr.push(parseFlowValue(text));
      continue;
    }
    const key = splitKey(text);
    if (key) {
      const map = empty();
      put(map, key.name, key.value === '' ? nested(lines, cursor, indent) : parseScalar(key.value));
      while (cursor.i < lines.length && lines[cursor.i]!.indent > indent && !lines[cursor.i]!.text.startsWith('-')) {
        const item = lines[cursor.i]!;
        const pair = splitKey(item.text);
        if (!pair) throw fail('AV-E001', 'startup', `bad YAML sequence key ${item.text}`);
        cursor.i += 1;
        put(map, pair.name, pair.value === '' ? nested(lines, cursor, item.indent) : parseScalar(pair.value));
      }
      arr.push(toPlain(map));
      continue;
    }
    arr.push(parseScalar(text));
  }
  return arr;
}

function parseMap(lines: Line[], cursor: { i: number }, indent: number): unknown {
  const map = empty();
  while (cursor.i < lines.length && lines[cursor.i]!.indent === indent) {
    const line = lines[cursor.i]!;
    if (line.text.startsWith('- ')) break;
    const pair = splitKey(line.text);
    if (!pair) throw fail('AV-E001', 'startup', `bad YAML key ${line.text}`);
    cursor.i += 1;
    put(map, pair.name, pair.value === '' ? nested(lines, cursor, indent) : parseScalar(pair.value));
  }
  return toPlain(map);
}

function nested(lines: Line[], cursor: { i: number }, parentIndent: number): unknown {
  if (cursor.i >= lines.length || lines[cursor.i]!.indent <= parentIndent) return null;
  return parseBlock(lines, cursor, lines[cursor.i]!.indent);
}

type Pair = { name: string; value: string };

function splitKey(text: string): Pair | null {
  if (text.startsWith('-')) return null;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === ':' && (text[i + 1] === ' ' || text[i + 1] === undefined)) {
      return { name: unquoteKey(text.slice(0, i).trim()), value: text.slice(i + 1).trim() };
    }
  }
  return null;
}

function unquoteKey(key: string): string {
  rejectDanger(key);
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) return unquote(key);
  return key;
}

function parseScalar(text: string): unknown {
  if (text.startsWith('{') || text.startsWith('[')) return parseFlowValue(text);
  if (text.startsWith('"') || text.startsWith("'")) return unquote(text);
  rejectDanger(text);
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null' || text === '~' || text === '') return null;
  if (/^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(text)) return Number(text);
  return text;
}

function rejectDanger(text: string): void {
  if (text.startsWith('&') || text.startsWith('!') || text.startsWith('*') || text.startsWith('<<')) {
    throw fail('AV-E001', 'startup', 'YAML anchor, alias, or tag');
  }
}

function unquote(text: string): string {
  const q = text[0];
  if ((q !== '"' && q !== "'") || text.at(-1) !== q) throw fail('AV-E001', 'startup', 'bad quote');
  const body = text.slice(1, -1);
  if (q === "'") return body.replace(/''/g, "'");
  return body.replace(/\\(["\\/nrt])/g, (_, e: string) => {
    if (e === 'n') return '\n';
    if (e === 'r') return '\r';
    if (e === 't') return '\t';
    return e;
  });
}

function parseFlowValue(text: string): unknown {
  const parsed = parseFlow(text, 0);
  if (skipWs(text, parsed.i) !== text.length) throw fail('AV-E001', 'startup', 'trailing flow YAML');
  return parsed.value;
}

function parseFlow(text: string, i: number): { value: unknown; i: number } {
  i = skipWs(text, i);
  const c = text[i];
  if (c === '{') return parseFlowMap(text, i + 1);
  if (c === '[') return parseFlowSeq(text, i + 1);
  if (c === '"' || c === "'") {
    const end = endQuote(text, i);
    return { value: unquote(text.slice(i, end)), i: end };
  }
  const start = i;
  while (i < text.length && text[i] !== ',' && text[i] !== '}' && text[i] !== ']' && text[i] !== ':') i += 1;
  return { value: parseScalar(text.slice(start, i).trim()), i };
}

function parseFlowMap(text: string, i: number): { value: unknown; i: number } {
  const map = empty();
  i = skipWs(text, i);
  if (text[i] === '}') return { value: toPlain(map), i: i + 1 };
  for (;;) {
    i = skipWs(text, i);
    const key = parseFlow(text, i);
    if (typeof key.value !== 'string') throw fail('AV-E001', 'startup', 'flow key');
    i = skipWs(text, key.i);
    if (text[i] !== ':') throw fail('AV-E001', 'startup', 'flow colon');
    const val = parseFlow(text, i + 1);
    put(map, key.value, val.value);
    i = skipWs(text, val.i);
    if (text[i] === ',') {
      i += 1;
      continue;
    }
    if (text[i] === '}') return { value: toPlain(map), i: i + 1 };
    throw fail('AV-E001', 'startup', 'flow map');
  }
}

function parseFlowSeq(text: string, i: number): { value: unknown; i: number } {
  const arr: unknown[] = [];
  i = skipWs(text, i);
  if (text[i] === ']') return { value: arr, i: i + 1 };
  for (;;) {
    const item = parseFlow(text, i);
    arr.push(item.value);
    i = skipWs(text, item.i);
    if (text[i] === ',') {
      i += 1;
      continue;
    }
    if (text[i] === ']') return { value: arr, i: i + 1 };
    throw fail('AV-E001', 'startup', 'flow sequence');
  }
}

function endQuote(text: string, i: number): number {
  const q = text[i]!;
  for (let j = i + 1; j < text.length; j += 1) {
    if (text[j] === '\\' && q === '"') {
      j += 1;
      continue;
    }
    if (text[j] === q) return j + 1;
  }
  throw fail('AV-E001', 'startup', 'unterminated YAML string');
}

function skipWs(text: string, i: number): number {
  while (i < text.length && (text[i] === ' ' || text[i] === '\n' || text[i] === '\r')) i += 1;
  return i;
}

type Ordered = { keys: string[]; values: Map<string, unknown> };

function empty(): Ordered {
  return { keys: [], values: new Map() };
}

function put(map: Ordered, key: string, value: unknown): void {
  rejectDanger(key);
  if (map.values.has(key)) throw fail('AV-E001', 'startup', `duplicate YAML key ${key}`);
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
  map.keys.push(key);
  map.values.set(key, value);
}

function toPlain(map: Ordered): Record<string, unknown> {
  const out = Object.create(null) as Record<string, unknown>;
  for (const key of map.keys) out[key] = map.values.get(key);
  return out;
}
