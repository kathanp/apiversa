import { readFileSync, writeFileSync } from 'node:fs';
import { loadBundle, type Bundle } from '../bundle/load.js';
import { ApiversaError } from '../errors.js';
import { encodeJson } from '../json/encode.js';
import { fromPlain, toPlain } from '../json/parse.js';
import type { Direction } from '../errors.js';
import type { JValue } from '../json/value.js';
import { applyData } from '../ops/apply.js';

/**
 * Print each change between two dates and the canonical body after that change.
 * `--out` is the only path that writes a file. Nothing is sent.
 */
export function diffBody(dir: string, schema: string, from: string, to: string, bodyText: string, outPath?: string, today?: string): { ok: true; text: string } | { ok: false; code: string } {
  try {
    const bundle = loadBundle(dir, { today });
    const target = to || bundle.head;
    if (from === target) return { ok: true, text: '' };
    const direction: Direction = from < target ? 'up' : 'down';
    const steps = stepsBetween(bundle, from, target, direction);
    let current = fromPlain(JSON.parse(bodyText) as unknown, direction);
    const lines: string[] = [];
    for (const step of steps) {
      current = applyData(current, schema, step.op, { when: direction, converters: bundle.converters, registry: bundle.registry, development: false }, 0) as JValue;
      const plain = toPlain(current, schema, bundle.registry);
      lines.push(`${step.version}.${step.id} ${encodeJson(fromPlain(plain, direction), direction)}`);
    }
    const text = lines.join('\n');
    if (outPath) {
      const finalBody = lines.length === 0 ? bodyText : lines[lines.length - 1]!.slice(lines[lines.length - 1]!.indexOf(' ') + 1);
      writeFileSync(outPath, finalBody);
    }
    return { ok: true, text };
  } catch (error) {
    const code = error instanceof ApiversaError ? error.code : 'AV-E001';
    return { ok: false, code };
  }
}

function stepsBetween(bundle: Bundle, from: string, to: string, direction: Direction) {
  const selected = bundle.changes.filter((change) => (direction === 'up' ? change.version > from && change.version <= to : change.version > to && change.version <= from));
  selected.sort((left, right) => left.version.localeCompare(right.version) || left.id.localeCompare(right.id));
  const steps = selected.flatMap((change) => change.ops.map((op) => ({ version: change.version, id: change.id, op })));
  if (direction === 'down') steps.reverse();
  return steps;
}
