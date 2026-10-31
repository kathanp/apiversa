import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../src/bundle/load.js';
import { execute } from '../../src/chain/run.js';
import { ApiversaError } from '../../src/errors.js';

const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };

describe('endpoint ops', () => {
  it('hides an added route from older clients', () => {
    const change = { version: '2026-03-01', id: 'add-route', description: 'Adds GET /hotels/:id.', changes: [{ op: 'endpoint.add', method: 'GET', path: '/hotels/:id' }] };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: {} });
    expect(() => execute(bundle, { version: '2026-01-15', method: 'GET', path: '/hotels/h_1', trace: false }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E010' }));
    expect(execute(bundle, { version: '2026-03-01', method: 'GET', path: '/hotels/h_1', trace: false }, 'up').path).toBe('/hotels/h_1');
  });

  it('removes a route at head and keeps a legacy handler for older clients', () => {
    const change = {
      version: '2026-03-01',
      id: 'remove-route',
      description: 'Removes GET /old.',
      changes: [{ op: 'endpoint.remove', method: 'GET', path: '/old', legacyHandler: 'legacyReviews' }],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: {} });
    expect(() => execute(bundle, { version: '2026-03-01', method: 'GET', path: '/old', trace: false }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E011' }));
    expect(execute(bundle, { version: '2026-01-15', method: 'GET', path: '/old', trace: false }, 'up').legacyHandler).toBe('legacyReviews');
  });

  it('rewrites an old path to the new path', () => {
    const change = {
      version: '2026-03-01',
      id: 'rename-route',
      description: 'Renames GET /a/:id to /b/:id.',
      changes: [{ op: 'endpoint.rename', method: 'GET', from: '/a/:id', to: '/b/:id' }],
    };
    const bundle = buildBundle(versions, [change], { today: '2026-10-30', registry: {} });
    expect(execute(bundle, { version: '2026-01-15', method: 'GET', path: '/a/h_1', trace: false }, 'up').path).toBe('/b/h_1');
    expect(execute(bundle, { version: '2026-03-01', method: 'GET', path: '/b/h_1', trace: false }, 'up').path).toBe('/b/h_1');
  });
});

void ApiversaError;
