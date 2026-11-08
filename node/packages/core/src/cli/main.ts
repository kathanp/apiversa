#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeChangelog } from './changelog.js';
import { checkBundle } from './check.js';
import { doctor } from './doctor.js';
import { eject } from './eject.js';
import { generate } from './generate.js';
import { init } from './init.js';
import { lockFiles } from './lock.js';
import { testBundle } from './contract.js';
import { writeOpenApi } from './openapi.js';
import { diffBody } from './diff.js';
import { explain } from './explain.js';
import { writeMatrix } from './matrix.js';
import { replay } from './replay.js';
import { retire } from './retire.js';
import { typeDiff } from './typeDiff.js';
import { writeAsyncApi } from './asyncapi.js';
import { clientsMatch, writeClientFiles, type ClientLang } from './clients.js';
import { writeBundleDiff } from './bundleDiff.js';
import { writeCompat } from './compat.js';
import { writePact } from './pact.js';
import { rewriteFailure, rewriteJsonl } from './rewrite.js';
import { writeSnippets } from './snippets.js';
import { upgradeGuide } from './upgradeGuide.js';

/** `apiversa init|lock|doctor|generate|check|test|openapi|changelog|eject|upgrade-guide`. Returns the process status. */
export function runCli(argv: string[], cwd = process.cwd()): number {
  const command = argv[2];
  const rest = argv.slice(3);
  const dir = positional(rest) ?? join(cwd, 'api-versions');
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
      const types = rest.includes('--types') ? `\n\n${typeDiff(dir)}` : '';
      process.stdout.write(format === 'json' ? `${JSON.stringify(result.json)}\n` : `${result.markdown}${types}\n`);
      return 0;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : 'changelog failed'}\n`);
      return 1;
    }
  }
  if (command === 'test') {
    const result = testBundle(dir);
    const out = result.ok ? process.stdout : process.stderr;
    out.write(`${result.summary}\n`);
    return result.ok ? 0 : 1;
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
  if (command === 'eject') {
    const out = flag(rest, '--out') ?? join(cwd, 'ejected');
    const written = eject(dir, out);
    for (const file of written) process.stdout.write(`wrote ${file}\n`);
    return 0;
  }
  if (command === 'explain') {
    const version = flag(rest, '--version');
    const route = flag(rest, '--route');
    if (!version || !route) {
      process.stderr.write('usage: apiversa explain --version YYYY-MM-DD --route "GET /hotels/:id" [api-versions]\n');
      return 1;
    }
    process.stdout.write(`${explain(dir, version, route)}\n`);
    return 0;
  }
  if (command === 'retire') {
    const date = rest.find((arg) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(arg));
    const folder = rest.find((arg) => arg !== date && !arg.startsWith('--')) ?? join(cwd, 'api-versions');
    if (!date) {
      process.stderr.write('usage: apiversa retire YYYY-MM-DD [api-versions] [--force]\n');
      return 1;
    }
    try {
      const removed = retire(folder, date, { force: rest.includes('--force') });
      process.stdout.write(`retired ${date}\n`);
      for (const file of removed) process.stdout.write(`removed ${file}\n`);
      return 0;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : 'retire failed'}\n`);
      return 1;
    }
  }
  if (command === 'replay') {
    const file = flag(rest, '--samples') ?? positional(rest.filter((arg) => arg !== dir));
    if (!file) {
      process.stderr.write('usage: apiversa replay --samples samples.jsonl [api-versions]\n');
      return 1;
    }
    const found = replay(dir, file);
    if (found.length === 0) {
      process.stdout.write('apiversa replay: no differences\n');
      return 0;
    }
    for (const line of found) process.stderr.write(`${line}\n`);
    return 1;
  }
  if (command === 'diff') {
    const schema = flag(rest, '--schema');
    const from = flag(rest, '--from');
    const body = flag(rest, '--body');
    if (!schema || !from || !body) {
      process.stderr.write('usage: apiversa diff --schema Hotel --from YYYY-MM-DD --body body.json [--to YYYY-MM-DD] [--out file] [api-versions]\n');
      return 1;
    }
    const result = diffBody(dir, schema, from, flag(rest, '--to') ?? '', readFile(body), flag(rest, '--out'));
    if (!result.ok) {
      process.stderr.write(`${result.code}\n`);
      return 1;
    }
    if (result.text) process.stdout.write(`${result.text}\n`);
    return 0;
  }
  if (command === 'matrix') {
    const written = writeMatrix(dir, flag(rest, '--out'));
    process.stdout.write(`wrote ${written}\n`);
    return 0;
  }
  if (command === 'snippets') {
    const version = flag(rest, '--version');
    if (!version) {
      process.stderr.write('usage: apiversa snippets --version YYYY-MM-DD [--header name]\n');
      return 1;
    }
    for (const file of writeSnippets(cwd, version, flag(rest, '--header') ?? 'Api-Version')) process.stdout.write(`wrote ${file}\n`);
    return 0;
  }
  if (command === 'rewrite') {
    const schema = flag(rest, '--schema');
    const direction = flag(rest, '--direction');
    const version = flag(rest, '--version');
    const input = flag(rest, '--in');
    const out = flag(rest, '--out');
    if (!schema || (direction !== 'up' && direction !== 'down') || !version || !input || !out) {
      process.stderr.write('usage: apiversa rewrite --schema Name --direction up|down --version YYYY-MM-DD --in file --out file [api-versions]\n');
      return 1;
    }
    const result = rewriteJsonl(dir, { schema, direction, version, input, out });
    if (!result.ok) {
      process.stderr.write(`${rewriteFailure(result)}\n`);
      return 1;
    }
    return 0;
  }
  if (command === 'asyncapi') {
    const result = writeAsyncApi(dir);
    if (!result.ok) {
      process.stderr.write(`${result.code}\n`);
      return 1;
    }
    for (const file of result.files) process.stdout.write(`wrote ${file}\n`);
    return 0;
  }
  if (command === 'clients') {
    if (!rest.includes('--check')) {
      process.stderr.write('usage: apiversa clients --check [api-versions]\n');
      return 1;
    }
    return clientsMatch(dir) ? 0 : 1;
  }
  if (command === 'generate-client') {
    const lang = flag(rest, '--lang') ?? 'java';
    if (lang !== 'java' && lang !== 'python' && lang !== 'go') {
      process.stderr.write('usage: apiversa generate-client [--lang java|python|go] [api-versions]\n');
      return 1;
    }
    for (const file of writeClientFiles(dir, lang as ClientLang)) process.stdout.write(`wrote ${file}\n`);
    return 0;
  }
  if (command === 'compat') {
    process.stdout.write(`wrote ${writeCompat(dir, flag(rest, '--out'), undefined, cwd)}\n`);
    return 0;
  }
  if (command === 'pact') {
    const input = flag(rest, '--in');
    const out = flag(rest, '--out');
    if (!input || !out) {
      process.stderr.write('usage: apiversa pact --in pact.json --out pact-result.json [api-versions]\n');
      return 1;
    }
    const result = writePact(dir, input, out);
    if (!result.ok) {
      process.stderr.write(`${result.code}\n`);
      return 1;
    }
    return 0;
  }
  if (command === 'bundle-diff') {
    const left = flag(rest, '--left');
    const right = flag(rest, '--right');
    const out = flag(rest, '--out');
    if (!left || !right || !out) {
      process.stderr.write('usage: apiversa bundle-diff --left dir --right dir --out bundle-diff.json\n');
      return 1;
    }
    const result = writeBundleDiff(left, right, out);
    if (!result.ok) {
      process.stderr.write(`${result.code}\n`);
      return 1;
    }
    return 0;
  }
  if (command === 'upgrade-guide') {
    const from = flag(rest, '--from');
    if (!from) {
      process.stderr.write('usage: apiversa upgrade-guide --from YYYY-MM-DD [api-versions]\n');
      return 1;
    }
    process.stdout.write(`${upgradeGuide(dir, from)}\n`);
    return 0;
  }
  process.stderr.write('usage: apiversa init [directory] | apiversa lock [api-versions] | apiversa doctor [api-versions] | apiversa generate [api-versions] | apiversa check [api-versions] [--format markdown] [--suggest] | apiversa test [api-versions] | apiversa openapi [api-versions] | apiversa changelog [api-versions] [--format json] | apiversa eject [api-versions] [--out dir] | apiversa upgrade-guide --from YYYY-MM-DD [api-versions]\n');
  return 1;
}

function readFile(path: string): string {
  return readFileSync(path, 'utf8');
}

function flag(rest: string[], name: string): string | undefined {
  const index = rest.indexOf(name);
  if (index < 0) return undefined;
  const value = rest[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function positional(rest: string[]): string | undefined {
  const skip = new Set<number>();
  for (const name of ['--format', '--from', '--out', '--version', '--route', '--samples', '--schema', '--to', '--body', '--in', '--direction', '--lang', '--left', '--right']) {
    const index = rest.indexOf(name);
    if (index >= 0) skip.add(index + 1);
  }
  return rest.find((arg, index) => !skip.has(index) && !arg.startsWith('--'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runCli(process.argv);
}
