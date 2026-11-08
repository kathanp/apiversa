import { messageDowngrade, messageUpgrade, type Apiversa } from 'apiversa';

type Headers = Record<string, string | string[] | undefined>;

/** SQS adapter. The host supplies the client. This module does not open a socket. */
export function sqs(av: Apiversa, schema: string): {
  upgrade(body: unknown, headers: Headers): unknown;
  downgrade(body: unknown, version: string): unknown;
} {
  return {
    upgrade(body, headers) {
      return messageUpgrade(av, schema, body, headers);
    },
    downgrade(body, version) {
      return messageDowngrade(av, schema, body, version);
    },
  };
}
