/** Limits from spec CORE-12 and B5. Defaults are not lowered. */

export const MAX_DEPTH = 32;
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
export const DEFAULT_MAX_ARRAY_ITEMS = 10_000;

export type Limits = {
  maxBodyBytes: number;
  maxArrayItems: number;
};

export const DEFAULT_LIMITS: Limits = {
  maxBodyBytes: DEFAULT_MAX_BODY_BYTES,
  maxArrayItems: DEFAULT_MAX_ARRAY_ITEMS,
};
