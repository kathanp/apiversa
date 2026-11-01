import type { Direction } from './errors.js';

/** One operation object after schema validation. */
export type RawOp = {
  op: string;
  schema?: string;
  path?: string;
  from?: string;
  to?: string;
  default?: unknown;
  value?: unknown;
  fallback?: unknown;
  replacement?: unknown;
  fields?: string[];
  into?: string;
  method?: string;
  converter?: string;
  code?: string;
  status?: number;
  name?: string;
  down?: unknown;
  up?: unknown;
  legacyHandler?: string;
};

export type Change = {
  version: string;
  id: string;
  description: string;
  ops: RawOp[];
};

export type Converter = {
  up?: (value: unknown) => unknown;
  down?: (value: unknown) => unknown;
};

export type PinStore = {
  get(clientId: string): string | undefined;
  set(clientId: string, date: string): void;
};

export type QueryPair = { name: string; value: string };
export type HeaderPair = { name: string; value: string };

export const DATA_OPS: ReadonlySet<string> = new Set([
  'field.rename',
  'field.add',
  'field.remove',
  'field.move',
  'field.type',
  'enum.add',
  'enum.rename',
  'enum.remove',
  'object.wrap',
  'custom',
  'error.shape',
]);

export function opRuns(op: RawOp, direction: Direction, converters: Record<string, Converter>): boolean {
  switch (op.op) {
    case 'enum.add':
    case 'error.shape':
    case 'status.change':
      return direction === 'down';
    case 'enum.remove':
    case 'query.rename':
    case 'query.add':
    case 'query.remove':
      return direction === 'up';
    case 'endpoint.add':
    case 'endpoint.remove':
    case 'endpoint.rename':
    case 'field.deprecate':
      return false;
    case 'custom': {
      const converter = op.converter ? converters[op.converter] : undefined;
      return Boolean(converter && converter[direction]);
    }
    default:
      return true;
  }
}
