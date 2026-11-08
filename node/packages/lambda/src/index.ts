import { ApiversaError, type Apiversa } from 'apiversa';

export type LambdaEvent = {
  version?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  rawPath?: string;
  requestContext?: { http?: { method?: string } };
};

export type LambdaResponse = { statusCode: number; headers: Record<string, string>; body: string; isBase64Encoded: false };

/** Upgrade a payload-format 2.0 event, call the host handler once, and downgrade the result. */
export function apiversaHandler(
  av: Apiversa,
  schemas: { request: string; response: string },
  handler: (body: unknown, event: LambdaEvent) => unknown | Promise<unknown>,
): (event: LambdaEvent) => Promise<LambdaResponse> {
  return async (event) => {
    if (event.version !== '2.0') throw new ApiversaError('AV-E022', 'up');
    const raw = event.isBase64Encoded ? decodeBase64(event.body ?? '') : (event.body ?? '');
    const version = av.resolveVersion({ headers: event.headers, path: event.rawPath });
    const head = av.convertRequest({
      schema: schemas.request,
      version,
      body: raw,
      method: event.requestContext?.http?.method,
      path: event.rawPath,
    });
    const result = await handler(head, event);
    const down = av.convertResponse({ schema: schemas.response, version, body: result });
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', ...(versionHeader(event.headers, version)) },
      body: typeof down === 'string' ? down : JSON.stringify(down),
      isBase64Encoded: false,
    };
  };
}

function versionHeader(headers: Record<string, string | undefined> | undefined, version: string): Record<string, string> {
  const name = Object.keys(headers ?? {}).find((key) => key.toLowerCase() === 'api-version') ?? 'api-version';
  return { [name]: version };
}

function decodeBase64(value: string): string {
  if (value.length % 4 !== 0 || !base64Chars(value)) throw new ApiversaError('AV-E022', 'up');
  return Buffer.from(value, 'base64').toString('utf8');
}

function base64Chars(value: string): boolean {
  let pad = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]!;
    const ok = (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch === '+' || ch === '/';
    if (ch === '=') {
      pad += 1;
      if (pad > 2 || i < value.length - 2) return false;
      continue;
    }
    if (pad > 0 || !ok) return false;
  }
  return true;
}
