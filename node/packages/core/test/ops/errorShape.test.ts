import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../src/bundle/load.js';
import { execute } from '../../src/chain/run.js';

describe('error.shape', () => {
  it('rewrites a matching error and leaves other errors unchanged', () => {
    const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = {
      version: '2026-03-01',
      id: 'error-shape',
      description: 'Error shape for the unit test.',
      changes: [{ op: 'error.shape', code: 'not_found', down: { message: '$.detail' } }],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: {} });
    const matched = execute(bundle, { version: '2026-01-15', body: { detail: 'missing' }, status: 404, isError: true, errorCode: 'not_found', trace: false }, 'down');
    expect(matched.body).toEqual({ message: 'missing' });
    const other = execute(bundle, { version: '2026-01-15', body: { detail: 'missing' }, status: 400, isError: true, errorCode: 'bad', trace: false }, 'down');
    expect(other.body).toEqual({ detail: 'missing' });
  });
});
