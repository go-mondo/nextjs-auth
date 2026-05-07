import type { SerializeOptions } from "cookie";
import { getIronSession, type IronSession } from "iron-session";
import type { Config } from "../../config/types";
import { type CookieStore, cookieFactory } from "../../cookie";
import { getSecrets, type Secrets } from "../../secrets";
import Session from "../model";
import type {
  AnyRequest,
  AnyResponse,
  BaseSession,
  Claims,
  SessionAuthentication,
  SessionAuthorization,
  SessionPart,
} from "../types";
import { AbstractSessionStore } from "./abstract-store";
import type { SessionStoreInterface } from "./types";

type CookieType = "Session" | "Authorization" | "Authentication";

type IronSessionPayload<Payload> = {
  data: Payload;
};

/**
 * @param config
 * @param cookieStore
 * @returns
 */
export function sessionStoreFactory<UserClaims extends Claims>(
  config: Config,
  request?: AnyRequest,
  response?: AnyResponse,
): SessionStoreInterface<UserClaims> {
  return new NewStatelessSessionStore(config, request, response);
}

export class NewStatelessSessionStore<
  UserClaims extends Claims,
> extends AbstractSessionStore<UserClaims> {
  private readonly secrets: Secrets;
  private readonly cookieName: string;
  private readonly cookieOptions: SerializeOptions;

  constructor(
    config: Config,
    request: AnyRequest | undefined = undefined,
    response: AnyResponse | undefined = undefined,
    private readonly cookieStore: (
      config: Config,
    ) => CookieStore | Promise<CookieStore> = () =>
      cookieFactory(request, response),
  ) {
    super(config);

    this.cookieName = config.session.name;
    this.cookieOptions = {
      ...config.session.cookie,
      httpOnly: true,
    };

    this.secrets = getSecrets(config);
  }

  async _get(): Promise<Session<UserClaims> | undefined> {
    const [session, authorization, authentication] = await this.getAllCookies();

    // If we don't have a primary session, don't return the others
    if (!session.data) {
      return undefined;
    }

    return new Session({
      ...session.data,
      authorization: authorization.data || undefined,
      authentication: authentication.data || undefined,
    });
  }

  async _set(payload: Session<UserClaims>): Promise<void> {
    const [session, authorization, authentication] = await this.getAllCookies();

    // Deconstruct the payload for each token cookie
    const {
      user,
      issuedAt,
      updatedAt,
      expiresAt,
      authorization: authz,
      authentication: authn,
    } = payload;

    // Session
    session.data = { user, issuedAt, updatedAt, expiresAt };

    // Authentication
    authentication.data = authn;

    // Authorization
    authorization.data = authz;

    await Promise.all([
      session.save(),
      authorization.save(),
      authentication.save(),
    ]);
  }

  async _delete(): Promise<void> {
    const [session, authorization, authentication] = await this.getAllCookies();

    await Promise.all([
      session.destroy(),
      authorization.destroy(),
      authentication.destroy(),
    ]);
  }

  private async getAllCookies() {
    return await Promise.all([
      this.getCookie<BaseSession<UserClaims>>("Session"),
      this.getCookie<SessionAuthorization>("Authorization"),
      this.getCookie<SessionAuthentication>("Authentication"),
    ]);
  }

  private async getCookie<S extends SessionPart>(
    type: CookieType,
  ): Promise<IronSession<Partial<IronSessionPayload<S | undefined | null>>>> {
    const ironSession = await getIronSession<
      IronSessionPayload<S | undefined | null>
    >(await this.cookieStore(this.config), {
      cookieName: `${this.cookieName}.${type}`,
      password: this.secrets,
      cookieOptions: this.cookieOptions,
    });

    return ironSession;
  }
}
