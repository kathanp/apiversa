import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';
import { encodeJson } from '../src/json/encode.js';
import { fromPlain } from '../src/json/parse.js';

const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };

function canon(value: unknown): string {
  return encodeJson(fromPlain(value, 'down'), 'down');
}

function roundTrip(op: Record<string, unknown>, body: Record<string, unknown>): boolean {
  const change = { version: '2026-03-01', id: 'round-trip', description: 'Round trip for the property test.', changes: [op] };
  const bundle = buildBundle(versions, [change], { today: '2026-10-31', registry: { Hotel: {} } });
  const up = execute(bundle, { schema: 'Hotel', version: '2026-01-15', body, trace: false }, 'up');
  const down = execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: up.body, trace: false }, 'down');
  return canon(down.body) === canon(body);
}

describe('round-trip property tests', () => {
  it('keeps canonical bytes for reversible renames, moves, and adds', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (id, title) => {
        expect(roundTrip({ op: 'field.rename', schema: 'Hotel', from: 'title', to: 'name' }, { id, title })).toBe(true);
        expect(roundTrip({ op: 'field.move', schema: 'Hotel', from: 'title', to: 'name' }, { id, title })).toBe(true);
      }),
    );
    fc.assert(
      fc.property(fc.string(), fc.oneof(fc.constant(undefined), fc.constant(null), fc.string().filter((value) => value !== 'Bay')), (id, name) => {
        const body = name === undefined ? { id } : { id, name };
        expect(roundTrip({ op: 'field.add', schema: 'Hotel', path: 'name', default: 'Bay' }, body)).toBe(true);
      }),
    );
  });
});
