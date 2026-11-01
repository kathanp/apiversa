import { fail } from '../errors.js';
import type { Change } from '../model.js';

export type RouteDecision = {
  path: string;
  method?: string;
  error?: ReturnType<typeof fail>;
  legacyHandler?: string;
};

/** Captured `:param` values, or undefined when the path does not match the pattern. */
export function pathParams(pattern: string, actual: string): Record<string, string> | undefined {
  const left = pattern.split('/').filter(Boolean);
  const right = actual.split('/').filter(Boolean);
  if (left.length !== right.length) return undefined;
  const params: Record<string, string> = {};
  for (let i = 0; i < left.length; i++) {
    const part = left[i] ?? '';
    const value = right[i] ?? '';
    if (part.startsWith(':')) params[part.slice(1)] = value;
    else if (part !== value) return undefined;
  }
  return params;
}

function matchPath(pattern: string, actual: string): boolean {
  return pathParams(pattern, actual) !== undefined;
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
  if (!method || !path) return { path: path ?? '', method };
  let current = path;
  let methodNow = method;
  const ordered = [...changes].sort((a, b) => a.version.localeCompare(b.version) || a.id.localeCompare(b.id));
  for (const change of ordered) {
    if (version >= change.version) continue;
    for (const op of change.ops) {
      if (op.op !== 'endpoint.method' || !op.path || !op.from || !op.to) continue;
      if (methodNow === op.from && matchPath(op.path, current)) methodNow = op.to;
    }
    for (const op of change.ops) {
      if (op.op !== 'endpoint.rename' || !op.from || !op.to) continue;
      if (op.method !== methodNow && op.method !== method) continue;
      if (matchPath(op.from, current)) current = rewrite(op.from, op.to, current);
    }
  }
  for (const change of ordered) {
    for (const op of change.ops) {
      if ((op.method !== methodNow && op.method !== method) || !op.path || !matchPath(op.path, current)) continue;
      if (op.op === 'endpoint.add' && version < change.version) {
        return { path: current, method: methodNow, error: fail('AV-E010', 'up') };
      }
      if (op.op === 'endpoint.remove' && version >= change.version) {
        return { path: current, method: methodNow, error: fail('AV-E011', 'up') };
      }
      if (op.op === 'endpoint.remove' && version < change.version && op.legacyHandler) {
        return { path: current, method: methodNow, legacyHandler: op.legacyHandler };
      }
    }
  }
  return { path: current, method: methodNow };
}
