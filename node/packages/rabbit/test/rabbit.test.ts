import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { rabbit } from '../src/index.js';

const VERSIONS = 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n';
const RENAME = 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n';

describe('EVT-05 RabbitMQ', () => {
  it('runs the same header-map conversion as SQS', () => {
    const folder = mkdtempSync(join(tmpdir(), 'apiversa-rabbit-'));
    writeFileSync(join(folder, 'versions.yaml'), VERSIONS);
    writeFileSync(join(folder, '2026-03-01.change.yaml'), RENAME);
    const av = createApiversa({ dir: folder, development: false, trace: false });
    const messages = rabbit(av, 'Hotel');
    expect(messages.upgrade({ city: 'Paris' }, { 'Api-Version': '2026-01-15' })).toEqual({ locality: 'Paris' });
    expect(messages.downgrade({ locality: 'Paris' }, '2026-01-15')).toEqual({ city: 'Paris' });
  });
});
