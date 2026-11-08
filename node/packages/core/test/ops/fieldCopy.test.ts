import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { schemaFieldsAt } from '../../src/cli/generate.js';
import { openApiVersions } from '../../src/cli/openapi.js';
import { loadBundle } from '../../src/bundle/load.js';
import { runOp } from '../helpers.js';

const op = { op: 'field.copy', schema: 'Hotel', from: 'city', to: 'locality' };

describe('field.copy', () => {
  it('keeps from and writes the same value on the way down', () => {
    expect(runOp(op, { city: 'Paris' }, 'down', ['city', 'locality'])).toEqual({ city: 'Paris', locality: 'Paris' });
    expect(runOp(op, { city: 'Paris', locality: 'Paris' }, 'down', ['city', 'locality'])).toEqual({ city: 'Paris', locality: 'Paris' });
    expect(runOp(op, { locality: 'Paris' }, 'down', ['city', 'locality'])).toEqual({ locality: 'Paris' });
    expect(runOp(op, { city: null }, 'down', ['city', 'locality'])).toEqual({ city: null, locality: null });
  });

  it('removes an equal copy on the way up and refuses a different value', () => {
    expect(runOp(op, { city: 'Paris' }, 'up', ['city', 'locality'])).toEqual({ city: 'Paris' });
    expect(runOp(op, { city: 'Paris', locality: 'Paris' }, 'up', ['city', 'locality'])).toEqual({ city: 'Paris' });
    expect(() => runOp(op, { city: 'Paris', locality: 'Lyon' }, 'up')).toThrow(expect.objectContaining({ code: 'AV-E020', status: 400, message: 'Target is already set.' }));
    expect(() => runOp(op, { city: 'Paris', locality: 'Lyon' }, 'down')).toThrow(expect.objectContaining({ code: 'AV-E020', status: 500 }));
  });

  it('shows both names from the change date and only from on older documents', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-copy-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.copy.yaml'), 'version: "2026-03-01"\nid: copy-city\ndescription: "city is also locality."\nchanges:\n  - op: field.copy\n    schema: Hotel\n    from: city\n    to: locality\n');
    const head = { Hotel: [{ name: 'city', type: 'string' }, { name: 'locality', type: 'string' }] };
    const bundle = loadBundle(dir, { registry: { Hotel: { fields: [{ name: 'city' }, { name: 'locality' }] } } });
    expect(schemaFieldsAt(head, bundle, '2026-03-01').Hotel?.map((field) => field.name)).toEqual(['city', 'locality']);
    expect(schemaFieldsAt(head, bundle, '2026-01-15').Hotel?.map((field) => field.name)).toEqual(['city']);
    const docs = openApiVersions(dir, {
      openapi: '3.1.0',
      info: { title: 'Hotels', version: '2026-03-01' },
      components: { schemas: { Hotel: { properties: { city: { type: 'string' }, locality: { type: 'string' } } } } },
    });
    expect(docs['2026-03-01']?.components?.schemas?.Hotel?.properties).toEqual({ city: { type: 'string' }, locality: { type: 'string' } });
    expect(docs['2026-01-15']?.components?.schemas?.Hotel?.properties).toEqual({ city: { type: 'string' } });
  });
});
