import { fail, type Direction } from '../errors.js';
import type { RawOp } from '../model.js';
import { pathParams } from './endpoint.js';

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/** Reject a route pattern that is not `METHOD /path` with `:param` segments. */
export function checkScope(op: RawOp): void {
  if (!op.scope) return;
  const kind = op.op;
  if (!(kind.startsWith('field.') || kind.startsWith('enum.') || kind === 'object.wrap')) {
    throw fail('AV-E001', 'startup', 'scope is only valid on a field, enum, or object op');
  }
  if (op.scope.on && op.scope.on !== 'request' && op.scope.on !== 'response') {
    throw fail('AV-E001', 'startup', 'scope.on must be request or response');
  }
  for (const route of op.scope.routes ?? []) checkRoute(route);
}

export function checkRoute(route: string): void {
  const space = route.indexOf(' ');
  const method = space < 0 ? '' : route.slice(0, space);
  const path = space < 0 ? '' : route.slice(space + 1);
  if (!METHODS.has(method) || !path.startsWith('/') || path.includes('*') || path.includes('{') || path.includes(' ')) {
    throw fail('AV-E001', 'startup', `unknown route pattern ${route}`);
  }
}

/** `on` is the plan direction. A routes list matches only a concrete request, never an event. */
export function scopeAllows(op: RawOp, direction: Direction, route: { method?: string; path?: string } | undefined): boolean {
  if (op.scope?.on === 'request' && direction !== 'up') return false;
  if (op.scope?.on === 'response' && direction !== 'down') return false;
  const routes = op.scope?.routes;
  if (!routes || routes.length === 0) return true;
  if (!route?.method || !route.path) return false;
  return routes.some((pattern) => {
    const space = pattern.indexOf(' ');
    return pattern.slice(0, space) === route.method && pathParams(pattern.slice(space + 1), route.path!) !== undefined;
  });
}
