import { ApiversaError, type Direction } from '../errors.js';
import { isArray, type JValue } from '../json/value.js';
import { fromPlain, parseJson, toPlain, type Registry } from '../json/parse.js';
import type { Limits } from '../limits.js';
import type { Bundle } from '../bundle/load.js';
import { planFor, type Planned } from '../bundle/load.js';
import type { HeaderPair, QueryPair } from '../model.js';
import { applyData } from '../ops/apply.js';
import { decideRoute, pathParams } from '../ops/endpoint.js';
import { headerAdd, headerRemove } from '../ops/headerChange.js';
import { headerRename } from '../ops/headerRename.js';
import { queryAdd } from '../ops/queryAdd.js';
import { queryRemove } from '../ops/queryRemove.js';
import { unwrapEnvelope } from '../ops/envelope.js';
import { moveParam } from '../ops/paramMove.js';
import { applyPrefix } from '../ops/prefix.js';
import { queryRename } from '../ops/queryRename.js';
import { statusChange } from '../ops/statusChange.js';

export type ExecuteInput = {
  schema?: string;
  version: string;
  body?: unknown;
  method?: string;
  path?: string;
  query?: QueryPair[];
  headers?: HeaderPair[];
  status?: number;
  isError?: boolean;
  errorCode?: string;
  development?: boolean;
  trace?: boolean;
  onConvert?: (event: { change: string; direction: Direction; ms: number }) => void;
};

export type ExecuteResult = {
  body: unknown;
  path: string;
  method?: string;
  query: QueryPair[];
  headers: HeaderPair[];
  status?: number;
  legacyHandler?: string;
  trace?: string;
  parsed: boolean;
};

export function execute(bundle: Bundle, input: ExecuteInput, direction: Direction): ExecuteResult {
  const route = direction === 'up' ? decideRoute(bundle.changes, input.version, input.method, input.path) : { path: input.path ?? '', method: input.method };
  if (route.error) {
    route.error.supportedVersions.splice(0, route.error.supportedVersions.length, ...bundle.dates);
    throw route.error;
  }
  const steps = planFor(bundle, input.version, direction, { method: input.method, path: input.path }).filter((step) => step.op.op !== 'error.shape' || direction === 'down');
  const bodySteps = steps.filter((step) => isBodyStep(step, input, direction));
  let query = input.query ? input.query.map((pair) => ({ ...pair })) : [];
  let headers = input.headers ? input.headers.map((pair) => ({ ...pair })) : [];
  let status = input.status;
  let body = input.body;
  let parsed = false;
  let pathNow = route.path;
  const methodNow = route.method ?? input.method;
  let currentJson: JValue | undefined;
  const applyMove = (step: Planned, json: JValue | undefined): JValue | undefined => {
    const needsBody = `${step.op.from ?? ''}${step.op.to ?? ''}`.includes('body:');
    let next = json;
    if (needsBody && next === undefined && body !== undefined) {
      next = adopt(body, direction, bundle.limits);
      parsed = true;
    }
    const moved = moveParam({
      op: step.op,
      method: input.method,
      rewrittenMethod: methodNow,
      originalPath: input.path ?? '',
      path: pathNow,
      query,
      headers,
      body: next,
      changes: bundle.changes,
    });
    pathNow = moved.path;
    query = moved.query;
    headers = moved.headers;
    if (moved.body !== undefined) {
      body = materialize(moved.body, input.schema, bundle.registry);
      return moved.body;
    }
    return next;
  };
  if (bodySteps.length === 0 && steps.every((step) => !isMeta(step.op))) {
    return finish(bundle, input, direction, steps, { body, path: pathNow, method: methodNow, query, headers, status, legacyHandler: route.legacyHandler, parsed });
  }
  if (bodySteps.length > 0 && body !== undefined) {
    let json;
    try {
      json = adopt(body, direction, bundle.limits);
    } catch (error) {
      if (error instanceof ApiversaError && error.code === 'AV-E008' && bundle.oversize === 'passthrough' && direction === 'down') {
        console.warn('apiversa: oversized body passed through as the head shape');
        return finish(bundle, input, direction, steps, { body, path: pathNow, method: methodNow, query, headers, status, legacyHandler: route.legacyHandler, parsed: false });
      }
      throw error;
    }
    parsed = true;
    let current = json;
    for (const step of steps) {
      if (step.op.op === 'response.envelope' || step.op.op === 'value.prefix') {
        touch(input, step, direction, () => {
          applyRouteOp(step, input, direction, bundle, () => current, (next) => {
            current = next;
          }, {
            get path() { return pathNow; },
            set path(value) { pathNow = value; },
            get query() { return query; },
            set query(value) { query = value; },
            get headers() { return headers; },
            set headers(value) { headers = value; },
          });
        });
      } else if (isBodyOp(step.op) && appliesTo(bundle.registry, input.schema, step.op.schema)) {
        if (step.op.op === 'error.shape') {
          if (input.isError || (status !== undefined && status >= 400)) {
            touch(input, step, direction, () => {
              current = applyData(current, input.schema, step.op, context(bundle, direction, input, status, step), 0);
            });
          }
        } else if (!input.isError && !(status !== undefined && status >= 400 && direction === 'down')) {
          touch(input, step, direction, () => {
            current = applyData(current, input.schema, step.op, context(bundle, direction, input, status, step), 0);
          });
        }
      } else if (step.op.op.startsWith('query.')) {
        touch(input, step, direction, () => {
          query = applyQuery(query, step.op, direction);
        });
      } else if (step.op.op.startsWith('header.')) {
        touch(input, step, direction, () => {
          headers = applyHeader(headers, step.op, direction);
        });
      } else if (step.op.op === 'status.change') {
        touch(input, step, direction, () => {
          status = statusChange(status, step.op, direction);
        });
      } else if (step.op.op === 'param.move') {
        touch(input, step, direction, () => {
          current = applyMove(step, current) ?? current;
        });
      }
    }
    body = materialize(current, input.schema, bundle.registry);
  } else {
    for (const step of steps) {
      if (step.op.op.startsWith('query.')) {
        touch(input, step, direction, () => {
          query = applyQuery(query, step.op, direction);
        });
      } else if (step.op.op.startsWith('header.')) {
        touch(input, step, direction, () => {
          headers = applyHeader(headers, step.op, direction);
        });
      } else if (step.op.op === 'status.change') {
        touch(input, step, direction, () => {
          status = statusChange(status, step.op, direction);
        });
      } else if (step.op.op === 'param.move') {
        touch(input, step, direction, () => {
          currentJson = applyMove(step, currentJson);
        });
      } else if (step.op.op === 'value.prefix' || step.op.op === 'response.envelope') {
        touch(input, step, direction, () => {
          applyRouteOp(step, input, direction, bundle, () => currentJson, (next) => {
            currentJson = next;
          }, {
            get path() { return pathNow; },
            set path(value) { pathNow = value; },
            get query() { return query; },
            set query(value) { query = value; },
            get headers() { return headers; },
            set headers(value) { headers = value; },
          });
        });
      }
    }
  }
  return finish(bundle, input, direction, steps, { body, path: pathNow, method: methodNow, query, headers, status, legacyHandler: route.legacyHandler, parsed });
}

function finish(
  bundle: Bundle,
  input: ExecuteInput,
  direction: Direction,
  steps: Planned[],
  result: ExecuteResult,
): ExecuteResult {
  const traceOn = input.trace === true;
  if (!traceOn) return result;
  const ids: string[] = [];
  for (const step of steps) {
    const label = `${step.version}.${step.id}`;
    if (!ids.includes(label)) ids.push(label);
  }
  if (direction === 'down') {
    /* steps are already reversed; trace lists them in application order */
  }
  return { ...result, trace: ids.join(', ') || undefined };
}

function context(bundle: Bundle, direction: Direction, input: ExecuteInput, status: number | undefined, step?: Planned) {
  return {
    when: direction,
    converters: bundle.converters,
    registry: bundle.registry,
    development: input.development === true,
    status,
    errorCode: input.errorCode,
    change: step ? `${step.version}.${step.id}` : undefined,
  };
}

function materialize(value: import('../json/value.js').JValue, schema: string | undefined, registry: Registry): unknown {
  if (isArray(value)) return value.items.map((item) => toPlain(item, schema, registry));
  return toPlain(value, schema, registry);
}

function adopt(body: unknown, direction: Direction, limits: Limits) {
  if (typeof body === 'string') return parseJson(body, { when: direction, limits });
  if (Buffer.isBuffer(body)) return parseJson(body.toString('utf8'), { when: direction, limits });
  return fromPlain(body, direction, limits);
}

export function bodyPlanEmpty(bundle: Bundle, version: string, schema: string | undefined, direction: Direction, route?: { method?: string; path?: string }): boolean {
  return !planFor(bundle, version, direction, route).some(
    (step) => isBodyOp(step.op) && step.op.op !== 'error.shape' && appliesTo(bundle.registry, schema, step.op.schema),
  );
}

function isBodyOp(op: Planned['op']): boolean {
  if (op.op === 'field.deprecate') return false;
  if (op.op === 'response.envelope') return true;
  if (op.op === 'value.prefix') return (op.target ?? '').startsWith('body:');
  return op.op.startsWith('field.') || op.op.startsWith('enum.') || op.op === 'object.wrap' || op.op === 'custom' || op.op === 'error.shape' || op.op === 'link.rewrite';
}

function isMeta(op: Planned['op']): boolean {
  if (op.op === 'value.prefix') return !(op.target ?? '').startsWith('body:');
  return op.op.startsWith('query.') || op.op.startsWith('header.') || op.op === 'status.change' || op.op === 'param.move';
}

function applyRouteOp(
  step: Planned,
  input: ExecuteInput,
  direction: Direction,
  bundle: Bundle,
  read: () => JValue | undefined,
  write: (value: JValue) => void,
  state: { path: string; query: ExecuteResult['query']; headers: ExecuteResult['headers'] },
): void {
  if (step.op.op === 'response.envelope') {
    if (direction !== 'down' || !envelopeMatches(step.op, input.method, input.path)) return;
    const body = read();
    if (body === undefined) return;
    write(unwrapEnvelope(body, step.op, state.headers));
    return;
  }
  const next = { path: state.path, query: state.query, body: read() };
  applyPrefix(next, step.op, direction, bundle.changes);
  state.path = next.path;
  state.query = next.query;
  if (next.body !== undefined) write(next.body);
}

function envelopeMatches(op: Planned['op'], method: string | undefined, path: string | undefined): boolean {
  if (!op.method || !op.path || !method || !path) return false;
  return op.method === method && pathParams(op.path, path) !== undefined;
}

function applyHeader(headers: HeaderPair[], op: Planned['op'], direction: Direction): HeaderPair[] {
  if (op.op === 'header.add') return headerAdd(headers, op, direction);
  if (op.op === 'header.remove') return headerRemove(headers, op, direction);
  if (op.op === 'header.rename') return headerRename(headers, op, direction);
  return headers;
}

function touch(input: ExecuteInput, step: Planned, direction: Direction, run: () => void): void {
  if (!input.onConvert) {
    run();
    return;
  }
  const start = performance.now();
  run();
  input.onConvert({ change: `${step.version}.${step.id}`, direction, ms: performance.now() - start });
}

function isBodyStep(step: Planned, input: ExecuteInput, direction: Direction): boolean {
  if (!isBodyOp(step.op)) return false;
  if (step.op.op === 'error.shape') return direction === 'down' && (input.isError === true || (input.status !== undefined && input.status >= 400));
  if (input.isError || (direction === 'down' && input.status !== undefined && input.status >= 400)) return false;
  return true;
}

function appliesTo(registry: Registry, root: string | undefined, schema: string | undefined): boolean {
  if (!schema) return true;
  if (!root) return false;
  return mentions(registry, root, schema);
}

function mentions(registry: Registry, root: string, target: string, seen = new Set<string>()): boolean {
  if (root === target) return true;
  if (seen.has(root)) return false;
  seen.add(root);
  const disc = registry[root]?.discriminator;
  if (disc && Object.values(disc.mapping).includes(target)) return true;
  const fields = registry[root]?.fields;
  if (!fields) return false;
  return fields.some((field) => (field.schema && mentions(registry, field.schema, target, seen)) || (field.items && mentions(registry, field.items, target, seen)));
}

function applyQuery(query: QueryPair[], op: Planned['op'], direction: Direction): QueryPair[] {
  if (op.op === 'query.rename') return queryRename(query, op, direction);
  if (op.op === 'query.add') return queryAdd(query, op, direction);
  if (op.op === 'query.remove') return queryRemove(query, op, direction);
  return query;
}
