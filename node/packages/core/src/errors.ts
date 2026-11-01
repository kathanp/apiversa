/** Error codes and the exact client-visible sentences from spec F3. */

export const CODES = [
  'AV-E001',
  'AV-E002',
  'AV-E003',
  'AV-E004',
  'AV-E005',
  'AV-E006',
  'AV-E007',
  'AV-E008',
  'AV-E009',
  'AV-E010',
  'AV-E011',
  'AV-E012',
  'AV-E013',
  'AV-E014',
  'AV-E015',
  'AV-E016',
  'AV-E017',
] as const;

export type ErrorCode = (typeof CODES)[number];

export const MESSAGES: Record<ErrorCode, string> = {
  'AV-E001': 'Change file failed validation.',
  'AV-E002': 'Unknown version.',
  'AV-E003': 'Version date is in the future.',
  'AV-E004': 'Path is deeper than 32 segments.',
  'AV-E005': 'pin-on-first-call requires a pin store.',
  'AV-E006': 'A locked change file was modified.',
  'AV-E007': 'Converter mutated its input.',
  'AV-E008': 'Body is larger than the limit.',
  'AV-E009': 'Array is larger than the limit.',
  'AV-E010': 'Endpoint does not exist in this version.',
  'AV-E011': 'Endpoint has been removed.',
  'AV-E012': 'Version is older than the oldest supported version.',
  'AV-E013': 'A draft change file is present.',
  'AV-E014': 'JSON number cannot be encoded.',
  'AV-E015': 'Duplicate JSON key.',
  'AV-E016': 'Expression could not be read.',
  'AV-E017': 'Parameter target is already set.',
};

export type Direction = 'up' | 'down';
export type When = Direction | 'startup';

export type OutHeader = { name: string; value: string };

const STARTUP: ReadonlySet<ErrorCode> = new Set(['AV-E001', 'AV-E003', 'AV-E005', 'AV-E006', 'AV-E013']);

/** HTTP status for a code. Startup failures have no status. */
export function statusFor(code: ErrorCode, when: When): number | undefined {
  if (when === 'startup' || STARTUP.has(code)) return undefined;
  switch (code) {
    case 'AV-E002':
    case 'AV-E017':
      return 400;
    case 'AV-E004':
    case 'AV-E014':
    case 'AV-E015':
    case 'AV-E016':
      return when === 'down' ? 500 : 400;
    case 'AV-E007':
      return 500;
    case 'AV-E008':
    case 'AV-E009':
      return 413;
    case 'AV-E010':
      return 404;
    case 'AV-E011':
    case 'AV-E012':
      return 410;
    default:
      return undefined;
  }
}

export class ApiversaError extends Error {
  readonly code: ErrorCode;
  readonly status: number | undefined;
  readonly detail: string | undefined;
  readonly supportedVersions: string[];
  readonly headers: OutHeader[];

  constructor(
    code: ErrorCode,
    when: When,
    options?: { detail?: string; supportedVersions?: string[]; headers?: OutHeader[] },
  ) {
    super(MESSAGES[code]);
    this.name = 'ApiversaError';
    this.code = code;
    this.status = statusFor(code, when);
    this.detail = options?.detail;
    this.supportedVersions = options?.supportedVersions ?? [];
    this.headers = options?.headers ?? [];
  }

  /** Client-visible body. `message` is the F3 sentence. */
  envelope(): { error: { code: ErrorCode; message: string; supportedVersions: string[] } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        supportedVersions: this.supportedVersions,
      },
    };
  }
}

export function fail(
  code: ErrorCode,
  when: When,
  detail?: string,
  supportedVersions?: string[],
  headers?: OutHeader[],
): ApiversaError {
  return new ApiversaError(code, when, { detail, supportedVersions, headers });
}
