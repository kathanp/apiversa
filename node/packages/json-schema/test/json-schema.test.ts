import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from 'apiversa';
import { defineJsonSchemas, defineTypeBoxSchemas } from '../src/index.js';

const hotel = {
  type: 'object',
  properties: {
    locality: { type: 'string' },
    stars: { type: 'number' },
  },
};

describe('JSON Schema and TypeBox registries', () => {
  it('keeps property order and converts like a hand-built registry', () => {
    const fromJson = defineJsonSchemas({ Hotel: hotel });
    const fromTypeBox = defineTypeBoxSchemas({ Hotel: hotel });
    expect(fromJson).toEqual(fromTypeBox);
    expect(fromJson.Hotel?.fields?.map((field) => field.name)).toEqual(['locality', 'stars']);
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-schema-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
    const av = createApiversa({ dir, schemas: fromJson, development: false, trace: false, now: '2026-10-31' });
    expect(av.convertRequest({ schema: 'Hotel', body: { city: 'Paris', stars: 4 }, version: '2026-01-15' })).toEqual({ locality: 'Paris', stars: 4 });
  });

  it('follows a property $ref and an items $ref', () => {
    const registry = defineJsonSchemas({
      Address: { type: 'object', properties: { city: { type: 'string' } } },
      Room: { type: 'object', properties: { number: { type: 'string' } } },
      Hotel: {
        type: 'object',
        properties: {
          address: { $ref: '#/components/schemas/Address' },
          rooms: { type: 'array', items: { $ref: 'Room' } },
          note: { type: 'string' },
        },
      },
    });
    expect(registry.Hotel?.fields).toEqual([
      { name: 'address', schema: 'Address' },
      { name: 'rooms', items: 'Room' },
      { name: 'note' },
    ]);
  });
});
