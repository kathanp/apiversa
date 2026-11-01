import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildBundle, type Bundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';
import { ApiversaError, type Direction } from '../src/errors.js';
import { encodeJson } from '../src/json/encode.js';
import { fromPlain, type Registry } from '../src/json/parse.js';
import { endpointDeprecationHeaders } from '../src/lifecycle.js';
import { parseYaml } from '../src/yaml/parse.js';

const ROOT = join(import.meta.dirname, '../../../../conformance/fixtures/core');

describe('conformance fixtures', () => {
  for (const name of readdirSync(ROOT)) {
    it(name, () => {
      const dir = join(ROOT, name);
      const versions = parseYaml(readFileSync(join(dir, 'versions.yaml'), 'utf8'));
      const changes = readdirSync(join(dir, 'changes'))
        .filter((file) => file.endsWith('.yaml'))
        .sort()
        .map((file) => parseYaml(readFileSync(join(dir, 'changes', file), 'utf8')));
      const spec = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')) as {
        schema: string;
        direction: Direction;
        version: string;
        input?: unknown;
        raw?: string;
        expected?: unknown;
        error?: string;
        fields?: string[];
        schemas?: Record<string, string[]>;
        request?: { method?: string; path?: string; query?: [string, string][]; headers?: [string, string][]; body?: unknown; status?: number };
        response?: { status?: number; headers?: [string, string][]; body?: unknown };
      };
      const registry: Registry = {};
      registry[spec.schema] = spec.fields ? { fields: spec.fields.map((field) => ({ name: field })) } : {};
      for (const [schema, fields] of Object.entries(spec.schemas ?? {})) {
        registry[schema] = { fields: fields.map((field) => ({ name: field })) };
      }
      const bundle = buildBundle(versions, changes, { today: '2026-10-30', registry });
      if (spec.request) {
        checkRequest(name, bundle, spec);
        return;
      }
      const body = spec.raw !== undefined ? spec.raw : spec.input;
      try {
        const actual = execute(bundle, { schema: spec.schema, version: spec.version, body, trace: false }, spec.direction).body;
        expect(spec.error).toBeUndefined();
        expect(JSON.stringify(actual)).toBe(JSON.stringify(spec.expected));
      } catch (error) {
        expect(error).toBeInstanceOf(ApiversaError);
        expect((error as ApiversaError).code).toBe(spec.error);
      }
    });
  }
});

function checkRequest(name: string, bundle: Bundle, spec: { schema: string; direction: Direction; version: string; error?: string; request: { method?: string; path?: string; query?: [string, string][]; headers?: [string, string][]; body?: unknown; status?: number }; expected?: { method?: string; path?: string; query?: [string, string][]; headers?: [string, string][]; body?: unknown }; response?: { status?: number; headers?: [string, string][]; body?: unknown } }): void {
  const request = spec.request;
  try {
    const actual = execute(bundle, {
      schema: spec.schema,
      version: spec.version,
      body: request.body,
      method: request.method,
      path: request.path,
      query: (request.query ?? []).map(([pairName, value]) => ({ name: pairName, value })),
      headers: (request.headers ?? []).map(([pairName, value]) => ({ name: pairName, value })),
      status: request.status,
      trace: false,
    }, spec.direction);
    expect(spec.error, name).toBeUndefined();
    if (spec.response) {
      const extra = endpointDeprecationHeaders(bundle, spec.version, request.method, request.path).map((header) => [header.name, header.value] as [string, string]);
      if (typeof spec.response.status === 'number') expect(actual.status, name).toBe(spec.response.status);
      expect(headerKey([...actual.headers.map((header) => [header.name, header.value] as [string, string]), ...extra]), name).toBe(headerKey(spec.response.headers ?? []));
      expect(canon(actual.body), name).toBe(canon(spec.response.body));
      return;
    }
    const expected = spec.expected as { method?: string; path?: string; query?: [string, string][]; headers?: [string, string][]; body?: unknown };
    expect(actual.method, name).toBe(expected.method);
    expect(actual.path, name).toBe(expected.path);
    expect((actual.query ?? []).map((pair) => [pair.name, pair.value]), name).toEqual(expected.query ?? []);
    expect(headerKey(actual.headers.map((header) => [header.name, header.value])), name).toBe(headerKey(expected.headers ?? []));
    expect(canon(actual.body), name).toBe(canon(expected.body));
  } catch (error) {
    if (!(error instanceof ApiversaError)) throw error;
    expect(error.code, name).toBe(spec.error);
  }
}

function headerKey(headers: [string, string][]): string {
  return headers.map(([pairName, value]) => `${pairName.toLowerCase()}=${value}`).sort().join('\n');
}

function canon(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  return encodeJson(fromPlain(value, 'up'), 'up');
}
