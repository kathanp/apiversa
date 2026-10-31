import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiversa } from '../node/packages/core/dist/index.js';

const dir = mkdtempSync(join(tmpdir(), 'apiversa-smoke-'));
writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
writeFileSync(
  join(dir, '2026-03-01.rename.yaml'),
  'version: "2026-03-01"\nid: rename-city\ndescription: "Hotel.city renamed to locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n',
);
const av = createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: false });
const body = av.convertResponse({ schema: 'Hotel', version: '2026-01-15', body: { locality: 'Paris' } });
rmSync(dir, { recursive: true, force: true });
if (JSON.stringify(body) !== '{"city":"Paris"}') {
  console.error('smoke failed', body);
  process.exit(1);
}
console.log('smoke ok');
