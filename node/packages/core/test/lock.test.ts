import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadBundle } from '../src/bundle/load.js';
import { init } from '../src/cli/init.js';
import { lockFiles } from '../src/cli/lock.js';
import { ApiversaError } from '../src/errors.js';

const VERSIONS = `head: "2026-03-01"
versions:
  - date: "2026-03-01"
  - date: "2026-01-15"
default: oldest
`;

const CHANGE = `version: "2026-03-01"
id: price-object
description: "Hotel.price changed from a number to an object."
changes:
  - op: field.type
    schema: Hotel
    path: price
    down: { from: "price.amount" }
    up: { value: { amount: "$.price", currency: "USD" } }
`;

describe('released versions stay frozen', () => {
  const previous = process.env.NODE_ENV;

  afterEach(() => {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  });

  it('writes a sha256 lock and refuses a changed file in production', () => {
    const root = mkdtempSync(join(tmpdir(), 'apiversa-lock-'));
    const dir = join(root, 'api-versions');
    init(root);
    writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
    writeFileSync(join(dir, '2026-03-01.price-object.yaml'), CHANGE);
    const locked = lockFiles(dir);
    expect(locked['2026-03-01.price-object.yaml']).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(readFileSync(join(dir, '.lock.json'), 'utf8')).files['2026-03-01.price-object.yaml']).toBe(locked['2026-03-01.price-object.yaml']);
    process.env.NODE_ENV = 'production';
    expect(loadBundle(dir, { today: '2026-10-31', registry: { Hotel: {} } }).head).toBe('2026-03-01');
    writeFileSync(join(dir, '2026-03-01.price-object.yaml'), `${CHANGE}# edited\n`);
    expect(() => loadBundle(dir, { today: '2026-10-31', registry: { Hotel: {} } })).toThrow(expect.objectContaining({ code: 'AV-E006' }));
    process.env.NODE_ENV = 'development';
    expect(() => loadBundle(dir, { today: '2026-10-31', registry: { Hotel: {} } })).not.toThrow(ApiversaError);
  });
});
