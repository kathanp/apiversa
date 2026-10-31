import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../src/bundle/load.js';
import { execute } from '../../src/chain/run.js';

describe('header.rename', () => {
  const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
  const change = {
    version: '2026-03-01',
    id: 'header-rename',
    description: 'Header rename for the unit test.',
    changes: [{ op: 'header.rename', from: 'X-City', to: 'X-Locality' }],
  };

  it('renames request and response headers using the change-file spelling', () => {
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: {} });
    const up = execute(bundle, { version: '2026-01-15', headers: [{ name: 'x-city', value: 'Paris' }], trace: false }, 'up');
    expect(up.headers).toEqual([{ name: 'X-Locality', value: 'Paris' }]);
    const down = execute(bundle, { version: '2026-01-15', headers: [{ name: 'x-locality', value: 'Paris' }], trace: false }, 'down');
    expect(down.headers).toEqual([{ name: 'X-City', value: 'Paris' }]);
    const back = execute(bundle, { version: '2026-01-15', headers: up.headers, trace: false }, 'down');
    expect(back.headers).toEqual([{ name: 'X-City', value: 'Paris' }]);
  });
});
