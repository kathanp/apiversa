import type { Apiversa } from './create.js';
import { ApiversaError } from './errors.js';
import type { HeaderInput } from './resolve/version.js';

export type { HeaderInput };

/**
 * Upgrade a message body from the version header. SQS and RabbitMQ both call this.
 * An unknown date is AV-E002. Any other conversion failure returns no body.
 * The function does not open a socket.
 */
export function messageUpgrade(av: Apiversa, schema: string, body: unknown, headers: HeaderInput): unknown {
  const version = av.resolveVersion({ headers });
  try {
    return av.upgradeEvent(body, schema, version);
  } catch (error) {
    if (error instanceof ApiversaError && error.code !== 'AV-E002') return undefined;
    throw error;
  }
}

/** Downgrade a message body to `version`. An unknown date is AV-E002. Any other failure returns no body. */
export function messageDowngrade(av: Apiversa, schema: string, body: unknown, version: string): unknown {
  try {
    return av.downgradeEvent(body, schema, version);
  } catch (error) {
    if (error instanceof ApiversaError && error.code !== 'AV-E002') return undefined;
    throw error;
  }
}
