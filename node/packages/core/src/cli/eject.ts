import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseYaml } from '../yaml/parse.js';

type Op = { op?: string; schema?: string; path?: string; from?: string; to?: string; method?: string; default?: unknown };

/**
 * Write each change as a plain function, plus a route list, so a team can leave the library.
 * The generated files do not import apiversa and do not call the network.
 */
export function eject(dir: string, outDir: string): string[] {
  mkdirSync(outDir, { recursive: true });
  const changes = readChanges(dir);
  const routes: string[] = [];
  const functions: string[] = [
    "'use strict';",
    'function rename(body, from, to) {',
    '  if (!body || typeof body !== "object" || Array.isArray(body) || !(from in body)) return body;',
    '  const next = { ...body };',
    '  next[to] = next[from];',
    '  delete next[from];',
    '  return next;',
    '}',
    'function add(body, path, value) {',
    '  if (!body || typeof body !== "object" || Array.isArray(body) || path in body) return body;',
    '  return { ...body, [path]: value };',
    '}',
    'function remove(body, path) {',
    '  if (!body || typeof body !== "object" || Array.isArray(body) || !(path in body)) return body;',
    '  const next = { ...body };',
    '  delete next[path];',
    '  return next;',
    '}',
  ];
  for (const file of changes) {
    const name = `v_${file.version.replaceAll('-', '_')}_${file.id.replaceAll('-', '_')}`;
    functions.push(`/** ${file.description.replaceAll('*/', '')} */`);
    functions.push(`export function up_${name}(body) { return step(body, ${JSON.stringify(file.changes)}, "up"); }`);
    functions.push(`export function down_${name}(body) { return step(body, ${JSON.stringify(file.changes)}, "down"); }`);
    for (const op of file.changes) {
      if (String(op.op ?? '').startsWith('endpoint.') && (op.path || op.from)) {
        routes.push(`${op.method ?? 'GET'} ${op.path ?? op.from} -> ${file.version}.${file.id}`);
      }
    }
  }
  functions.push('function step(body, ops, direction) {');
  functions.push('  let value = body;');
  functions.push('  const list = direction === "down" ? [...ops].reverse() : ops;');
  functions.push('  for (const op of list) {');
  functions.push('    if (op.op === "field.rename" || op.op === "field.move") {');
  functions.push('      value = direction === "up" ? rename(value, op.from, op.to) : rename(value, op.to, op.from);');
  functions.push('    } else if (op.op === "field.add" && direction === "up") value = add(value, op.path, op.default);');
  functions.push('    else if (op.op === "field.remove" && direction === "up") value = remove(value, op.path);');
  functions.push('  }');
  functions.push('  return value;');
  functions.push('}');
  const changesPath = join(outDir, 'changes.mjs');
  const routesPath = join(outDir, 'routes.mjs');
  writeFileSync(changesPath, `${functions.join('\n')}\n`);
  writeFileSync(routesPath, `export const routes = ${JSON.stringify(routes, null, 2)};\n`);
  return [changesPath, routesPath];
}

function readChanges(dir: string): { version: string; id: string; description: string; changes: Op[] }[] {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.yaml') || name === 'versions.yaml') continue;
    const doc = parseYaml(readFileSync(join(dir, name), 'utf8')) as { version?: string; id?: string; description?: string; draft?: boolean; changes?: Op[] };
    if (!doc || doc.draft === true) continue;
    files.push({ version: String(doc.version ?? ''), id: String(doc.id ?? name), description: String(doc.description ?? ''), changes: doc.changes ?? [] });
  }
  files.sort((left, right) => left.version.localeCompare(right.version) || left.id.localeCompare(right.id));
  return files;
}
