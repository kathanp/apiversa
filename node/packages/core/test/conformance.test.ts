import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle/load.js';
import { execute } from '../src/chain/run.js';
import { ApiversaError, type Direction } from '../src/errors.js';
import type { Registry } from '../src/json/parse.js';
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
      };
      const registry: Registry = {};
      registry[spec.schema] = spec.fields ? { fields: spec.fields.map((field) => ({ name: field })) } : {};
      for (const [schema, fields] of Object.entries(spec.schemas ?? {})) {
        registry[schema] = { fields: fields.map((field) => ({ name: field })) };
      }
      const bundle = buildBundle(versions, changes, { today: '2026-10-30', registry });
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
