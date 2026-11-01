export type FetchLike = (input: string, init: { method?: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown> }>;

export type ApiClient = {
  version: string;
  request(path: string, init?: { method?: string; body?: unknown; headers?: Record<string, string> }): Promise<{ status: number; body: unknown }>;
};

/**
 * A small fetch wrapper. It sends the pinned version header and does not depend on React.
 */
export function createClient(options: { baseUrl: string; version: string; header?: string; fetch?: FetchLike }): ApiClient {
  const header = options.header ?? 'Api-Version';
  const call = options.fetch ?? defaultFetch;
  return {
    version: options.version,
    async request(path, init) {
      const response = await call(`${options.baseUrl.replace(/\/$/, '')}${path}`, {
        method: init?.method ?? 'GET',
        headers: { ...(init?.headers ?? {}), [header]: options.version, accept: 'application/json' },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      });
      return { status: response.status, body: await response.json() };
    },
  };
}

const defaultFetch: FetchLike = async (input, init) => {
  const response = await fetch(input, init);
  return { status: response.status, json: () => response.json() as Promise<unknown> };
};
