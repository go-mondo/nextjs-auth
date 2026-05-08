import schema from './schema';
import type {
  Config,
  CookieConfig,
  PartialConfig,
  SessionConfig,
  TransactionConfig,
} from './types';
import { bool, num } from './utils';

export class MondoAuthConfigError extends Error {
  /**
   * @param message - Human-readable validation summary.
   */
  constructor(message: string) {
    super(message);
    this.name = 'MondoAuthConfigError';
  }
}

/**
 * Reads configuration from environment variables and explicit overrides, then
 * validates the merged result with the Zod schema.
 *
 * ### Required
 *
 * - `MONDO_SECRET`: See {@link Config.secret}.
 * - `MONDO_ISSUER_BASE_URL`: See {@link Config.issuerBaseURL}.
 * - `MONDO_BASE_URL`: See {@link Config.baseURL}.
 * - `MONDO_CLIENT_ID`: See {@link Config.clientId}.
 * - `MONDO_CLIENT_SECRET`: See {@link Config.clientSecret}.
 *
 * ### Optional
 *
 * - `NEXT_PUBLIC_MONDO_LOGIN`: See {@link Config.routes}.
 * - `MONDO_CALLBACK`: See {@link Config.routes}.
 * - `MONDO_POST_LOGOUT_REDIRECT`: See {@link Config.routes}.
 * - `MONDO_AUDIENCE`: See {@link Config.authorizationParams}.
 * - `MONDO_SCOPE`: See {@link Config.authorizationParams}.
 * - `MONDO_SESSION_NAME`: See {@link SessionConfig.name}.
 * - `MONDO_SESSION_DURATION`: See {@link SessionConfig.duration}.
 * - `MONDO_SESSION_COOKIE_DOMAIN`: See {@link CookieConfig.domain}.
 * - `MONDO_SESSION_COOKIE_PATH`: See {@link CookieConfig.path}.
 * - `MONDO_SESSION_COOKIE_SECURE`: See {@link CookieConfig.secure}.
 * - `MONDO_SESSION_COOKIE_SAME_SITE`: See {@link CookieConfig.sameSite}.
 *
 * - `MONDO_TRANSACTION_NAME` See {@link TransactionConfig.name}.
 * - `MONDO_TRANSACTION_COOKIE_DOMAIN` See {@link CookieConfig.domain}.
 * - `MONDO_TRANSACTION_COOKIE_PATH` See {@link CookieConfig.path}.
 * - `MONDO_TRANSACTION_COOKIE_SECURE` See {@link CookieConfig.secure}.
 * - `MONDO_TRANSACTION_COOKIE_SAME_SITE` See {@link CookieConfig.sameSite}.
 *
 * @param params - Optional explicit configuration overrides.
 * @throws {@link MondoAuthConfigError} when required values are missing or
 * invalid.
 */
export const getConfig = (params: PartialConfig = {}): Config => {
  const MONDO_SECRET = process.env.MONDO_SECRET;
  const MONDO_ISSUER_BASE_URL = process.env.MONDO_ISSUER_BASE_URL;
  const MONDO_BASE_URL =
    process.env.MONDO_BASE_URL || process.env.NEXT_PUBLIC_MONDO_BASE_URL;
  const MONDO_CLIENT_ID = process.env.MONDO_CLIENT_ID;
  const MONDO_CLIENT_SECRET = process.env.MONDO_CLIENT_SECRET;
  const MONDO_AUDIENCE = process.env.MONDO_AUDIENCE;
  const MONDO_SCOPE = process.env.MONDO_SCOPE;

  const MONDO_CALLBACK = process.env.MONDO_CALLBACK;
  const MONDO_LOGOUT = process.env.MONDO_LOGOUT;
  const MONDO_SESSION = process.env.MONDO_SESSION;
  const MONDO_ACCESS_TOKEN = process.env.MONDO_ACCESS_TOKEN;
  const MONDO_POST_LOGOUT_REDIRECT = process.env.MONDO_POST_LOGOUT_REDIRECT;

  const MONDO_SESSION_NAME = process.env.MONDO_SESSION_NAME;
  const MONDO_SESSION_DURATION = process.env.MONDO_SESSION_DURATION;
  const MONDO_SESSION_COOKIE_DOMAIN = process.env.MONDO_COOKIE_DOMAIN;
  const MONDO_SESSION_COOKIE_PATH = process.env.MONDO_COOKIE_PATH;
  const MONDO_SESSION_COOKIE_SECURE = process.env.MONDO_COOKIE_SECURE;
  const MONDO_SESSION_COOKIE_SAME_SITE = process.env.MONDO_COOKIE_SAME_SITE;

  const MONDO_TRANSACTION_NAME = process.env.MONDO_TRANSACTION_COOKIE_NAME;
  const MONDO_TRANSACTION_COOKIE_DOMAIN =
    process.env.MONDO_TRANSACTION_COOKIE_DOMAIN;
  const MONDO_TRANSACTION_COOKIE_PATH =
    process.env.MONDO_TRANSACTION_COOKIE_PATH;
  const MONDO_TRANSACTION_COOKIE_SAME_SITE =
    process.env.MONDO_TRANSACTION_COOKIE_SAME_SITE;
  const MONDO_TRANSACTION_COOKIE_SECURE =
    process.env.MONDO_TRANSACTION_COOKIE_SECURE;

  const baseURL =
    MONDO_BASE_URL && !/^https?:\/\//.test(MONDO_BASE_URL as string)
      ? `https://${MONDO_BASE_URL}`
      : MONDO_BASE_URL;

  const result = schema.safeParse({
    secret: MONDO_SECRET,
    issuerBaseURL: MONDO_ISSUER_BASE_URL,
    baseURL: baseURL,
    clientId: MONDO_CLIENT_ID,
    clientSecret: MONDO_CLIENT_SECRET,
    ...params,
    authorizationParams: {
      response_type: 'code',
      audience: MONDO_AUDIENCE,
      scope: MONDO_SCOPE,
      ...params.authorizationParams,
    },
    session: {
      name: MONDO_SESSION_NAME,
      duration:
        MONDO_SESSION_DURATION && Number.isNaN(Number(MONDO_SESSION_DURATION))
          ? (bool(MONDO_SESSION_DURATION) as false)
          : num(MONDO_SESSION_DURATION),
      ...params.session,
      cookie: {
        domain: MONDO_SESSION_COOKIE_DOMAIN,
        path: MONDO_SESSION_COOKIE_PATH || '/',
        secure: bool(MONDO_SESSION_COOKIE_SECURE),
        sameSite: MONDO_SESSION_COOKIE_SAME_SITE as
          | 'lax'
          | 'strict'
          | 'none'
          | undefined,
        ...params.session?.cookie,
      },
    },
    routes: {
      callback: params.routes?.callback || MONDO_CALLBACK || '/auth/callback',
      login:
        params.routes?.login ||
        process.env.NEXT_PUBLIC_MONDO_LOGIN ||
        '/auth/login',
      logout: params.routes?.logout || MONDO_LOGOUT || '/auth/logout',
      session: params.routes?.session || MONDO_SESSION || '/auth/session',
      accessToken:
        params.routes?.accessToken ||
        MONDO_ACCESS_TOKEN ||
        '/auth/access-token',
      postLogoutRedirect:
        params.routes?.postLogoutRedirect || MONDO_POST_LOGOUT_REDIRECT,
    },
    transaction: {
      name: MONDO_TRANSACTION_NAME,
      ...params.transaction,
      cookie: {
        domain: MONDO_TRANSACTION_COOKIE_DOMAIN,
        path: MONDO_TRANSACTION_COOKIE_PATH || '/',
        secure: bool(MONDO_TRANSACTION_COOKIE_SECURE),
        sameSite: MONDO_TRANSACTION_COOKIE_SAME_SITE as
          | 'lax'
          | 'strict'
          | 'none'
          | undefined,
        ...params.transaction?.cookie,
      },
    },
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const path = issue.path.length ? issue.path.join('.') : 'config';
        return `- ${path}: ${issue.message}`;
      })
      .join('\n');

    throw new MondoAuthConfigError(
      `Invalid @go-mondo/nextjs-auth configuration:\n${issues}`,
    );
  }

  return result.data;
};
