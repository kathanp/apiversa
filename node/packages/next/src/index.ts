import type { Apiversa } from 'apiversa';

export type RouteDecl = { body?: string; response?: string };

type Handler = (request: Request) => Promise<Response> | Response;

/**
 * Wrap one App Router handler. Only this handler is converted.
 * A head request does not parse the body.
 */
export function route(av: Apiversa, decl: RouteDecl, handler: Handler): Handler {
  return async (request) => {
    const url = new URL(request.url);
    const decision = av.resolveDecision({ headers: headerMap(request), request, path: url.pathname });
    const version = decision.version;
    let body: unknown = undefined;
    const seen = { method: request.method, path: url.pathname };
    if (decl.body && !av.planIsEmpty(version, decl.body, 'up', seen)) {
      body = av.convertRequest({ schema: decl.body, body: await request.json(), version, path: url.pathname });
    }
    const prepared = av.prepare('up', { version, method: request.method, path: url.pathname, query: url.search ? url.search.slice(1) : undefined });
    const nextUrl = new URL(request.url);
    if (prepared.path) nextUrl.pathname = prepared.path;
    if (prepared.query.length > 0) nextUrl.search = prepared.query.map((pair) => `${encodeURIComponent(pair.name)}=${encodeURIComponent(pair.value)}`).join('&');
    const method = prepared.method ?? request.method;
    const next = new Request(nextUrl, { method, headers: request.headers, body: body === undefined || method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body) });
    const response = await handler(next);
    const headers = new Headers(response.headers);
    for (const header of [...decision.headers, ...av.deprecationHeaders(version), ...av.endpointDeprecationHeaders(version, method, nextUrl.pathname)]) headers.set(header.name, header.value);
    if (!decl.response || av.planIsEmpty(version, decl.response, 'down', { method, path: nextUrl.pathname })) return new Response(response.body, { status: response.status, headers });
    const downgraded = av.prepare('down', { schema: decl.response, body: await response.json(), version, method, path: nextUrl.pathname });
    for (const header of downgraded.headers) headers.set(header.name, header.value);
    return new Response(JSON.stringify(downgraded.body), { status: response.status, headers });
  };
}

function headerMap(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}
