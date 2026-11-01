import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa, memoryPins } from '../src/create.js';

const VERSIONS = `head: "2026-03-01"
default: oldest
versions:
  - date: "2026-03-01"
  - date: "2026-01-15"
    deprecated: true
    sunset: "2026-06-01"
  - date: "2025-11-01"
    deprecated: true
`;

describe('deprecation headers, counters, and memory pins', () => {
  it('returns no counters before a request', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-life-empty-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\ndefault: oldest\n');
    const av = createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: false });
    expect(av.prometheus()).toBe('');
    expect(av.metrics()).toEqual([]);
    expect(av.stats()).toEqual({ requests: {}, conversions: {}, clients: {} });
  });

  it('sends the headers, counts a request, and keeps a pin in memory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-life-'));
    writeFileSync(join(dir, 'versions.yaml'), VERSIONS);
    writeFileSync(join(dir, '2026-03-01.add-name.yaml'), `version: "2026-03-01"
id: add-name
description: Hotel.name was added.
changes:
  - op: field.add
    schema: Hotel
    path: name
    default: Bay
`);
    const seen: unknown[] = [];
    const av = createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: false, onCount: (snapshot) => seen.push(snapshot.requests['2026-01-15']) });
    const headers = av.deprecationHeaders('2026-01-15');
    expect(headers[0]).toEqual({ name: 'Deprecation', value: `@${Date.parse('2026-01-15T00:00:00.000Z') / 1000}` });
    expect(headers[1]).toEqual({ name: 'Sunset', value: 'Mon, 01 Jun 2026 00:00:00 GMT' });
    expect(headers[2]).toEqual({ name: 'Link', value: '</apiversa/upgrade>; rel="deprecation"' });
    expect(av.deprecationHeaders('2026-03-01')).toEqual([]);
    expect(av.deprecationHeaders('2025-11-01').map((header) => header.name)).toEqual(['Deprecation', 'Link']);
    av.note('2026-01-15', 'partner-a');
    av.note('2026-03-01');
    expect(av.stats()).toEqual({
      requests: { '2026-01-15': 1, '2026-03-01': 1 },
      conversions: { '2026-03-01.add-name': 1 },
      clients: { 'partner-a': 1 },
    });
    expect(av.prometheus()).toContain('apiversa_requests_total{version="2026-01-15"} 1');
    expect(av.prometheus()).not.toMatch(/http/);
    expect(av.metrics()).toContainEqual({ name: 'apiversa.clients', attributes: { client: 'partner-a' }, value: 1 });
    expect(seen).toEqual([1, 1]);
    const pins = memoryPins();
    pins.set('partner-a', '2026-01-15');
    expect(pins.get('partner-a')).toBe('2026-01-15');
    expect(pins.get('missing')).toBeUndefined();
  });
});
