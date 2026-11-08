import { fail } from '../errors.js';
import type { Bundle } from '../bundle/load.js';

const DATE = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export type HeaderInput = Record<string, string | string[] | undefined> | [string, string][];

export function readHeader(headers: HeaderInput | undefined, name: string): string[] {
  if (!headers) return [];
  const want = name.toLowerCase();
  const raw: string[] = [];
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) if (key.toLowerCase() === want) raw.push(value);
  } else {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() !== want || value === undefined) continue;
      raw.push(...(Array.isArray(value) ? value : [value]));
    }
  }
  return raw.flatMap((value) => value.split(',')).map((value) => value.trim()).filter((value) => value.length > 0);
}

export type VersionSource = 'header' | 'media' | 'query' | 'resolver' | 'prefix' | 'pin' | 'default';

export type ResolveInput = {
  headers?: HeaderInput;
  headerName?: string;
  resolved?: string | undefined;
  clientId?: string;
  path?: string;
  query?: string;
  legacyPrefixes?: Record<string, string>;
  /** Read a `version` parameter on `Content-Type` only when the host sets this. */
  mediaType?: boolean;
  /** Query parameter name. Unset means the query is not read. */
  queryName?: string;
};

export function resolveVersion(bundle: Bundle, input: ResolveInput): string {
  return resolveDecision(bundle, input).version;
}

/** The date that won, and which rule selected it. */
export function resolveDecision(bundle: Bundle, input: ResolveInput): { version: string; source: VersionSource } {
  const values = readHeader(input.headers, input.headerName ?? 'Api-Version');
  const distinct = [...new Set(values)];
  if (distinct.length > 1) throw fail('AV-E002', 'up', 'distinct version headers', bundle.dates);
  const header = distinct[0];
  if (header) return { version: classify(bundle, header), source: 'header' };
  if (input.mediaType) {
    const media = mediaVersion(readHeader(input.headers, 'content-type'));
    if (media !== undefined) return { version: classify(bundle, media), source: 'media' };
  }
  if (input.queryName) {
    const query = queryVersion(input.query ?? queryFromPath(input.path), input.queryName);
    if (query !== undefined) return { version: classify(bundle, query), source: 'query' };
  }
  if (input.resolved !== undefined && input.resolved !== '') return { version: classify(bundle, input.resolved), source: 'resolver' };
  const fromPrefix = prefixVersion(input.path, input.legacyPrefixes);
  if (fromPrefix) return { version: classify(bundle, fromPrefix), source: 'prefix' };
  return applyDefault(bundle, input.clientId);
}

/** Longest prefix wins. A prefix matches the path or a path under it. */
export function prefixVersion(path: string | undefined, prefixes: Record<string, string> | undefined): string | undefined {
  if (!path || !prefixes) return undefined;
  const pathname = path.split('?')[0] ?? path;
  const keys = Object.keys(prefixes).sort((left, right) => right.length - left.length);
  for (const prefix of keys) {
    const root = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    if (pathname === root || pathname.startsWith(`${root}/`)) return prefixes[prefix];
  }
  return undefined;
}

/** A `version` parameter after the media type, or `undefined` when that parameter is absent. */
function mediaVersion(values: string[]): string | undefined {
  const found: string[] = [];
  for (const value of values) {
    const semi = value.indexOf(';');
    if (semi < 0) continue;
    let start = semi + 1;
    while (start <= value.length) {
      const next = value.indexOf(';', start);
      const end = next < 0 ? value.length : next;
      const part = value.slice(start, end).trim();
      const eq = part.indexOf('=');
      if (eq > 0 && part.slice(0, eq).trim().toLowerCase() === 'version') found.push(unquote(part.slice(eq + 1).trim()));
      if (next < 0) break;
      start = next + 1;
    }
  }
  if (found.length === 0) return undefined;
  if (new Set(found).size > 1) return '';
  return found[0];
}

function queryVersion(query: string | undefined, name: string): string | undefined {
  if (!query) return undefined;
  const text = query.startsWith('?') ? query.slice(1) : query;
  const found: string[] = [];
  let start = 0;
  while (start <= text.length) {
    const next = text.indexOf('&', start);
    const end = next < 0 ? text.length : next;
    const pair = text.slice(start, end);
    const eq = pair.indexOf('=');
    const key = decode(eq < 0 ? pair : pair.slice(0, eq));
    if (key === name) found.push(eq < 0 ? '' : decode(pair.slice(eq + 1)));
    if (next < 0) break;
    start = next + 1;
  }
  if (found.length === 0) return undefined;
  if (new Set(found).size > 1) return '';
  return found[0];
}

function queryFromPath(path: string | undefined): string | undefined {
  const mark = path?.indexOf('?') ?? -1;
  return mark >= 0 ? path!.slice(mark + 1) : undefined;
}

function unquote(value: string): string {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) return value.slice(1, -1);
  return value;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replaceAll('+', ' '));
  } catch {
    return value;
  }
}

function classify(bundle: Bundle, date: string): string {
  if (bundle.dates.includes(date)) {
    const info = bundle.versionInfo.find((item) => item.date === date);
    if (info?.sunsetEnforce && info.sunset && info.sunset < bundle.now) {
      throw fail('AV-E012', 'up', date, bundle.dates, [{ name: 'Link', value: '</apiversa/upgrade>; rel="sunset"' }]);
    }
    return date;
  }
  if (DATE.test(date) && date < bundle.oldest) {
    throw fail('AV-E012', 'up', date, bundle.dates, [{ name: 'Link', value: '</apiversa/upgrade>; rel="sunset"' }]);
  }
  throw fail('AV-E002', 'up', date, bundle.dates);
}

function applyDefault(bundle: Bundle, clientId: string | undefined): { version: string; source: VersionSource } {
  if (bundle.policy === 'latest') return { version: bundle.head, source: 'default' };
  if (bundle.policy === 'oldest') return { version: bundle.oldest, source: 'default' };
  const pins = bundle.pins;
  if (!pins) throw fail('AV-E005', 'startup');
  if (!clientId) throw fail('AV-E002', 'up', 'no client for pin-on-first-call', bundle.dates);
  const existing = pins.get(clientId);
  if (existing) return { version: classify(bundle, existing), source: 'pin' };
  pins.set(clientId, bundle.head);
  return { version: bundle.head, source: 'pin' };
}
