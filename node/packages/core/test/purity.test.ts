import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';

describe('converter purity', () => {
  it('names the change when a development converter mutates its input', () => {
    const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = { version: '2026-03-01', id: 'custom-op', description: 'Purity check.', changes: [{ op: 'custom', converter: 'splitFullName' }] };
    const bundle = buildBundle(versions, [change], {
      today: '2026-10-31',
      registry: { Guest: {} },
      converters: { splitFullName: { up: (value) => { (value as { name: string }).name = 'mutated'; return value; } } },
    });
    expect(() => execute(bundle, { schema: 'Guest', version: '2026-01-15', body: { name: 'A' }, development: true, trace: false }, 'up')).toThrow(
      expect.objectContaining({ code: 'AV-E007', status: 500, detail: '2026-03-01.custom-op' }),
    );
  });
});
