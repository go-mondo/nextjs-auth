import { NextResponse } from 'next/server.js';
import {
  type GetAccessTokenOptions,
  getAccessTokenFactory,
} from './oidc/access-token';
import type { PartialConfig } from './config/types';
import { initInstance, type MondoInstance } from './core/instance';
import {
  type CallbackOptions,
  callbackHandlerFactory,
} from './routes/callback';
import { type LoginOptions, loginHandlerFactory } from './routes/login';
import { type LogoutOptions, logoutHandlerFactory } from './routes/logout';
import { type SessionOptions, sessionHandlerFactory } from './routes/session';
import {
  type AccessTokenOptions,
  accessTokenHandlerFactory,
} from './routes/access-token';
import { sessionStoreFactory } from './session/stores/stateless-store';
import type { Claims } from './session/types';

/**
 * Route-level options used by {@link MondoAuthClient.handleAuth}.
 *
 * Each property customizes the matching built-in route while keeping the same
 * default route mounting behavior.
 */
export type HandleAuthOptions<UserClaims extends Claims = Claims> = {
  /** Options applied to the login route. */
  login?: LoginOptions;

  /** Options applied to the callback route. */
  callback?: CallbackOptions;

  /** Options applied to the logout route. */
  logout?: LogoutOptions;

  /** Options applied to the session JSON route. */
  session?: SessionOptions<UserClaims>;

  /** Options applied to the access-token JSON route. */
  accessToken?: AccessTokenOptions;
};

/**
 * Options for protecting requests from Next.js `proxy.ts`.
 */
export type ProxyOptions = {
  /**
   * Paths that should pass through without an authenticated session.
   */
  publicPaths?: Array<string | RegExp>;

  /**
   * A route-specific return URL override for unauthenticated redirects.
   */
  returnTo?: string | ((request: Request) => string | Promise<string>);
};

/**
 * Modern entry point for applications. Create one instance in `src/lib/auth.ts`,
 * then reuse it from route handlers, server code, and `proxy.ts`.
 *
 * @typeParam UserClaims - App-specific claims expected on `session.user`.
 */
export class MondoAuthClient<UserClaims extends Claims = Claims> {
  private readonly instance: MondoInstance;

  /**
   * Creates a client and validates configuration immediately.
   *
   * @param config - Optional explicit config. Environment variables provide the
   * remaining values.
   */
  constructor(config?: PartialConfig) {
    this.instance = initInstance(config);
  }

  /**
   * Validated auth configuration used by this client.
   */
  get config() {
    return this.instance.config;
  }

  /**
   * Returns one route handler that serves all configured auth routes.
   *
   * Mount this from a catch-all route such as
   * `src/app/auth/[...auth]/route.ts`.
   */
  handleAuth(options: HandleAuthOptions<UserClaims> = {}) {
    return async (request: Request): Promise<Response> => {
      const { pathname } = new URL(request.url);
      const { routes } = this.config;

      if (pathname === routes.login) {
        return this.handleLogin(options.login)(request);
      }

      if (pathname === routes.callback) {
        return this.handleCallback(options.callback)(request);
      }

      if (pathname === routes.logout) {
        return this.handleLogout(options.logout)(request);
      }

      if (pathname === routes.session) {
        return this.handleSession(options.session)(request);
      }

      if (pathname === routes.accessToken) {
        return this.handleAccessToken(options.accessToken)(request);
      }

      return NextResponse.json(
        {
          error: 'NotFound',
          error_description: `No Mondo auth route is configured for ${pathname}.`,
        },
        { status: 404 },
      );
    };
  }

  /**
   * Creates a route handler that starts the OIDC login redirect.
   */
  handleLogin(options?: LoginOptions) {
    return loginHandlerFactory(this.instance)(options);
  }

  /**
   * Creates a route handler that completes the OIDC callback.
   */
  handleCallback(options?: CallbackOptions) {
    return callbackHandlerFactory<UserClaims>(this.instance)(options);
  }

  /**
   * Creates a route handler that clears the local session.
   */
  handleLogout(options?: LogoutOptions) {
    return logoutHandlerFactory<UserClaims>(this.instance)(options);
  }

  /**
   * Creates a route handler that returns the current session as JSON.
   */
  handleSession(options?: SessionOptions<UserClaims>) {
    return sessionHandlerFactory<UserClaims>(this.instance)(options);
  }

  /**
   * Creates a route handler that returns or refreshes the current access token.
   */
  handleAccessToken(options?: AccessTokenOptions) {
    return accessTokenHandlerFactory<UserClaims>(this.instance)(options);
  }

  /**
   * Reads the current sealed-cookie session in server code.
   */
  getSession = async () => {
    return sessionStoreFactory<UserClaims>(this.config).get();
  };

  /**
   * Returns the current access token, refreshing with the stored refresh token
   * when the token is expired or missing required scopes.
   */
  getAccessToken = (options?: GetAccessTokenOptions) => {
    return getAccessTokenFactory<UserClaims>(this.instance)(options);
  };

  /**
   * Drop this into `proxy.ts` to protect matched routes and keep idle sessions
   * fresh at the request boundary.
   */
  proxy = async (
    request: Request,
    options: ProxyOptions = {},
  ): Promise<Response | undefined> => {
    const url = new URL(request.url);

    if (isAuthRoute(url.pathname, this.config.routes)) {
      return undefined;
    }

    if (isPublicPath(url.pathname, options.publicPaths)) {
      return undefined;
    }

    const response = NextResponse.next();
    const sessionStore = sessionStoreFactory<UserClaims>(
      this.config,
      request,
      response,
    );
    const session = await sessionStore.get();

    if (!session?.user) {
      const returnTo =
        typeof options.returnTo === 'function'
          ? await options.returnTo(request)
          : options.returnTo || `${url.pathname}${url.search}`;

      return NextResponse.redirect(
        new URL(
          `${this.config.routes.login}?returnTo=${encodeURIComponent(returnTo)}`,
          url.origin,
        ),
      );
    }

    await sessionStore.touch();
    return response;
  };
}

/**
 * Creates a configured Mondo auth client.
 *
 * @typeParam UserClaims - App-specific claims expected on `session.user`.
 * @param config - Optional explicit config. Environment variables provide the
 * remaining values.
 */
export function createAuth<UserClaims extends Claims = Claims>(
  config?: PartialConfig,
) {
  return new MondoAuthClient<UserClaims>(config);
}

type AuthRoutes = MondoInstance['config']['routes'];

function isAuthRoute(pathname: string, routes: AuthRoutes): boolean {
  return [
    routes.login,
    routes.callback,
    routes.logout,
    routes.session,
    routes.accessToken,
  ].includes(pathname);
}

function isPublicPath(
  pathname: string,
  publicPaths: ProxyOptions['publicPaths'] = [],
): boolean {
  return publicPaths.some((path) =>
    typeof path === 'string' ? pathname.startsWith(path) : path.test(pathname),
  );
}
