import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle } from '../bundle/load.js';
import { ApiversaError } from '../errors.js';
import { lockProblems } from './lock.js';

export type DoctorProblem = { message: string; fix: string };

/**
 * Checks the bundle, change files, locks, drafts, converters, schemas, routes, and pin wiring.
 * Each problem includes a fix. The CLI exits non-zero when this list is not empty.
 */
export function doctor(dir: string): DoctorProblem[] {
  const problems: DoctorProblem[] = [];
  const versionsPath = join(dir, 'versions.yaml');
  if (!existsSync(versionsPath)) {
    problems.push({ message: 'api-versions/versions.yaml is missing.', fix: 'Run apiversa init.' });
    return problems;
  }
  const versionsText = readFileSync(versionsPath, 'utf8');
  if (versionsText.includes('pin-on-first-call') && !existsSync(join(dir, 'pins.ts')) && !existsSync(join(dir, 'pins.js'))) {
    problems.push({
      message: 'default is pin-on-first-call and no pins.ts module is next to the bundle.',
      fix: 'Pass a pin store to createApiversa, or add api-versions/pins.ts that exports it.',
    });
  }
  try {
    loadBundle(dir);
  } catch (error) {
    const message = error instanceof ApiversaError ? error.message : 'The bundle failed to load.';
    problems.push({ message, fix: 'Open the change file named in the detail and correct it before serving traffic.' });
  }
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.yaml') || name === 'versions.yaml') continue;
    const text = readFileSync(join(dir, name), 'utf8');
    if (/(^|\n)\s*draft:\s*true\b/.test(text)) {
      problems.push({ message: `${name} is a draft.`, fix: 'Remove draft: true before this directory is loaded at startup.' });
    }
    for (const match of text.matchAll(/\bconverter:\s*([A-Za-z0-9_-]+)/g)) {
      const converter = match[1]!;
      if (!existsSync(join(dir, `${converter}.ts`)) && !existsSync(join(dir, `${converter}.js`))) {
        problems.push({
          message: `${name} names converter ${converter}, and that module is not in the bundle directory.`,
          fix: `Add ${converter}.ts and pass the function to createApiversa.`,
        });
      }
    }
  }
  for (const name of lockProblems(dir)) {
    problems.push({
      message: `Locked change file ${name} does not match .lock.json.`,
      fix: 'Restore the released file, or run apiversa lock after an intentional edit.',
    });
  }
  const routesPath = join(dir, 'routes.json');
  if (existsSync(routesPath)) problems.push(...routeProblems(dir, routesPath));
  return problems;
}

function routeProblems(dir: string, routesPath: string): DoctorProblem[] {
  const problems: DoctorProblem[] = [];
  let routes: { path?: string; schema?: string; response?: string }[];
  try {
    const parsed = JSON.parse(readFileSync(routesPath, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) throw new Error('routes');
    routes = parsed as { path?: string; schema?: string; response?: string }[];
  } catch {
    return [{ message: 'routes.json is not a JSON array.', fix: 'Write [{ "path": "/hotels/:id", "response": "Hotel" }].' }];
  }
  const used = new Set<string>();
  for (const route of routes) {
    if (route.schema) used.add(route.schema);
    if (route.response) used.add(route.response);
    if (!route.schema && !route.response) {
      problems.push({
        message: `Route ${route.path ?? '(missing path)'} has no declared schema.`,
        fix: 'Set schema or response on that route in routes.json.',
      });
    }
  }
  const declared = new Set<string>();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.yaml') || name === 'versions.yaml') continue;
    for (const match of readFileSync(join(dir, name), 'utf8').matchAll(/\bschema:\s*([A-Za-z0-9_-]+)/g)) declared.add(match[1]!);
  }
  for (const schema of declared) {
    if (!used.has(schema)) {
      problems.push({
        message: `Schema ${schema} is not used by any route.`,
        fix: 'Add a route in routes.json that names it, or delete the unused schema from the change file.',
      });
    }
  }
  return problems;
}
