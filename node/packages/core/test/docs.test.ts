import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { changelogBundle } from '../src/cli/changelog.js';
import { runCli } from '../src/cli/main.js';
import { openApiVersions, versionPicker } from '../src/cli/openapi.js';
import { schemaFieldsAt } from '../src/cli/generate.js';
import { loadBundle } from '../src/bundle/load.js';

const TODAY = '2026-10-31';

describe('per-version docs', () => {
  it('drops added endpoints, restores removed ones, and matches the generated schema', () => {
    const dir = bundle();
    const head = {
      openapi: '3.1.0',
      info: { title: 'Hotels', version: '2026-03-01' },
      paths: {
        '/hotels': { get: { responses: { '200': { description: 'one' } } }, post: { responses: { '200': { description: 'create' } } } },
        '/hotels/{id}': { get: { responses: { '200': { description: 'by id' } } } },
      },
      components: { schemas: { Hotel: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, nickname: { type: 'string' } }, required: ['id', 'nickname'] } } },
    };
    const docs = openApiVersions(dir, head, TODAY);
    const older = docs['2026-01-15'];
    expect(older?.info?.version).toBe('2026-01-15');
    expect(older?.paths?.['/hotels']?.post).toBeUndefined();
    expect(older?.paths?.['/hotels']?.get).toBeDefined();
    expect(older?.paths?.['/legacy']?.get).toMatchObject({ responses: { '200': { description: 'Hotel nickname and POST /hotels were added.' } } });
    expect(older?.paths?.['/hotels/{id}']?.get).toBeUndefined();
    expect(older?.paths?.['/hotels/{hotelId}']?.get).toBeDefined();
    expect(docs['2026-03-01']?.paths?.['/legacy']).toBeUndefined();
    const loaded = loadBundle(dir, { today: TODAY, registry: { Hotel: { fields: [{ name: 'id' }, { name: 'name' }, { name: 'nickname' }] } } });
    const fields = schemaFieldsAt({ Hotel: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'nickname', type: 'string' }] }, loaded, '2026-01-15');
    expect(Object.keys(older?.components?.schemas?.Hotel?.properties ?? {})).toEqual(fields.Hotel?.map((field) => field.name));
    expect(older?.components?.schemas?.Hotel?.properties?.nickname).toBeUndefined();
    const picker = versionPicker(Object.keys(docs));
    expect(picker.swagger.urls.map((item) => item.name)).toEqual(['2026-03-01', '2026-01-15']);
    expect(picker.swagger['urls.primaryName']).toBe('2026-03-01');
    expect(picker.scalar.sources[0]).toEqual({ title: '2026-03-01', url: '/openapi/2026-03-01.json' });
    expect(runCli(['node', 'apiversa', 'openapi', dir])).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, 'openapi/picker.json'), 'utf8')).scalar.sources).toHaveLength(2);
  });

  it('writes the changelog in markdown and json with the endpoints each change touches', () => {
    const dir = bundle();
    writeFileSync(join(dir, 'routes.json'), JSON.stringify([{ method: 'GET', path: '/hotels', schema: 'Hotel' }]));
    const result = changelogBundle(dir);
    expect(result.markdown).toContain('## 2026-03-01');
    expect(result.markdown).toContain('add-post: Hotel nickname and POST /hotels were added.');
    expect(result.markdown).toContain('POST /hotels');
    expect(result.markdown).toContain('GET /legacy');
    expect(result.json.versions[0]?.changes.find((change) => change.id === 'add-name')?.endpoints).toEqual(['GET /hotels']);
    expect(runCli(['node', 'apiversa', 'changelog', dir, '--format', 'json'])).toBe(0);
    const json = JSON.parse(readFileSync(join(dir, 'changelog.json'), 'utf8')) as { versions: { date: string }[] };
    expect(json.versions[0]?.date).toBe('2026-03-01');
    expect(readFileSync(join(dir, 'changelog.md'), 'utf8')).toContain('## 2026-01-15');
  });

  it('covers missing docs, drafts, and paths that are already gone', () => {
    const dir = bundle();
    expect(runCli(['node', 'apiversa', 'changelog', dir])).toBe(0);
    expect(readFileSync(join(dir, 'changelog.md'), 'utf8')).toContain('add-name');
    writeFileSync(join(dir, 'routes.json'), JSON.stringify({}));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\n  - {}\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.draft.yaml'), 'version: "2026-03-01"\nid: draft-note\ndescription: "skip"\ndraft: true\nchanges:\n  - op: endpoint.add\n');
    writeFileSync(join(dir, '2026-03-01.bare.yaml'), 'version: "2026-03-01"\nid: bare-endpoint\ndescription: "no path"\nchanges:\n  - op: endpoint.rename\n');
    writeFileSync(join(dir, '2026-01-15.empty.yaml'), '# comment\n');
    const notes = changelogBundle(dir);
    expect(notes.json.versions[0]?.changes.some((change) => change.id === 'draft-note')).toBe(false);
    expect(notes.markdown).toContain('(none declared)');
    expect(versionPicker([])['swagger']['urls.primaryName']).toBe('');
    const bare = mkdtempSync(join(tmpdir(), 'apiversa-docs-bare-'));
    expect(runCli(['node', 'apiversa', 'openapi', bare])).toBe(1);
    expect(runCli(['node', 'apiversa', 'changelog', bare])).toBe(1);
    writeFileSync(join(bare, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(bare, 'head.json'), JSON.stringify({ Hotel: [{ name: 'id' }, { name: 'name', type: 'string' }] }));
    writeFileSync(
      join(bare, '2026-03-01.edges.yaml'),
      'version: "2026-03-01"\nid: edges\ndescription: "edges"\nchanges:\n  - op: endpoint.add\n    method: GET\n    path: /missing\n  - op: endpoint.remove\n    method: GET\n    path: /hotels\n    legacyHandler: legacyList\n  - op: endpoint.rename\n    method: GET\n    from: /old\n    to: /absent\n  - op: field.add\n    schema: Hotel\n    path: name\n    default: Bay\n',
    );
    const docs = openApiVersions(bare, { openapi: '3.1.0', paths: { '/hotels': { get: { responses: {} } } } }, TODAY);
    expect(docs['2026-01-15']?.paths?.['/hotels']?.get).toBeDefined();
    expect(docs['2026-01-15']?.paths?.['/missing']).toBeUndefined();
    const noHead = mkdtempSync(join(tmpdir(), 'apiversa-docs-schema-'));
    writeFileSync(noHead + '/versions.yaml', 'head: "2026-01-15"\nversions:\n  - date: "2026-01-15"\ndefault: oldest\n');
    const fromSchema = openApiVersions(noHead, { components: { schemas: { Hotel: { properties: { id: {} } } } } }, TODAY);
    expect(fromSchema['2026-01-15']?.components?.schemas?.Hotel?.properties?.id).toEqual({});
  });
});

function bundle(): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-docs-'));
  writeFileSync(
    join(dir, 'versions.yaml'),
    'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n',
  );
  writeFileSync(
    join(dir, 'head.json'),
    JSON.stringify({ Hotel: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'nickname', type: 'string' }] }),
  );
  writeFileSync(
    join(dir, 'openapi.json'),
    JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Hotels', version: '2026-03-01' },
      paths: { '/hotels': { get: {}, post: {} } },
      components: { schemas: { Hotel: { properties: { id: { type: 'string' } } } } },
    }),
  );
  writeFileSync(
    join(dir, '2026-03-01.add-post.yaml'),
    'version: "2026-03-01"\nid: add-post\ndescription: "Hotel nickname and POST /hotels were added."\nchanges:\n  - op: endpoint.add\n    method: POST\n    path: /hotels\n  - op: endpoint.remove\n    method: GET\n    path: /legacy\n    legacyHandler: legacyList\n  - op: endpoint.rename\n    method: GET\n    from: /hotels/:hotelId\n    to: /hotels/:id\n  - op: field.add\n    schema: Hotel\n    path: nickname\n    default: ""\n',
  );
  writeFileSync(
    join(dir, '2026-03-01.add-name.yaml'),
    'version: "2026-03-01"\nid: add-name\ndescription: "Hotel.name was added."\nchanges:\n  - op: field.add\n    schema: Hotel\n    path: name\n    default: Bay\n',
  );
  return dir;
}
