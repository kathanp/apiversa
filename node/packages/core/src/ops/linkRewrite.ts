import type { Direction } from '../errors.js';
import type { RawOp } from '../model.js';
import type { JObject } from '../json/value.js';
import { leaves, writeLeaf } from './edit.js';

/** Rewrite a string field that matches a route pattern. A non-match is left as it is. */
export function linkRewrite(root: JObject, op: RawOp, when: Direction): void {
  const from = when === 'up' ? op.from! : op.to!;
  const to = when === 'up' ? op.to! : op.from!;
  for (const leaf of leaves(root, op.path!, when)) {
    if (!leaf.exists) continue;
    const value = leaf.parent.values.get(leaf.key);
    if (typeof value !== 'string') continue;
    const next = rewriteLink(value, from, to);
    if (next !== value) writeLeaf(leaf, next);
  }
}

/** Rewrite the path of `value` when it matches `from`. The host and query stay. */
export function rewriteLink(value: string, from: string, to: string): string {
  const hash = value.indexOf('#');
  const withQuery = hash === -1 ? value : value.slice(0, hash);
  const fragment = hash === -1 ? '' : value.slice(hash);
  const queryAt = withQuery.indexOf('?');
  const beforeQuery = queryAt === -1 ? withQuery : withQuery.slice(0, queryAt);
  const query = queryAt === -1 ? '' : withQuery.slice(queryAt);
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.exec(beforeQuery);
  let prefix = '';
  let path = beforeQuery;
  if (absolute) {
    const rest = beforeQuery.slice(absolute[0].length);
    const slash = rest.indexOf('/');
    if (slash < 0) return value;
    prefix = beforeQuery.slice(0, absolute[0].length + slash);
    path = rest.slice(slash);
  }
  const rewritten = rewritePath(path, from, to);
  if (rewritten === undefined) return value;
  return `${prefix}${rewritten}${query}${fragment}`;
}

function rewritePath(path: string, from: string, to: string): string | undefined {
  const parts = path.split('/');
  const fromParts = from.split('/');
  if (parts.length !== fromParts.length) return undefined;
  const captured = new Map<string, string>();
  for (let index = 0; index < parts.length; index += 1) {
    const pattern = fromParts[index] ?? '';
    const actual = parts[index] ?? '';
    if (pattern.startsWith(':')) {
      if (actual.length === 0) return undefined;
      captured.set(pattern.slice(1), actual);
    } else if (pattern !== actual) {
      return undefined;
    }
  }
  const toParts = to.split('/');
  const next: string[] = [];
  for (const segment of toParts) {
    if (!segment.startsWith(':')) {
      next.push(segment);
      continue;
    }
    const value = captured.get(segment.slice(1));
    if (value === undefined) return undefined;
    next.push(value);
  }
  return next.join('/');
}
