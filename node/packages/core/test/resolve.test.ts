import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { api } from '../src/create.js';
import { ApiversaError, MESSAGES } from '../src/errors.js';

const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };

function client() {
  const bundle = buildBundle(versions, [], { today: '2026-10-30', registry: {} });
  return api(bundle, { header: 'Api-Version', development: false, trace: false });
}

describe('CORE-02 version resolution', () => {
  it('lets the header win, then the resolver, then oldest', () => {
    const av = client();
    expect(av.resolveVersion({ headers: { 'api-version': '2026-03-01' } })).toBe('2026-03-01');
    const bundle = buildBundle(versions, [], { today: '2026-10-30', registry: {} });
    const resolved = api(bundle, { header: 'Api-Version', resolve: () => '2026-03-01', development: false, trace: false });
    expect(resolved.resolveVersion({ request: {} })).toBe('2026-03-01');
    expect(av.resolveVersion({})).toBe('2026-01-15');
  });

  it('returns AV-E002 for an unknown date and AV-E012 for an older one', () => {
    const av = client();
    expect(() => av.resolveVersion({ headers: { 'Api-Version': '2026-02-01' } })).toThrow(expect.objectContaining({ code: 'AV-E002', status: 400, message: MESSAGES['AV-E002'] }));
    try {
      av.resolveVersion({ headers: { 'Api-Version': '2020-01-01' } });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiversaError);
      expect((error as ApiversaError).code).toBe('AV-E012');
      expect((error as ApiversaError).status).toBe(410);
      expect((error as ApiversaError).headers[0]?.value).toContain('rel="sunset"');
      expect((error as ApiversaError).envelope().error.supportedVersions).toEqual(['2026-03-01', '2026-01-15']);
    }
  });

  it('rejects two distinct version headers', () => {
    const av = client();
    expect(() => av.resolveVersion({ headers: { 'Api-Version': ['2026-01-15', '2026-03-01'] } })).toThrow(expect.objectContaining({ code: 'AV-E002' }));
  });

  it('refuses pin-on-first-call without a store and pins head on the first call', () => {
    expect(() => buildBundle({ ...versions, default: 'pin-on-first-call' }, [], { today: '2026-10-30', registry: {} })).toThrow(expect.objectContaining({ code: 'AV-E005' }));
    const pins = new Map<string, string>();
    const bundle = buildBundle({ ...versions, default: 'pin-on-first-call' }, [], {
      today: '2026-10-30',
      registry: {},
      pins: { get: (id) => pins.get(id), set: (id, date) => pins.set(id, date) },
    });
    const av = api(bundle, { header: 'Api-Version', development: false, trace: false });
    expect(av.resolveVersion({ clientId: 'c_1' })).toBe('2026-03-01');
    expect(pins.get('c_1')).toBe('2026-03-01');
    pins.set('c_1', '2026-01-15');
    expect(av.resolveVersion({ clientId: 'c_1' })).toBe('2026-01-15');
  });
});
