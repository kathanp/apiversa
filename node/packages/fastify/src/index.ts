import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { ApiversaError, type Apiversa } from 'apiversa';

export type RouteDecl = { body?: string; response?: string };

declare module 'fastify' {
  interface FastifyContextConfig {
    apiversa?: RouteDecl;
  }
}

/** Fastify plugin. Routes opt in with `config: { apiversa: route({ response: 'Hotel' }) }`. */
export function apiversa(av: Apiversa): FastifyPluginAsync {
  const versionKey = Symbol('apiversa.version');
  return fp(async (fastify) => {
    fastify.addHook('preValidation', async (req, reply) => {
      const decl = declaration(req);
      if (!decl) return;
      const version = safeVersion(av, req, reply);
      if (!version) return;
      (req as unknown as Record<symbol, string>)[versionKey] = version;
      for (const header of av.deprecationHeaders(version)) reply.header(header.name, header.value);
      av.note(version);
      if (!decl.body || av.planIsEmpty(version, decl.body, 'up')) return;
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
      if (!decl?.response || !version || av.planIsEmpty(version, decl.response, 'down')) return payload;
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

function safeVersion(av: Apiversa, req: FastifyRequest, reply: FastifyReply): string | undefined {
  try {
    return av.resolveVersion({ headers: req.headers as Record<string, string | string[] | undefined>, request: req });
  } catch (error) {
    if (error instanceof ApiversaError && error.status) {
      for (const header of error.headers) reply.header(header.name, header.value);
      reply.status(error.status).send(error.envelope());
      return undefined;
    }
    throw error;
  }
}
