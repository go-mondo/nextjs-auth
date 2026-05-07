import type { SerializeOptions } from 'cookie';
import { getIronSession, type IronSession } from 'iron-session';
import type { Config } from './config/types';
import type { CookieStore } from './cookie';
import { getSecrets, type Secrets } from './secrets';
import type { AuthorizationCodeParams } from './types';

export type AuthVerification = Pick<
  AuthorizationCodeParams,
  'nonce' | 'state' | 'max_age'
> & {
  code_verifier: string;
  return_to?: string;
};

/**
 * Create a new Transaction Store instance based on the config
 *
 * @param config
 * @param cookieStore
 * @returns
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

export class TransactionStore {
  constructor(
    private readonly secrets: Secrets,
    private readonly cookieStore: CookieStore,
    private readonly cookieName: string,
    private readonly cookieOptions: SerializeOptions,
  ) {}

  /**
   * Set a cookie.
   */
  async save(value: AuthVerification): Promise<void> {
    // Get the Iron Session cookie
    const cookie = await this.getCookie();

    // Update cookie
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
   * Get a cookie then delete it.
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
