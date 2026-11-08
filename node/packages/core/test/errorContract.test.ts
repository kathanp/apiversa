import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';
import { api } from '../src/create.js';
import { ApiversaError, MESSAGES, statusFor } from '../src/errors.js';

const MESSAGE = 'Version is older than the oldest supported version or past its sunset.';

describe('AV-E008 and AV-E012', () => {
  it('returns 413 for an oversized body on the way down', () => {
    const versions = { head: '2026-03-01', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const change = {
      version: '2026-03-01',
      id: 'add-name',
      description: 'Add name.',
      changes: [{ op: 'field.add', schema: 'Hotel', path: 'name', default: 'Bay' }],
    };
    const bundle = buildBundle(versions, [change], {
      today: '2026-10-31',
      registry: { Hotel: {} },
      limits: { maxBodyBytes: 8, maxArrayItems: 10000 },
    });
    expect(statusFor('AV-E008', 'up')).toBe(413);
    expect(statusFor('AV-E008', 'down')).toBe(413);
    expect(() => execute(bundle, { schema: 'Hotel', version: '2026-01-15', body: '{"id":"hotel-1"}', trace: false }, 'down')).toThrow(
      expect.objectContaining({ code: 'AV-E008', status: 413, message: MESSAGES['AV-E008'] }),
    );
  });

  it('uses one AV-E012 message for an older date and a past sunset', () => {
    const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const older = api(buildBundle(versions, [], { today: '2026-10-31', registry: {} }), { header: 'Api-Version', development: false, trace: false });
    try {
      older.resolveVersion({ headers: { 'Api-Version': '2020-01-01' } });
      throw new Error('expected AV-E012');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiversaError);
      expect((error as ApiversaError).code).toBe('AV-E012');
      expect((error as ApiversaError).status).toBe(410);
      expect((error as ApiversaError).message).toBe(MESSAGE);
      expect((error as ApiversaError).envelope().error.supportedVersions).toEqual(['2026-03-01', '2026-01-15']);
    }

    const sunset = {
      head: '2026-03-01',
      default: 'oldest' as const,
      versions: [{ date: '2026-03-01' }, { date: '2026-01-15', sunset: '2026-06-01', sunsetEnforce: true }],
    };
    const strict = api(buildBundle(sunset, [], { today: '2026-10-31', now: '2026-10-31', registry: {} }), {
      header: 'Api-Version',
      development: false,
      trace: false,
    });
    try {
      strict.resolveVersion({ headers: { 'Api-Version': '2026-01-15' } });
      throw new Error('expected AV-E012');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiversaError);
      const rejected = error as ApiversaError;
      expect(rejected.code).toBe('AV-E012');
      expect(rejected.status).toBe(410);
      expect(rejected.message).toBe(MESSAGE);
      expect(rejected.envelope().error.message).toBe(MESSAGE);
      expect(rejected.supportedVersions).toContain('2026-01-15');
    }
  });
});
