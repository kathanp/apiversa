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

export function resolveVersion(
  bundle: Bundle,
  input: { headers?: HeaderInput; headerName?: string; resolved?: string | undefined; clientId?: string },
): string {
  const values = readHeader(input.headers, input.headerName ?? 'Api-Version');
  const distinct = [...new Set(values)];
  if (distinct.length > 1) throw fail('AV-E002', 'up', 'distinct version headers', bundle.dates);
  const explicit = distinct[0] ?? input.resolved;
  if (explicit !== undefined && explicit !== '') return classify(bundle, explicit);
  return applyDefault(bundle, input.clientId);
}

function classify(bundle: Bundle, date: string): string {
  if (bundle.dates.includes(date)) return date;
  if (DATE.test(date) && date < bundle.oldest) {
    throw fail('AV-E012', 'up', date, bundle.dates, [{ name: 'Link', value: '</apiversa/upgrade>; rel="sunset"' }]);
  }
  throw fail('AV-E002', 'up', date, bundle.dates);
}

function applyDefault(bundle: Bundle, clientId: string | undefined): string {
  if (bundle.policy === 'latest') return bundle.head;
  if (bundle.policy === 'oldest') return bundle.oldest;
  const pins = bundle.pins;
  if (!pins) throw fail('AV-E005', 'startup');
  if (!clientId) throw fail('AV-E002', 'up', 'no client for pin-on-first-call', bundle.dates);
  const existing = pins.get(clientId);
  if (existing) return classify(bundle, existing);
  pins.set(clientId, bundle.head);
  return bundle.head;
}
