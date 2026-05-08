import type { SerializeOptions } from 'cookie';
import { getIronSession, type IronSession } from 'iron-session';
import type { Config } from '../config/types';
import { getSecrets, type Secrets } from '../crypto/secrets';
import type { CookieStore } from '../http/cookies';
import type { AuthorizationCodeParams } from '../oidc/types';

export type AuthVerification = Pick<
  AuthorizationCodeParams,
  'nonce' | 'state' | 'max_age'
> & {
  /** PKCE verifier used during callback token exchange. */
  code_verifier: string;

  /** Application URL to redirect to after the callback succeeds. */
  return_to?: string;
};

/**
 * Creates the transaction store used during login and callback.
 *
 * @param config - Validated auth configuration.
 * @param cookieStore - Cookie store bound to the login or callback request.
 */
export function transactionStoreFactory(
  config: Config,
  cookieStore: CookieStore,
): TransactionStore {
  return new TransactionStore(
    getSecrets(config),
    cookieStore,
    config.transaction.name,
    {
      ...config.transaction.cookie,
      httpOnly: true,
    },
  );
}

/**
 * Short-lived store for PKCE, nonce, state, and `returnTo` verification data.
 *
 * The transaction is saved before redirecting to the identity provider and is
 * destroyed as soon as the callback reads it.
 */
export class TransactionStore {
  constructor(
    private readonly secrets: Secrets,
    private readonly cookieStore: CookieStore,
    private readonly cookieName: string,
    private readonly cookieOptions: SerializeOptions,
  ) {}

  /**
   * Saves transaction verification data in a sealed cookie.
   */
  async save(value: AuthVerification): Promise<void> {
    const cookie = await this.getCookie();

    cookie.code_verifier = value.code_verifier;
    cookie.nonce = value.nonce;
    cookie.state = value.state;
    cookie.max_age = value.max_age;
    cookie.return_to = value.return_to;

    return await cookie.save();
  }

  private async getCookie(): Promise<IronSession<AuthVerification>> {
    const ironSession = await getIronSession<AuthVerification>(
      this.cookieStore,
      {
        cookieName: this.cookieName,
        password: this.secrets,
        cookieOptions: this.cookieOptions,
      },
    );

    return ironSession;
  }

  /**
   * Reads and destroys the transaction cookie.
   *
   * @returns Verification data, or `undefined` when the cookie is missing or
   * malformed.
   */
  async read(): Promise<AuthVerification | undefined> {
    const cookie = await this.getCookie();

    if (!cookie.code_verifier || !cookie.nonce || !cookie.state) {
      cookie.destroy();
      return undefined;
    }

    const result: AuthVerification = {
      code_verifier: cookie.code_verifier,
      nonce: cookie.nonce,
      state: cookie.state,
      max_age: cookie.max_age,
      return_to: cookie.return_to,
    };

    cookie.destroy();

    return result;
  }
}
