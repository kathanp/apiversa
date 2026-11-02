import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const nodeRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const nest10 = join(nodeRoot, '../nest10-check');

describe('FW-03', () => {
  it('FW-03 runs the Nest 10 Express and Fastify suite', () => {
    if (!existsSync(join(nest10, 'node_modules/@nestjs/common/package.json'))) {
      execFileSync('npm', ['install', '--ignore-scripts'], { cwd: nest10, stdio: 'inherit' });
    }
    execFileSync('npx', ['vitest', 'run', '--config', join(nodeRoot, 'nest10-check/vitest.config.ts')], { cwd: nodeRoot, stdio: 'inherit' });
    expect(existsSync(join(nest10, 'node_modules/@nestjs/common/package.json'))).toBe(true);
  });
});
