import type { Direction } from '../errors.js';
import type { HeaderPair, RawOp } from '../model.js';

/** Header compare is case-insensitive. The emitted name is the spelling in the change file. */
export function headerRename(headers: HeaderPair[], op: RawOp, when: Direction): HeaderPair[] {
  const from = when === 'up' ? op.from! : op.to!;
  const to = when === 'up' ? op.to! : op.from!;
  return headers.map((header) => (header.name.toLowerCase() === from.toLowerCase() ? { name: to, value: header.value } : header));
}
