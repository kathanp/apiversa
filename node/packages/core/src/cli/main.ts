#!/usr/bin/env node
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doctor } from './doctor.js';
import { init } from './init.js';
import { lockFiles } from './lock.js';

/** `apiversa init|lock|doctor [directory]`. Returns the process status. */
export function runCli(argv: string[], cwd = process.cwd()): number {
  const command = argv[2];
  const dir = argv[3] ? argv[3] : join(cwd, 'api-versions');
  if (command === 'init') {
    const created = init(argv[3] ? argv[3] : cwd);
    process.stdout.write(`created ${created}\n`);
    return 0;
  }
  if (command === 'lock') {
    lockFiles(dir);
    process.stdout.write(`wrote ${join(dir, '.lock.json')}\n`);
    return 0;
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
  process.stderr.write('usage: apiversa init [directory] | apiversa lock [api-versions] | apiversa doctor [api-versions]\n');
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runCli(process.argv);
}
