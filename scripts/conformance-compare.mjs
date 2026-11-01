import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SHR-03. Run the shared conformance cases in Node and Spring.
 * Nothing is released yet, so both sides are the working tree.
 * A failure in either library exits 1.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const node = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'packages/core/test/conformance.test.ts'], {
  cwd: join(root, 'node'),
  stdio: 'inherit',
});
const spring = spawnSync(maven(), ['-B', '-pl', 'apiversa-core-java', 'test', '-Dtest=ConformanceTest'], {
  cwd: join(root, 'spring'),
  stdio: 'inherit',
});
if ((node.status ?? 1) !== 0 || (spring.status ?? 1) !== 0) {
  process.stderr.write('conformance-compare: a library failed a shared case\n');
  process.exit(1);
}
process.stdout.write('conformance-compare: both libraries passed the shared cases\n');

function maven() {
  if (process.env.MVN) return process.env.MVN;
  const local = join(process.env.HOME ?? '', '.local/apache-maven/bin/mvn');
  return existsSync(local) ? local : 'mvn';
}
