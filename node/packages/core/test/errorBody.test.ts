import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';

describe('error bodies', () => {
  it('passes an unmatched error through and does not re-encode an empty plan', () => {
    const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = {
      version: '2026-03-01',
      id: 'rename-name',
      description: 'Rename for the error-body test.',
      changes: [{ op: 'field.rename', schema: 'Hotel', from: 'name', to: 'title' }],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-31', registry: { Hotel: {} } });
    const body = { detail: 'missing' };
    const result = execute(bundle, { schema: 'Hotel', version: '2026-01-15', body, status: 400, isError: true, trace: false }, 'down');
    expect(result.body).toBe(body);
    const head = { detail: 'missing' };
    const empty = execute(buildBundle(versions, [], { today: '2026-10-31', registry: {} }), { version: '2026-03-01', body: head, status: 500, isError: true, trace: false }, 'down');
    expect(empty.body).toBe(head);
  });
});
