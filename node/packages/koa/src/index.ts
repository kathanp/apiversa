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

/** Koa middleware for one route. Other routes are untouched. */
export function route(av: Apiversa, decl: RouteDecl): Middleware {
  return async (ctx, next) => {
    const decision = av.resolveDecision({ headers: ctx.headers, request: ctx, path: ctx.path });
    for (const header of [...decision.headers, ...av.deprecationHeaders(decision.version)]) ctx.set(header.name, header.value);
    av.note(decision.version, undefined, { unpinned: decision.source === 'default', endpoint: `${ctx.method} ${ctx.path}` });
    if (decl.body && !av.planIsEmpty(decision.version, decl.body, 'up')) {
      ctx.request.body = av.convertRequest({ schema: decl.body, body: ctx.request.body, version: decision.version, path: ctx.path });
    }
    await next();
    if (decl.response && !av.planIsEmpty(decision.version, decl.response, 'down') && ctx.body !== undefined) {
      ctx.body = av.convertResponse({ schema: decl.response, body: ctx.body, version: decision.version });
    }
  };
}
