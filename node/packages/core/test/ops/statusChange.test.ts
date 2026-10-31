import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../src/bundle/load.js';
import { execute } from '../../src/chain/run.js';

describe('status.change', () => {
  it('maps the head status back to the old status', () => {
    const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = {
      version: '2026-03-01',
      id: 'status-change',
      description: 'Status change for the unit test.',
      changes: [{ op: 'status.change', method: 'POST', path: '/hotels', from: 201, to: 200 }],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: {} });
    expect(execute(bundle, { version: '2026-01-15', status: 200, trace: false }, 'down').status).toBe(201);
    expect(execute(bundle, { version: '2026-01-15', status: 200, trace: false }, 'up').status).toBe(200);
    expect(execute(bundle, { version: '2026-01-15', status: 404, trace: false }, 'down').status).toBe(404);
  });
});
