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
    if (decl.body && !av.planIsEmpty(version, decl.body, 'up')) {
      body = av.convertRequest({ schema: decl.body, body: await request.json(), version, path: url.pathname });
    }
    const next = new Request(request.url, { method: request.method, headers: request.headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const response = await handler(next);
    const headers = new Headers(response.headers);
    for (const header of [...decision.headers, ...av.deprecationHeaders(version)]) headers.set(header.name, header.value);
    if (!decl.response || av.planIsEmpty(version, decl.response, 'down')) return new Response(response.body, { status: response.status, headers });
    const downgraded = av.convertResponse({ schema: decl.response, body: await response.json(), version });
    return new Response(JSON.stringify(downgraded), { status: response.status, headers });
  };
}

function headerMap(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}
