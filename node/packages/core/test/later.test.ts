import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa, memoryPins } from '../src/create.js';
import { diffBody } from '../src/cli/diff.js';
import { explain } from '../src/cli/explain.js';
import { runCli } from '../src/cli/main.js';
import { upgradeMatrix } from '../src/cli/matrix.js';
import { openApiVersions } from '../src/cli/openapi.js';
import { replay } from '../src/cli/replay.js';
import { retire } from '../src/cli/retire.js';
import { typeDiff } from '../src/cli/typeDiff.js';
import { ApiversaError } from '../src/errors.js';
import { execute } from '../src/chain/run.js';
import { buildBundle } from '../src/bundle/load.js';

const VERSIONS = 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\n    deprecated: true\n    sunset: "2026-06-01"\n  - date: "2025-10-01"\ndefault: oldest\n';

function bundle(name: string, versions = VERSIONS): string {
  const dir = mkdtempSync(join(tmpdir(), name));
  writeFileSync(join(dir, 'versions.yaml'), versions);
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
  writeFileSync(join(dir, '2026-01-15.add.yaml'), 'version: "2026-01-15"\nid: add-stars\ndescription: "stars was added."\nchanges:\n  - op: field.add\n    schema: Hotel\n    path: stars\n    default: 0\n');
  return dir;
}

describe('later versions', () => {
  it('explains a chain and calls onConvert', () => {
    const dir = bundle('apiversa-explain-');
    const seen: string[] = [];
    const av = createApiversa({ dir, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, development: false, trace: false, onConvert: (event) => seen.push(`${event.direction}:${event.change}`) });
    av.convertRequest({ schema: 'Hotel', body: { city: 'Paris' }, version: '2025-10-01' });
    expect(seen).toEqual(['up:2026-01-15.add-stars', 'up:2026-03-01.rename-city']);
    const text = explain(dir, '2025-10-01', 'GET /hotels/:id');
    expect(text).toContain('2026-01-15.add-stars');
    expect(text).toContain('before:');
    expect(runCli(['node', 'apiversa', 'explain', '--version', '2025-10-01', '--route', 'GET /hotels/:id', dir])).toBe(0);
  });

  it('reports idle versions and refuses a backwards pin', () => {
    const dir = bundle('apiversa-life-');
    const pins = memoryPins();
    pins.set('partner-a', '2025-10-01');
    const av = createApiversa({ dir, schemas: { Hotel: { fields: [{ name: 'locality' }] } }, pins, development: false, trace: false, now: '2026-10-31' });
    expect(av.safeToRemove().versions).toContain('2026-03-01');
    av.note('2025-10-01', 'partner-a', { endpoint: 'GET /hotels/:id' });
    expect(av.safeToRemove().versions).not.toContain('2025-10-01');
    const preview = av.previewUpgrade('partner-a', '2026-03-01', { locality: 'Paris' }, 'Hotel');
    expect(preview.endpoints[0]?.path).toBe('GET /hotels/:id');
    expect(preview.endpoints[0]?.changes.map((change) => change.id)).toEqual(['2026-01-15.add-stars', '2026-03-01.rename-city']);
    expect(av.upgradePin('partner-a', '2026-03-01', { dryRun: true })).toBe('2026-03-01');
    expect(pins.get('partner-a')).toBe('2025-10-01');
    av.upgradePin('partner-a', '2026-03-01');
    expect(pins.get('partner-a')).toBe('2026-03-01');
    expect(() => av.upgradePin('partner-a', '2025-10-01')).toThrow(/allowDowngrade/);
    av.upgradePin('partner-a', '2025-10-01', { allowDowngrade: true });
    expect(pins.get('partner-a')).toBe('2025-10-01');
  });

  it('retires an idle version and keeps one with traffic', () => {
    const dir = bundle('apiversa-retire-');
    writeFileSync(join(dir, 'usage.json'), JSON.stringify({ requests: { '2025-10-01': 2 } }));
    expect(() => retire(dir, '2025-10-01')).toThrow(/traffic/);
    retire(dir, '2025-10-01', { force: true });
    expect(readFileSync(join(dir, 'versions.yaml'), 'utf8')).not.toContain('2025-10-01');
    expect(runCli(['node', 'apiversa', 'retire', '2026-01-15', '--force', dir])).toBe(0);
  });

  it('replays a sample and writes a type diff and a matrix', () => {
    const dir = bundle('apiversa-replay-');
    writeFileSync(join(dir, 'head.json'), JSON.stringify({ Hotel: [{ name: 'locality', type: 'string' }, { name: 'stars', type: 'number' }] }));
    const samples = join(dir, 'samples.jsonl');
    writeFileSync(samples, `${JSON.stringify({ version: '2026-01-15', schema: 'Hotel', request: { city: 'Paris' }, response: { city: 'Paris' } })}\n`);
    expect(replay(dir, samples)).toEqual([]);
    expect(typeDiff(dir)).toContain('locality');
    const matrix = upgradeMatrix(dir);
    expect(matrix.versions['2026-03-01']).toEqual([]);
    expect(matrix.versions['2025-10-01']?.map((change) => change.id)).toEqual(['2026-01-15.add-stars', '2026-03-01.rename-city']);
    expect(runCli(['node', 'apiversa', 'matrix', '--out', join(dir, 'upgrade-matrix.json'), dir])).toBe(0);
    expect(runCli(['node', 'apiversa', 'changelog', '--types', dir])).toBe(0);
  });

  it('echoes the version, warns when unpinned, and enforces sunset', () => {
    const dir = bundle('apiversa-headers-');
    const av = createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: false, now: '2026-10-31' });
    const explicit = av.resolveDecision({ headers: { 'Api-Version': '2026-03-01' } });
    expect(explicit.headers).toEqual([{ name: 'Api-Version', value: '2026-03-01' }]);
    const fallback = av.resolveDecision({});
    expect(fallback.version).toBe('2025-10-01');
    expect(fallback.headers).toEqual([
      { name: 'Api-Version', value: '2025-10-01' },
      { name: 'Apiversa-Default', value: '2025-10-01' },
    ]);
    av.note(fallback.version, undefined, { unpinned: true });
    expect(av.stats().unpinned).toEqual({ '2025-10-01': 1 });
    expect(av.prometheus()).toContain('apiversa_unpinned_total{version="2025-10-01"} 1');
    const enforced = bundle('apiversa-sunset-', 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\n    sunset: "2026-06-01"\n    sunsetEnforce: true\ndefault: oldest\n');
    const strict = createApiversa({ dir: enforced, schemas: { Hotel: {} }, development: false, trace: false, now: '2026-10-31' });
    expect(() => strict.resolveVersion({ headers: { 'Api-Version': '2026-01-15' } })).toThrow(ApiversaError);
    const open = createApiversa({ dir: bundle('apiversa-sunset-off-', 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\n    sunset: "2026-06-01"\ndefault: oldest\n'), schemas: { Hotel: {} }, development: false, trace: false, now: '2026-10-31' });
    expect(open.resolveVersion({ headers: { 'Api-Version': '2026-01-15' } })).toBe('2026-01-15');
  });

  it('adds and removes headers, rewrites links, and leaves a deprecated field', () => {
    const versions = { head: '2026-03-01', default: 'oldest' as const, versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
    const registry = { Hotel: { fields: [{ name: 'url' }, { name: 'city' }] } };
    const headers = buildBundle(versions, [{
      version: '2026-03-01',
      id: 'request-id',
      description: 'Request-Id was added.',
      changes: [{ op: 'header.add', name: 'Request-Id', default: 'none' }],
    }], { today: '2026-10-31', registry });
    const added = execute(headers, { schema: 'Hotel', version: '2026-01-15', body: {}, headers: [], trace: false }, 'up');
    expect(added.headers).toEqual([{ name: 'Request-Id', value: 'none' }]);
    const kept = execute(headers, { schema: 'Hotel', version: '2026-01-15', body: {}, headers: [{ name: 'Request-Id', value: '' }], trace: false }, 'up');
    expect(kept.headers).toEqual([{ name: 'Request-Id', value: '' }]);
    const removed = execute(headers, { schema: 'Hotel', version: '2026-01-15', body: {}, headers: [{ name: 'Request-Id', value: 'none' }], trace: false }, 'down');
    expect(removed.headers).toEqual([]);
    expect(() => buildBundle(versions, [{ version: '2026-03-01', id: 'bad-header', description: 'no', changes: [{ op: 'header.add', name: 'Api-Version', default: 'x' }] }], { today: '2026-10-31', registry })).toThrow(ApiversaError);
    const links = buildBundle(versions, [{
      version: '2026-03-01',
      id: 'link',
      description: 'Hotel.url moved.',
      changes: [{ op: 'link.rewrite', schema: 'Hotel', path: 'url', from: '/hotels/:id', to: '/properties/:id' }],
    }], { today: '2026-10-31', registry });
    expect(execute(links, { schema: 'Hotel', version: '2026-01-15', body: { url: '/hotels/h_1' }, trace: false }, 'up').body).toEqual({ url: '/properties/h_1' });
    expect(execute(links, { schema: 'Hotel', version: '2026-01-15', body: { url: 'https://api.example/hotels/h_1?x=1' }, trace: false }, 'up').body).toEqual({ url: 'https://api.example/properties/h_1?x=1' });
    expect(execute(links, { schema: 'Hotel', version: '2026-01-15', body: { url: '/other/h_1' }, trace: false }, 'up').body).toEqual({ url: '/other/h_1' });
    expect(execute(links, { schema: 'Hotel', version: '2026-01-15', body: { url: null }, trace: false }, 'up').body).toEqual({ url: null });
    const deprecated = buildBundle(versions, [{
      version: '2026-03-01',
      id: 'old-city',
      description: 'city is deprecated.',
      changes: [{ op: 'field.deprecate', schema: 'Hotel', path: 'city' }],
    }], { today: '2026-10-31', registry });
    expect(execute(deprecated, { schema: 'Hotel', version: '2026-01-15', body: { city: 'Paris' }, trace: false }, 'down').body).toEqual({ city: 'Paris' });
  });

  it('converts only the discriminator variant and upgrades an event', () => {
    const dir = bundle('apiversa-disc-');
    writeFileSync(join(dir, '2026-03-01.card.yaml'), 'version: "2026-03-01"\nid: card-brand\ndescription: "brand renamed."\nchanges:\n  - op: field.rename\n    schema: Card\n    from: network\n    to: brand\n');
    const card = createApiversa({
      dir,
      now: '2026-10-31',
      development: false,
      trace: false,
      schemas: {
        Hotel: { fields: [{ name: 'locality' }] },
        PaymentMethod: { fields: [{ name: 'type' }], discriminator: { path: 'type', mapping: { card: 'Card', bank_account: 'BankAccount' } } },
        Card: { fields: [{ name: 'type' }, { name: 'brand' }] },
        BankAccount: { fields: [{ name: 'type' }, { name: 'routing' }] },
      },
    });
    expect(card.convertRequest({ schema: 'PaymentMethod', body: { type: 'card', network: 'visa' }, version: '2026-01-15' })).toEqual({ type: 'card', brand: 'visa' });
    expect(card.convertRequest({ schema: 'PaymentMethod', body: { type: 'bank_account', routing: '110' }, version: '2026-01-15' })).toEqual({ type: 'bank_account', routing: '110' });
    expect(card.convertRequest({ schema: 'PaymentMethod', body: { type: 'other', network: 'visa' }, version: '2026-01-15' })).toEqual({ type: 'other', network: 'visa' });
    expect(card.upgradeEvent({ city: 'Paris' }, 'Hotel', '2026-01-15')).toEqual({ locality: 'Paris' });
    expect(() => card.upgradeEvent({}, 'Hotel', '1999-01-01')).toThrow(ApiversaError);
  });

  it('rewinds webhook schemas and diffs two steps', () => {
    const dir = bundle('apiversa-doc-');
    writeFileSync(join(dir, 'head.json'), JSON.stringify({ Hotel: [{ name: 'locality', type: 'string' }, { name: 'stars', type: 'number' }] }));
    writeFileSync(join(dir, '2026-03-01.deprecate.yaml'), 'version: "2026-03-01"\nid: old-stars\ndescription: "stars is deprecated."\nchanges:\n  - op: field.deprecate\n    schema: Hotel\n    path: stars\n');
    const head = {
      openapi: '3.1.0',
      webhooks: { booking: { post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Hotel' } } } } } } },
      components: { schemas: { Hotel: { properties: { locality: { type: 'string' }, stars: { type: 'number' } } } } },
    };
    const docs = openApiVersions(dir, head, '2026-10-31');
    expect(docs['2026-03-01']?.webhooks).toBeTruthy();
    expect(docs['2026-03-01']?.components?.schemas?.Hotel?.properties?.stars?.deprecated).toBe(true);
    expect(docs['2026-01-15']?.components?.schemas?.Hotel?.properties?.stars?.deprecated).toBeUndefined();
    expect(docs['2025-10-01']?.components?.schemas?.Hotel?.properties?.locality).toBeUndefined();
    const body = join(dir, 'body.json');
    writeFileSync(body, '{"city":"Paris"}\n');
    const diff = diffBody(dir, 'Hotel', '2025-10-01', '2026-03-01', readFileSync(body, 'utf8'), undefined, '2026-10-31');
    expect(diff.ok).toBe(true);
    if (diff.ok) {
      expect(diff.text.indexOf('add-stars')).toBeLessThan(diff.text.indexOf('rename-city'));
    }
    expect(diffBody(dir, 'Hotel', '2026-03-01', '2026-03-01', '{}', undefined, '2026-10-31')).toEqual({ ok: true, text: '' });
    const bad = diffBody(dir, 'Hotel', '2025-10-01', '2026-03-01', '{', undefined, '2026-10-31');
    expect(bad.ok).toBe(false);
  });
});
