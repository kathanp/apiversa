import type { Context, MiddlewareHandler } from 'hono';
import { ApiversaError, type Apiversa } from 'apiversa';

export type RouteDecl = { body?: string; response?: string };

/** Variables set by {@link route}. Handlers read an upgraded JSON body from `apiversaBody`. */
export type ApiversaEnv = { Variables: { apiversaBody?: unknown } };

/**
 * Global middleware. It does not convert. Only routes that use {@link route} are converted.
 * The middleware uses Web `Request` and `Response`, so the same function runs on Node and on Workers.
 */
export function apiversa(_av: Apiversa): MiddlewareHandler {
  return async (_c, next) => {
    await next();
  };
}

/** One Hono route. A head request does not read or rewrite the body. */
export function route(av: Apiversa, decl: RouteDecl): MiddlewareHandler<ApiversaEnv> {
  return async (c, next) => {
    const url = new URL(c.req.url);
    let version: string;
    try {
      const decision = av.resolveDecision({ headers: headerMap(c), request: c.req.raw, path: url.pathname });
      version = decision.version;
      for (const header of [...decision.headers, ...av.deprecationHeaders(version)]) c.header(header.name, header.value);
      av.note(version, undefined, { unpinned: decision.source === 'default', endpoint: `${c.req.method} ${url.pathname}` });
    } catch (error) {
      if (error instanceof ApiversaError) return c.json(error.envelope(), (error.status ?? 500) as 400);
      throw error;
    }
    if (decl.body) await upgrade(av, c, decl.body, version, url);
    await next();
    if (!decl.response || av.planIsEmpty(version, decl.response, 'down')) return;
    await downgrade(av, c, decl.response, version, url);
  };
}

async function upgrade(av: Apiversa, c: Context<ApiversaEnv>, schema: string, version: string, url: URL): Promise<void> {
  const type = c.req.header('content-type') ?? '';
  if (!type.includes('json')) return;
  const raw = (await c.req.json()) as unknown;
  if (av.planIsEmpty(version, schema, 'up')) {
    c.set('apiversaBody', raw);
    return;
  }
  const prepared = av.prepare('up', {
    schema,
    body: raw,
    version,
    method: c.req.method,
    path: url.pathname,
    query: url.search.length > 1 ? url.search.slice(1) : undefined,
  });
  c.set('apiversaBody', prepared.body);
}

async function downgrade(av: Apiversa, c: Context<ApiversaEnv>, schema: string, version: string, url: URL): Promise<void> {
  const type = c.res.headers.get('content-type') ?? '';
  if (!type.includes('json')) return;
  const text = await c.res.clone().text();
  if (text.length === 0) return;
  const body = JSON.parse(text) as unknown;
  const prepared = av.prepare('down', {
    schema,
    body,
    version,
    method: c.req.method,
    path: url.pathname,
    status: c.res.status,
    isError: c.res.status >= 400,
    errorCode: codeOf(body, c.res.status),
  });
  const headers = new Headers(c.res.headers);
  if (prepared.trace) headers.set('Apiversa-Trace', prepared.trace);
  c.res = new Response(JSON.stringify(prepared.body), { status: c.res.status, headers });
}

function headerMap(c: Context): Record<string, string> {
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, name) => {
    headers[name] = value;
  });
  return headers;
}

function codeOf(body: unknown, status: number): string | undefined {
  if (status < 400 || body === null || typeof body !== 'object' || !('code' in body)) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
