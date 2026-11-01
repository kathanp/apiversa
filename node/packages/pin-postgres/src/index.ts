export type PgQuery = { text: string; values: unknown[] };

export type PgPinClient = {
  query(text: string, values: unknown[]): Promise<{ rows: { pinned_version?: string }[] }>;
};

/**
 * Pin store over the host's `pg` pool. The host runs the migration.
 * This function does not open a connection of its own.
 */
export function postgresPins(client: PgPinClient, table = 'apiversa_pin'): {
  get(clientId: string): Promise<string | undefined>;
  set(clientId: string, date: string): Promise<void>;
  migration(): string;
} {
  return {
    async get(clientId) {
      const result = await client.query(`select pinned_version from ${table} where client_id = $1`, [clientId]);
      return result.rows[0]?.pinned_version;
    },
    async set(clientId, date) {
      await client.query(
        `insert into ${table} (client_id, pinned_version) values ($1, $2) on conflict (client_id) do update set pinned_version = excluded.pinned_version`,
        [clientId, date],
      );
    },
    migration() {
      return `create table if not exists ${table} (client_id text primary key, pinned_version text not null);`;
    },
  };
}
