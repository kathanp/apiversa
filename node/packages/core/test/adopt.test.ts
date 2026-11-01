import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from '../src/create.js';

function bundle(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), name));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\n  - date: "2025-10-01"\ndefault: oldest\n');
  return dir;
}

describe('legacy URL prefixes', () => {
  it('maps a prefix to its date, and a header or resolver wins', () => {
    const av = createApiversa({
      dir: bundle('apiversa-prefix-'),
      legacyPrefixes: { '/v1': '2025-10-01', '/v2': '2026-01-15', '/v2/extra': '2026-03-01' },
      resolve: () => '2026-03-01',
    });
    expect(av.resolveVersion({ path: '/v1/hotels/1' })).toBe('2025-10-01');
    expect(av.resolveVersion({ path: '/v2/hotels/1' })).toBe('2026-01-15');
    expect(av.resolveVersion({ path: '/v2/extra/1' })).toBe('2026-03-01');
    expect(av.resolveVersion({ path: '/hotels/1' })).toBe('2025-10-01');
    expect(av.resolveVersion({ headers: { 'Api-Version': '2026-01-15' }, path: '/v1/hotels/1' })).toBe('2026-01-15');
    expect(av.resolveVersion({ request: {}, path: '/v1/hotels/1' })).toBe('2026-03-01');
  });
});
