import { fail } from '../errors.js';
import type { Change } from '../model.js';

export type RouteDecision = {
  path: string;
  error?: ReturnType<typeof fail>;
  legacyHandler?: string;
};

function matchPath(pattern: string, actual: string): boolean {
  const left = pattern.split('/').filter(Boolean);
  const right = actual.split('/').filter(Boolean);
  if (left.length !== right.length) return false;
  return left.every((part, i) => part.startsWith(':') || part === right[i]);
}

function rewrite(from: string, to: string, actual: string): string {
  const left = from.split('/').filter(Boolean);
  const right = actual.split('/').filter(Boolean);
  const params = new Map<string, string>();
  left.forEach((part, i) => {
    if (part.startsWith(':')) params.set(part.slice(1), right[i] ?? '');
  });
  const prefix = actual.startsWith('/') ? '/' : '';
  return (
    prefix +
    to
      .split('/')
      .filter(Boolean)
      .map((part) => (part.startsWith(':') ? (params.get(part.slice(1)) ?? part) : part))
      .join('/')
  );
}

/**
 * Endpoint visibility is a version gate over every endpoint op, not a body transform.
 * `endpoint.add` hides the route from older clients. `endpoint.remove` hides it from newer ones.
 */
export function decideRoute(changes: Change[], version: string, method: string | undefined, path: string | undefined): RouteDecision {
  if (!method || !path) return { path: path ?? '' };
  let current = path;
  const ordered = [...changes].sort((a, b) => a.version.localeCompare(b.version) || a.id.localeCompare(b.id));
  for (const change of ordered) {
    if (version >= change.version) continue;
    for (const op of change.ops) {
      if (op.op !== 'endpoint.rename' || op.method !== method || !op.from || !op.to) continue;
      if (matchPath(op.from, current)) current = rewrite(op.from, op.to, current);
    }
  }
  for (const change of ordered) {
    for (const op of change.ops) {
      if (op.method !== method || !op.path || !matchPath(op.path, current)) continue;
      if (op.op === 'endpoint.add' && version < change.version) {
        return { path: current, error: fail('AV-E010', 'up') };
      }
      if (op.op === 'endpoint.remove' && version >= change.version) {
        return { path: current, error: fail('AV-E011', 'up') };
      }
      if (op.op === 'endpoint.remove' && version < change.version && op.legacyHandler) {
        return { path: current, legacyHandler: op.legacyHandler };
      }
    }
  }
  return { path: current };
}
