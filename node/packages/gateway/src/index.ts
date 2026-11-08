import { ApiversaError, type Apiversa } from 'apiversa';

export type GatewayRequest = { url: string; method: string; body: string };
export type GatewayResponse = { status: number; body: string };
export type GatewayFetch = (request: GatewayRequest) => Promise<GatewayResponse>;

/** Upgrades the request, calls the host fetch at the host URL, then downgrades the response. */
export function createGateway(options: { apiversa: Apiversa; upstream?: string; upstreams?: Record<string, string>; fetch: GatewayFetch; bundle?: string }): {
  handle(input: { schema: string; headers?: Record<string, string | string[] | undefined>; body: unknown; method?: string }): Promise<GatewayResponse>;
} {
  return {
    async handle(input) {
      const name = options.bundle ?? 'default';
      const url = options.upstreams ? options.upstreams[name] : options.upstream;
      if (!url) throw new ApiversaError('AV-E001', 'startup');
      const av = options.apiversa.bundle ? options.apiversa.bundle(name) : options.apiversa;
      const version = av.resolveVersion({ headers: input.headers });
      const head = av.convertRequest({ schema: input.schema, version, body: input.body, method: input.method });
      const response = await options.fetch({ url, method: input.method ?? 'POST', body: text(head) });
      const down = av.convertResponse({ schema: input.schema, version, body: response.body });
      return { status: response.status, body: text(down) };
    },
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
