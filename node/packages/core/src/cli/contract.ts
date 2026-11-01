import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle, planFor, type Bundle } from '../bundle/load.js';
import { api } from '../create.js';
import { encodeJson } from '../json/encode.js';
import { fromPlain, type Registry } from '../json/parse.js';
import { parseYaml } from '../yaml/parse.js';

export type ContractResult = { ok: boolean; summary: string };

type Fixture = {
  name: string;
  schema: string;
  method?: string;
  path?: string;
  request: unknown;
  response: unknown;
  snapshots?: Record<string, { request?: unknown; response?: unknown }>;
  exercises?: string[];
};

/**
 * Replay head fixtures through every version and require every change to be exercised.
 * A missing snapshot, a byte mismatch, or change coverage under 100% fails.
 */
export function testBundle(dir: string): ContractResult {
  const fixtures = readFixtures(dir);
  const registry = registryFor(dir, fixtures);
  let bundle: Bundle;
  try {
    bundle = loadBundle(dir, { registry });
  } catch (error) {
    return { ok: false, summary: error instanceof Error ? error.message : 'bundle failed' };
  }
  const av = api(bundle, { header: 'Api-Version', development: false, trace: false });
  const lines: string[] = [];
  let ok = true;
  const exercised = new Set<string>();
  for (const fixture of fixtures) {
    for (const id of fixture.exercises ?? []) exercised.add(id);
    for (const date of bundle.dates) {
      if (date === bundle.head) continue;
      for (const direction of ['up', 'down'] as const) {
        for (const step of planFor(bundle, date, direction)) {
          if (step.op.schema && step.op.schema !== fixture.schema) continue;
          exercised.add(`${step.version}.${step.id}`);
        }
      }
      const snap = fixture.snapshots?.[date];
      if (!snap) {
        ok = false;
        lines.push(`${fixture.name} ${date}: missing snapshot`);
        continue;
      }
      try {
        const upgraded = av.convertRequest({ schema: fixture.schema, version: date, body: snap.request, method: fixture.method, path: fixture.path });
        const downgraded = av.convertResponse({ schema: fixture.schema, version: date, body: fixture.response });
        if (canon(upgraded) !== canon(fixture.request)) {
          ok = false;
          lines.push(`${fixture.name} ${date}: request does not upgrade to the head fixture`);
        }
        if (canon(downgraded) !== canon(snap.response)) {
          ok = false;
          lines.push(`${fixture.name} ${date}: response does not match the snapshot`);
        }
      } catch (error) {
        ok = false;
        lines.push(`${fixture.name} ${date}: ${error instanceof Error ? error.message : 'conversion failed'}`);
      }
    }
  }
  const uncovered = bundle.changes.filter((change) => !exercised.has(`${change.version}.${change.id}`));
  const covered = bundle.changes.length - uncovered.length;
  lines.push(`change coverage ${covered}/${bundle.changes.length}`);
  if (uncovered.length > 0) {
    ok = false;
    for (const change of uncovered) lines.push(`uncovered ${change.version}.${change.id}`);
  }
  if (fixtures.length === 0 && bundle.changes.length === 0) return { ok: true, summary: 'No changes to cover.' };
  return { ok, summary: lines.join('\n') };
}

function canon(value: unknown): string {
  return encodeJson(fromPlain(value, 'up'), 'up');
}

function readFixtures(dir: string): Fixture[] {
  const folder = join(dir, 'fixtures');
  if (!existsSync(folder)) return [];
  const fixtures: Fixture[] = [];
  for (const name of readdirSync(folder).filter((item) => item.endsWith('.json')).sort()) {
    const doc = JSON.parse(readFileSync(join(folder, name), 'utf8')) as Omit<Fixture, 'name'>;
    fixtures.push({ ...doc, name: name.replace(/\.json$/, '') });
  }
  return fixtures;
}

function registryFor(dir: string, fixtures: Fixture[]): Registry {
  const registry: Registry = {};
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.yaml') || name === 'versions.yaml') continue;
      const doc = parseYaml(readFileSync(join(dir, name), 'utf8')) as { changes?: { schema?: string }[] } | null;
      for (const op of doc?.changes ?? []) if (op.schema) registry[op.schema] = registry[op.schema] ?? {};
    }
  }
  for (const fixture of fixtures) registry[fixture.schema] = registry[fixture.schema] ?? {};
  return registry;
}
