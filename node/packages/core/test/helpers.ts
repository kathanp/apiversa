import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';
import type { Direction } from '../src/errors.js';
import type { RawOp } from '../src/model.js';

export function runOp(op: RawOp, body: unknown, direction: Direction, fields?: string[], schema = 'Hotel'): unknown {
  const versions = {
    head: '2026-03-01',
    default: 'oldest' as const,
    versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }],
  };
  const change = { version: '2026-03-01', id: 'sample-change', description: 'Sample change for the unit test.', changes: [op] };
  const registry = { [schema]: fields ? { fields: fields.map((name) => ({ name })) } : {} };
  const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry });
  return execute(bundle, { schema, version: '2026-01-15', body, trace: false }, direction).body;
}
