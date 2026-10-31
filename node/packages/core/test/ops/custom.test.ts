import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../src/bundle/load.js';
import { execute } from '../../src/chain/run.js';
import { ApiversaError } from '../../src/errors.js';

describe('custom', () => {
  const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
  const change = { version: '2026-03-01', id: 'custom-op', description: 'Custom converter for the unit test.', changes: [{ op: 'custom', converter: 'splitFullName' }] };

  it('runs the named converter and freezes its input in development', () => {
    const bundle = buildBundle(versions, [change], {
      today: '2026-10-30',
      registry: { Guest: {} },
      converters: {
        splitFullName: {
          up: (value) => ({ ...(value as { name: string }), first: 'A' }),
          down: (value) => ({ name: (value as { name: string }).name }),
        },
      },
    });
    expect(execute(bundle, { schema: 'Guest', version: '2026-01-15', body: { name: 'A B' }, development: true, trace: false }, 'up').body).toEqual({ name: 'A B', first: 'A' });
    const bad = buildBundle(versions, [change], {
      today: '2026-10-30',
      registry: { Guest: {} },
      converters: { splitFullName: { up: (value) => { (value as { name: string }).name = 'mutated'; return value; } } },
    });
    expect(() => execute(bad, { schema: 'Guest', version: '2026-01-15', body: { name: 'A' }, development: true, trace: false }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E007' }));
  });

  it('refuses a missing converter at startup', () => {
    expect(() => buildBundle(versions, [change], { today: '2026-10-30', registry: { Guest: {} } })).toThrow(ApiversaError);
  });
});
