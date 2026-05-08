import type { z } from 'zod';
import type schema from './schema';

/**
 * Fully validated runtime configuration. This is intentionally inferred from
 * the Zod schema so the public type cannot drift from validation behavior.
 */
export type Config = z.output<typeof schema>;

/**
 * User-supplied configuration before defaults and environment values are
 * applied.
 */
export type PartialConfig = DeepPartial<z.input<typeof schema>>;

/** Authorization URL parameters after validation and defaults. */
export type AuthorizationParams = Config['authorizationParams'];

/** Session configuration after validation and defaults. */
export type SessionConfig = Config['session'];

/** Login transaction configuration after validation and defaults. */
export type TransactionConfig = Config['transaction'];

/** Session cookie configuration after validation and defaults. */
export type CookieConfig = SessionConfig['cookie'];

type DeepPartial<T> =
  T extends Array<infer Item>
    ? Array<DeepPartial<Item>>
    : T extends object
      ? {
          [Key in keyof T]?: DeepPartial<T[Key]>;
        }
      : T;
