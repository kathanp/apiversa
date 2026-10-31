#!/usr/bin/env node
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeChangelog } from './changelog.js';
import { checkBundle } from './check.js';
import { doctor } from './doctor.js';
import { generate } from './generate.js';
import { init } from './init.js';
import { lockFiles } from './lock.js';
import { writeOpenApi } from './openapi.js';

/** `apiversa init|lock|doctor|generate|check|openapi|changelog`. Returns the process status. */
export function runCli(argv: string[], cwd = process.cwd()): number {
  const command = argv[2];
  const rest = argv.slice(3);
  const dir = rest.find((arg) => !arg.startsWith('--')) ?? join(cwd, 'api-versions');
  if (command === 'init') {
    const created = init(argv[3] ? argv[3] : cwd);
    process.stdout.write(`created ${created}\n`);
    return 0;
  }
  if (command === 'check') {
    const format = rest.includes('--format') && rest[rest.indexOf('--format') + 1] === 'markdown' ? 'markdown' : 'text';
    const result = checkBundle(dir, { format, suggest: rest.includes('--suggest') });
    const out = result.ok ? process.stdout : process.stderr;
    out.write(`${result.summary}\n`);
    if (result.suggested) process.stderr.write(`wrote draft ${result.suggested}\n`);
    return result.ok ? 0 : 1;
  }
  if (command === 'lock') {
    lockFiles(dir);
    process.stdout.write(`wrote ${join(dir, '.lock.json')}\n`);
    return 0;
  }
  if (command === 'generate') {
    try {
      const written = generate(dir);
      for (const file of written) process.stdout.write(`wrote ${file}\n`);
      return 0;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : 'generate failed'}\n`);
      return 1;
    }
  }
  if (command === 'openapi') {
    try {
      const written = writeOpenApi(dir);
      for (const file of written) process.stdout.write(`wrote ${file}\n`);
      return 0;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : 'openapi failed'}\n`);
      return 1;
    }
  }
  if (command === 'changelog') {
    try {
      const format = rest.includes('--format') && rest[rest.indexOf('--format') + 1] === 'json' ? 'json' : 'markdown';
      const result = writeChangelog(dir);
      process.stdout.write(format === 'json' ? `${JSON.stringify(result.json)}\n` : `${result.markdown}\n`);
      return 0;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : 'changelog failed'}\n`);
      return 1;
    }
  }
  if (command === 'doctor') {
    const problems = doctor(dir);
    if (problems.length === 0) {
      process.stdout.write('apiversa doctor: no problems\n');
      return 0;
    }
    for (const problem of problems) process.stderr.write(`${problem.message} Fix: ${problem.fix}\n`);
    return 1;
  }
  process.stderr.write('usage: apiversa init [directory] | apiversa lock [api-versions] | apiversa doctor [api-versions] | apiversa generate [api-versions] | apiversa check [api-versions] [--format markdown] [--suggest] | apiversa openapi [api-versions] | apiversa changelog [api-versions] [--format json]\n');
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runCli(process.argv);
}
