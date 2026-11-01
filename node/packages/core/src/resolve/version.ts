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

export type VersionSource = 'header' | 'resolver' | 'prefix' | 'pin' | 'default';

export function resolveVersion(
  bundle: Bundle,
  input: { headers?: HeaderInput; headerName?: string; resolved?: string | undefined; clientId?: string; path?: string; legacyPrefixes?: Record<string, string> },
): string {
  return resolveDecision(bundle, input).version;
}

/** The date that won, and which rule selected it. */
export function resolveDecision(
  bundle: Bundle,
  input: { headers?: HeaderInput; headerName?: string; resolved?: string | undefined; clientId?: string; path?: string; legacyPrefixes?: Record<string, string> },
): { version: string; source: VersionSource } {
  const values = readHeader(input.headers, input.headerName ?? 'Api-Version');
  const distinct = [...new Set(values)];
  if (distinct.length > 1) throw fail('AV-E002', 'up', 'distinct version headers', bundle.dates);
  const header = distinct[0];
  if (header) return { version: classify(bundle, header), source: 'header' };
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
