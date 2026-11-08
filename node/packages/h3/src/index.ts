import { ApiversaError, type Apiversa } from 'apiversa';

export type H3Event = {
  method?: string;
  path?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

/** Upgrade one event, call the host handler once, and downgrade the result. This package does not open a socket. */
export function apiversaH3(
  av: Apiversa,
  schemas: { request: string; response: string },
  handler: (body: unknown, event: H3Event) => unknown | Promise<unknown>,
): (event: H3Event) => Promise<unknown> {
  return async (event) => {
    let version: string;
    try {
      version = av.resolveVersion({ headers: event.headers, path: event.path });
    } catch (error) {
      if (error instanceof ApiversaError) throw error;
      throw error;
    }
    const head = av.convertRequest({ schema: schemas.request, version, body: event.body, method: event.method, path: event.path });
    const result = await handler(head, event);
    return av.convertResponse({ schema: schemas.response, version, body: result });
  };
}
