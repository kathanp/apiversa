import type { RequestHandler } from 'express';
import { ApiversaError, convertForm, type Apiversa } from 'apiversa';

export type RouteDecl = { body?: string; response?: string };

type VersionedRequest = {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  method: string;
  path: string;
  originalUrl?: string;
  query?: Record<string, unknown>;
  apiversaLegacy?: string;
};

type VersionedResponse = {
  locals: Record<string, unknown>;
  statusCode?: number;
  status(code: number): VersionedResponse;
  setHeader(name: string, value: string): void;
  getHeader?(name: string): unknown;
  json(body: unknown): void;
  send(body: unknown): void;
};

/**
 * Global middleware. It rewrites the method and URL before the router.
 * Only routes that use {@link route} convert the body.
 */
export function apiversa(av: Apiversa): RequestHandler {
  return (req, _res, next) => {
    const request = req as unknown as VersionedRequest;
    try {
      const version = av.resolveVersion({ headers: request.headers, request, path: request.originalUrl ?? request.path });
      const prepared = av.prepare('up', {
        version,
        method: request.method,
        path: request.path,
        query: request.originalUrl?.includes('?') ? request.originalUrl.slice(request.originalUrl.indexOf('?') + 1) : undefined,
      });
      if (prepared.method && prepared.method !== request.method) request.method = prepared.method;
      const query = prepared.query.map((pair) => `${encodeURIComponent(pair.name)}=${encodeURIComponent(pair.value)}`).join('&');
      const nextUrl = `${prepared.path}${query ? `?${query}` : ''}`;
      if (nextUrl !== request.path && (prepared.path !== request.path || query.length > 0)) {
        request.originalUrl = nextUrl;
        (req as { url?: string }).url = nextUrl;
        const grouped: Record<string, string | string[]> = {};
        for (const pair of prepared.query) {
          const existing = grouped[pair.name];
          if (existing === undefined) grouped[pair.name] = pair.value;
          else if (Array.isArray(existing)) existing.push(pair.value);
          else grouped[pair.name] = [existing, pair.value];
        }
        request.query = grouped;
      }
    } catch {
      /* A route that opted in reports version errors. Other routes stay untouched. */
    }
    next();
  };
}

/** Express middleware for one route. A head request does not read or rewrite the body. */
export function route(av: Apiversa, decl: RouteDecl): RequestHandler {
  return (req, res, next) => {
    const request = req as unknown as VersionedRequest;
    const response = res as unknown as VersionedResponse;
    let version: string;
    try {
      const decision = av.resolveDecision({ headers: request.headers, request, path: request.originalUrl ?? request.path });
      version = decision.version;
      for (const header of [...decision.headers, ...av.deprecationHeaders(version), ...av.endpointDeprecationHeaders(version, request.method, request.path)]) response.setHeader(header.name, header.value);
      av.note(version, undefined, { unpinned: decision.source === 'default', endpoint: `${request.method} ${request.path}` });
      const seen = { method: request.method, path: request.path };
      const emptyUp = !decl.body || av.planIsEmpty(version, decl.body, 'up', seen);
      const emptyDown = !decl.response || av.planIsEmpty(version, decl.response, 'down', seen);
      const type = contentType(request.headers);
      const raw = decl.body && !emptyUp && isForm(type) ? rawText(request.body) : undefined;
      if (raw !== undefined && decl.body) {
        const converted = convertForm(av, raw, type, decl.body, version, 'up');
        request.body = type.includes('multipart/form-data') ? converted.body : converted.fields;
      }
      const prepared = av.prepare('up', {
        schema: decl.body,
        body: raw === undefined && decl.body && !emptyUp ? request.body : undefined,
        version,
        method: request.method,
        path: request.path,
        query: request.originalUrl?.includes('?') ? request.originalUrl.slice(request.originalUrl.indexOf('?') + 1) : undefined,
      });
      if (prepared.legacyHandler) request.apiversaLegacy = prepared.legacyHandler;
      if (raw === undefined && decl.body && !emptyUp && request.body !== undefined) request.body = prepared.body;
      if (decl.response && !emptyDown) wrap(av, response, version, decl.response, request);
      next();
    } catch (error) {
      sendError(response, error);
    }
  };
}

function wrap(av: Apiversa, res: VersionedResponse, version: string, schema: string, req: VersionedRequest): void {
  const send = res.send.bind(res);
  const downgrade = (body: unknown, status: number | undefined) => {
    const prepared = av.prepare('down', {
      schema,
      body,
      version,
      method: req.method,
      path: req.path,
      status,
      isError: status !== undefined && status >= 400,
    });
    if (prepared.trace) res.setHeader('Apiversa-Trace', prepared.trace);
    for (const header of prepared.headers) res.setHeader(header.name, header.value);
    return prepared.body;
  };
  const writeJson = (body: unknown) => {
    if (!res.getHeader?.('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    send(JSON.stringify(downgrade(body, res.statusCode)));
  };
  res.json = writeJson;
  res.send = (body: unknown) => {
    if (Buffer.isBuffer(body) || typeof body === 'string') {
      send(body);
      return;
    }
    writeJson(body);
  };
}

function contentType(headers: Record<string, string | string[] | undefined>): string {
  const value = headers['content-type'];
  return typeof value === 'string' ? value : '';
}

function isForm(type: string): boolean {
  return type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data');
}

function rawText(body: unknown): string | undefined {
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  return undefined;
}

function sendError(res: VersionedResponse, error: unknown): void {
  if (error instanceof ApiversaError && error.status) {
    for (const header of error.headers) res.setHeader(header.name, header.value);
    res.status(error.status).json(error.envelope());
    return;
  }
  throw error;
}
