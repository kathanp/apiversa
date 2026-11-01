import type { Direction } from '../errors.js';
import type { HeaderPair, RawOp } from '../model.js';

/** Add a header for old requests, and drop the default value from new responses. */
export function headerAdd(headers: HeaderPair[], op: RawOp, when: Direction): HeaderPair[] {
  const name = op.name ?? '';
  const fallback = String(op.default ?? '');
  if (when === 'up') {
    if (headers.some((header) => header.name.toLowerCase() === name.toLowerCase())) return headers;
    return [...headers, { name, value: fallback }];
  }
  return headers.filter((header) => header.name.toLowerCase() !== name.toLowerCase() || header.value.trim() !== fallback);
}

/** Drop a header old clients sent, and restore the default on the response. */
export function headerRemove(headers: HeaderPair[], op: RawOp, when: Direction): HeaderPair[] {
  const name = op.name ?? '';
  const fallback = String(op.default ?? '');
  if (when === 'up') return headers.filter((header) => header.name.toLowerCase() !== name.toLowerCase());
  if (headers.some((header) => header.name.toLowerCase() === name.toLowerCase())) return headers;
  return [...headers, { name, value: fallback }];
}
