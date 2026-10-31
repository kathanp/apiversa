import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail } from '../errors.js';

const VERSIONS = `head: "2026-01-15"
versions:
  - date: "2026-01-15"
default: oldest
`;

const EXAMPLE = `# Example only. Delete the "# " prefixes to use it, and add 2026-03-01 to versions.yaml.
# version: "2026-03-01"
# id: price-object
# description: "Hotel.price changed from a number to {amount, currency}."
# changes:
#   - op: field.type
#     schema: Hotel
#     path: price
#     down: { from: "price.amount" }
#     up: { value: { amount: "$.price", currency: "USD" } }
`;

/** Create `api-versions/` with versions.yaml and one commented example change. */
export function init(cwd = process.cwd()): string {
  const dir = join(cwd, 'api-versions');
  mkdirSync(dir, { recursive: true });
  const versions = join(dir, 'versions.yaml');
  const example = join(dir, '2026-03-01.price-object.yaml');
  try {
    writeFileSync(versions, VERSIONS, { flag: 'wx' });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') throw fail('AV-E001', 'startup', 'api-versions/versions.yaml already exists');
    throw error;
  }
  writeFileSync(example, EXAMPLE, { flag: 'wx' });
  return dir;
}
