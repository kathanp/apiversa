import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { ApiversaError, type Apiversa } from 'apiversa';

export type RouteDecl = { body?: string; response?: string };

declare module 'fastify' {
  interface FastifyContextConfig {
    apiversa?: RouteDecl;
    apiversaShim?: boolean;
  }
}

/** Fastify plugin. Routes opt in with `config: { apiversa: route({ response: 'Hotel' }) }`. */
export function apiversa(av: Apiversa): FastifyPluginAsync {
  const versionKey = Symbol('apiversa.version');
  return fp(async (fastify) => {
    fastify.addHook('onRoute', (opts) => {
      if (!opts.config?.apiversa || opts.config.apiversaShim || !opts.handler) return;
      const head = Array.isArray(opts.method) ? opts.method[0] : opts.method;
      if (!head) return;
      for (const from of av.methodShims(String(head), opts.url)) {
        fastify.route({
          method: from as 'GET',
          url: opts.url,
          config: { apiversa: opts.config.apiversa, apiversaShim: true },
          handler: async (req, reply) => {
            const decision = av.resolveDecision({ headers: req.headers as Record<string, string | string[] | undefined>, path: req.url });
            const prepared = av.prepare('up', { version: decision.version, method: req.method, path: req.url.split('?')[0] });
            if (!prepared.method || prepared.method === req.method) {
              reply.callNotFound();
              return;
            }
            Object.defineProperty(req, 'method', { value: prepared.method });
            return opts.handler!.call(fastify, req, reply);
          },
        });
      }
    });
    fastify.addHook('preValidation', async (req, reply) => {
      const decl = declaration(req);
      if (!decl) return;
      const decision = safeVersion(av, req, reply);
      if (!decision) return;
      const version = decision.version;
      (req as unknown as Record<symbol, string>)[versionKey] = version;
      for (const header of [...decision.headers, ...av.deprecationHeaders(version), ...av.endpointDeprecationHeaders(version, req.method, req.url.split('?')[0])]) reply.header(header.name, header.value);
      av.note(version, undefined, { unpinned: decision.source === 'default', endpoint: `${req.method} ${req.url.split('?')[0]}` });
      const seen = { method: req.method, path: req.url.split('?')[0] };
      if (!decl.body || av.planIsEmpty(version, decl.body, 'up', seen)) return;
      const prepared = av.prepare('up', {
        schema: decl.body,
        body: req.body,
        version,
        method: req.method,
        path: req.url.split('?')[0],
        query: req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : undefined,
      });
      req.body = prepared.body;
    });
    fastify.addHook('onSend', async (req, reply, payload) => {
      const decl = declaration(req);
      const version = (req as unknown as Record<symbol, string | undefined>)[versionKey];
      const seen = { method: req.method, path: req.url.split('?')[0] };
      if (!decl?.response || !version || av.planIsEmpty(version, decl.response, 'down', seen)) return payload;
      if (typeof payload !== 'string' || payload === '') return payload;
      const prepared = av.prepare('down', {
        schema: decl.response,
        body: payload,
        version,
        method: req.method,
        path: req.url.split('?')[0],
        status: reply.statusCode,
        isError: reply.statusCode >= 400,
      });
      if (prepared.trace) reply.header('Apiversa-Trace', prepared.trace);
      for (const header of prepared.headers) reply.header(header.name, header.value);
      return JSON.stringify(prepared.body);
    });
  }, { name: '@apiversa/fastify', fastify: '5.x' });
}

/** Route config for a Fastify route that should be converted. */
export function route(decl: RouteDecl): { apiversa: RouteDecl } {
  return { apiversa: decl };
}

function declaration(req: FastifyRequest): RouteDecl | undefined {
  return req.routeOptions.config?.apiversa;
}

function safeVersion(av: Apiversa, req: FastifyRequest, reply: FastifyReply): ReturnType<Apiversa['resolveDecision']> | undefined {
  try {
    return av.resolveDecision({ headers: req.headers as Record<string, string | string[] | undefined>, request: req, path: req.url });
  } catch (error) {
    if (error instanceof ApiversaError && error.status) {
      for (const header of error.headers) reply.header(header.name, header.value);
      reply.status(error.status).send(error.envelope());
      return undefined;
    }
    throw error;
  }
}
