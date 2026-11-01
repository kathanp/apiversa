import type { Apiversa } from './create.js';

/**
 * One NDJSON line in the client's shape. Blank lines and non-JSON lines pass through.
 * Callers that stream must write this line before reading the next one.
 */
export function downgradeNdjsonLine(av: Apiversa, line: string, schema: string, version: string): string {
  return downgradeJsonLine(av, line, schema, version);
}

/** One SSE line. Only a `data:` JSON payload changes. Other lines pass through. */
export function downgradeSseLine(av: Apiversa, line: string, schema: string, version: string): string {
  if (!line.startsWith('data:')) return line;
  const payload = line.slice(5).trim();
  if (payload.length === 0) return line;
  return `data: ${downgradeJsonLine(av, payload, schema, version)}`;
}

/** Read one character at a time and write each converted line before the next line is read. */
export function downgradeNdjson(av: Apiversa, read: () => number, schema: string, version: string, write: (text: string) => void): void {
  streamLines(av, read, schema, version, write, false);
}

/** Same as {@link downgradeNdjson}, for `text/event-stream` lines. */
export function downgradeSse(av: Apiversa, read: () => number, schema: string, version: string, write: (text: string) => void): void {
  streamLines(av, read, schema, version, write, true);
}

function streamLines(av: Apiversa, read: () => number, schema: string, version: string, write: (text: string) => void, sse: boolean): void {
  let line = '';
  let value = read();
  while (value !== -1) {
    if (value === 10) {
      const text = sse ? downgradeSseLine(av, stripCr(line), schema, version) : downgradeNdjsonLine(av, stripCr(line), schema, version);
      write(`${text}\n`);
      line = '';
    } else {
      line += String.fromCharCode(value);
    }
    value = read();
  }
  if (line.length > 0) write(sse ? downgradeSseLine(av, stripCr(line), schema, version) : downgradeNdjsonLine(av, stripCr(line), schema, version));
}

function stripCr(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

function downgradeJsonLine(av: Apiversa, line: string, schema: string, version: string): string {
  const trimmed = line.trim();
  if (trimmed.length === 0 || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return line;
  if (av.planIsEmpty(version, schema, 'down')) return line;
  const body = av.convertResponse({ schema, version, body: JSON.parse(trimmed) as unknown });
  return JSON.stringify(body);
}
