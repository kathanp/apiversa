import type { Apiversa } from 'apiversa';

export type RouteDecl = { body?: string; response?: string };

export type KoaContext = {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  request: { body?: unknown };
  body?: unknown;
  status?: number;
  set(name: string, value: string): void;
};

export type Middleware = (ctx: KoaContext, next: () => Promise<void>) => Promise<void>;

/** Koa middleware ahead of the router. It rewrites method and path. Body conversion stays on {@link route}. */
export function apiversa(av: Apiversa): Middleware {
  return async (ctx, next) => {
    try {
      const version = av.resolveVersion({ headers: ctx.headers, request: ctx, path: ctx.path });
      const prepared = av.prepare('up', { version, method: ctx.method, path: ctx.path });
      if (prepared.method) ctx.method = prepared.method;
      if (prepared.path) ctx.path = prepared.path;
    } catch {
      /* A route that opted in reports version errors. */
    }
    await next();
  };
}

/** Koa middleware for one route. Other routes are untouched. */
export function route(av: Apiversa, decl: RouteDecl): Middleware {
  return async (ctx, next) => {
    const decision = av.resolveDecision({ headers: ctx.headers, request: ctx, path: ctx.path });
    for (const header of [...decision.headers, ...av.deprecationHeaders(decision.version), ...av.endpointDeprecationHeaders(decision.version, ctx.method, ctx.path)]) ctx.set(header.name, header.value);
    av.note(decision.version, undefined, { unpinned: decision.source === 'default', endpoint: `${ctx.method} ${ctx.path}` });
    const seen = { method: ctx.method, path: ctx.path };
    if (decl.body && !av.planIsEmpty(decision.version, decl.body, 'up', seen)) {
      ctx.request.body = av.convertRequest({ schema: decl.body, body: ctx.request.body, version: decision.version, method: ctx.method, path: ctx.path });
    }
    await next();
    if (decl.response && !av.planIsEmpty(decision.version, decl.response, 'down', seen) && ctx.body !== undefined) {
      const prepared = av.prepare('down', { schema: decl.response, body: ctx.body, version: decision.version, method: ctx.method, path: ctx.path });
      ctx.body = prepared.body;
      for (const header of prepared.headers) ctx.set(header.name, header.value);
    }
  };
}
