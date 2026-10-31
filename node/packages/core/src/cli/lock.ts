import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail } from '../errors.js';

/** SHA-256 of every change file. `versions.yaml` is not a change file. */
export function lockFiles(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of changeNames(dir)) files[name] = sha256(readFileSync(join(dir, name)));
  writeFileSync(join(dir, '.lock.json'), `${JSON.stringify({ files })}\n`);
  return files;
}

/**
 * In production, a lock that does not match the change files on disk is AV-E006.
 * Development ignores the lock so a draft edit can still boot.
 */
export function assertReleasedLock(dir: string): void {
  if (process.env.NODE_ENV !== 'production') return;
  const problems = lockProblems(dir);
  if (problems.length > 0) throw fail('AV-E006', 'startup', problems[0]);
}

/** Names of locked files whose bytes no longer match. Empty when there is no lock. */
export function lockProblems(dir: string): string[] {
  const lockPath = join(dir, '.lock.json');
  if (!existsSync(lockPath)) return [];
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as { files?: Record<string, string> };
  const files = lock.files ?? {};
  const present = changeNames(dir);
  const names = [...new Set([...Object.keys(files), ...present])].sort();
  const problems: string[] = [];
  for (const name of names) {
    const file = join(dir, name);
    const actual = existsSync(file) ? sha256(readFileSync(file)) : '';
    if (files[name] !== actual) problems.push(name);
  }
  return problems;
}

function changeNames(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') && name !== 'versions.yaml')
    .sort();
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
