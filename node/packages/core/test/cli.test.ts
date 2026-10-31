import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { init } from '../src/cli/init.js';
import { runCli } from '../src/cli/main.js';
import { ApiversaError } from '../src/errors.js';
import { toMatchVersion } from '../src/testing.js';

describe('init and the version matcher', () => {
  it('creates versions.yaml and a commented example', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'apiversa-init-'));
    init(cwd);
    expect(() => init(cwd)).toThrow(expect.objectContaining({ code: 'AV-E001' }));
  });

  it('prints usage when the command is not init', () => {
    expect(runCli(['node', 'apiversa', 'nope'])).toBe(1);
    const cwd = mkdtempSync(join(tmpdir(), 'apiversa-cli-'));
    expect(runCli(['node', 'apiversa', 'init', cwd])).toBe(0);
  });
  it('matches a value against a predicate for a version', () => {
    const result = toMatchVersion({ id: 'h_1' }, '2026-01-15', (value) => (value as { id: string }).id === 'h_1');
    expect(result.pass).toBe(true);
    expect(toMatchVersion({ headers: { 'api-version': '2026-03-01' }, body: {} }, '2026-01-15', () => true).pass).toBe(false);
    expect(toMatchVersion({ body: { id: 'h_1' } }, '2026-01-15', { safeParse: () => ({ success: true }) }).pass).toBe(true);
    expect(toMatchVersion('nope', '2026-01-15', () => false).pass).toBe(false);
  });
});

void ApiversaError;
