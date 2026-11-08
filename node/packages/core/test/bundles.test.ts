import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApiversaError, createApiversa, memoryPins } from 'apiversa';

function writeBundle(prefix: string, change: string): string {
  const folder = mkdtempSync(join(tmpdir(), prefix));
  writeFileSync(join(folder, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(folder, '2026-03-01.change.yaml'), change);
  return folder;
}

const CITY = 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n';
const STARS = 'version: "2026-03-01"\nid: add-stars\ndescription: "stars was added."\nchanges:\n  - op: field.add\n    schema: Hotel\n    path: stars\n    default: 1\n';

describe('CORE-28 named bundles', () => {
  it('keeps a single dir on the default bundle', () => {
    const av = createApiversa({ dir: writeBundle('apiversa-one-', CITY), development: false, trace: false });
    expect(av.bundleNames).toEqual(['default']);
    expect(av.bundle?.('default')).toBe(av);
    expect(av.convertRequest({ schema: 'Hotel', body: { city: 'Paris' }, version: '2026-01-15' })).toEqual({ locality: 'Paris' });
  });

  it('does not leak a date, a change, or a pin across bundles', () => {
    const billingPins = memoryPins();
    const identityPins = memoryPins();
    const av = createApiversa({
      development: false,
      trace: false,
      bundles: {
        billing: { dir: writeBundle('apiversa-billing-', CITY), pins: billingPins },
        identity: { dir: writeBundle('apiversa-identity-', STARS), pins: identityPins },
      },
    });
    const billing = av.bundle?.('billing');
    const identity = av.bundle?.('identity');
    expect(billing?.convertRequest({ schema: 'Hotel', body: { city: 'Paris' }, version: '2026-01-15' })).toEqual({ locality: 'Paris' });
    expect(identity?.convertRequest({ schema: 'Hotel', body: {}, version: '2026-01-15' })).toEqual({ stars: 1 });
    try {
      billing?.convertRequest({ schema: 'Hotel', body: {}, version: '2026-02-01' });
      expect.unreachable();
    } catch (error) {
      expect((error as ApiversaError).code).toBe('AV-E002');
      expect((error as ApiversaError).supportedVersions).toEqual(['2026-03-01', '2026-01-15']);
    }
    billingPins.set('partner-a', '2026-01-15');
    expect(identityPins.get('partner-a')).toBeUndefined();
    expect(() => av.convertRequest({ schema: 'Hotel', body: {}, version: '2026-01-15' })).toThrow(ApiversaError);
    expect(() => av.bundle?.('missing')).toThrow(ApiversaError);
  });

  it('refuses one pin store for two bundles', () => {
    expect(() => createApiversa({
      pins: memoryPins(),
      bundles: {
        billing: { dir: writeBundle('apiversa-share-a-', CITY) },
        identity: { dir: writeBundle('apiversa-share-b-', STARS) },
      },
    })).toThrow(ApiversaError);
  });
});
