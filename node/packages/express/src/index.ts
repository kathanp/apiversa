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
 * Global middleware. It does not convert. Only routes that use {@link route} are converted.
 */
export function apiversa(_av: Apiversa): RequestHandler {
  return (_req, _res, next) => {
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
      version = av.resolveVersion({ headers: request.headers, request });
      for (const header of av.deprecationHeaders(version)) response.setHeader(header.name, header.value);
      av.note(version);
      const emptyUp = !decl.body || av.planIsEmpty(version, decl.body, 'up');
      const emptyDown = !decl.response || av.planIsEmpty(version, decl.response, 'down');
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
