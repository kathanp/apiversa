export type RedisPinClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
};

/** Pin store over the host's Redis client. Methods are async because the server is remote. Nothing is sent except the host's own client. */
export function redisPins(client: RedisPinClient, prefix = 'apiversa:pin:'): {
  get(clientId: string): Promise<string | undefined>;
  set(clientId: string, date: string): Promise<void>;
} {
  return {
    async get(clientId) {
      const value = await client.get(`${prefix}${clientId}`);
      return value === null ? undefined : value;
    },
    async set(clientId, date) {
      await client.set(`${prefix}${clientId}`, date);
    },
  };
}
