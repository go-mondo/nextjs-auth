import type { ConfigurableAuthorizationParams } from '../types';

/**
 * Configuration properties.
 */
export interface Config {
  /**
   * URL parameters used when redirecting users to the authorization server to log in.
   *
   * If this property is not provided by your application, its default values will be:
   *
   * ```js
   * {
   *   response_type: 'id_token',
   *   response_mode: 'form_post',
   *   scope: 'openid profile email'
   * }
   * ```
   *
   * New values can be passed in to change what is returned from the authorization server
   * depending on your specific scenario.
   *
   * For example, to receive an access token for an API, you could initialize like the sample below.
   * Note that `response_mode` can be omitted because the OAuth2 default mode of `query` is fine:
   *
   * ```js
   * app.use(auth({
   *   authorizationParams: {
   *     response_type: 'code',
   *     scope: 'openid profile email read:reports',
   *     audience: 'https://your-auth0-api-identifier'
   *   }
   * }));
   * ```
   *
   * Additional custom parameters can be added as well:
   *
   * ```js
   * app.use(auth({
   *   authorizationParams: {
   *     // Note: you need to provide required parameters if this object is set
   *     response_type: 'id_token',
   *     response_mode: 'form_post',
   *     scope: 'openid profile email',
   *     // Additional parameters
   *     acr_value: 'tenant:test-tenant',
   *     custom_param: 'custom-value'
   *   }
   * }));
   * ```
   */
  authorizationParams: ConfigurableAuthorizationParams;

  /**
   * The secret(s) used to encrypt sensitive cookies.
   *
   * When rotating secrets, provide an array with the first item representing the new secret.
   */
  secret: string | Array<string>;

  /**
   * Session attributes.
   */
  session: SessionConfig;

  /**
   * The root URL for the application, for example `https://localhost`.
   */
  baseURL: string;

  /**
   * The Client Id for your application.
   */
  clientId: string;

  /**
   * The Client Secret for your application.
   */
  clientSecret?: string;

  /**
   * The root URL for the token issuer with no trailing slash.
   */
  issuerBaseURL: string;

  routes: {
    /**
     * Either a relative path to the application or a valid URI to an external domain.
     * This value must be registered on the authorization server.
     *
     * The user will be redirected to this after a logout has been performed.
     */
    postLogoutRedirect: string;

    /**
     * Relative path to the application login to initiate from the authorization server.
     */
    login: string;

    /**
     * Relative path to the application callback to process the response from the authorization server.
     */
    callback: string;
  };

  /**
   * Transaction attributes.
   */
  transaction: TransactionConfig;
}

/**
 * Configuration parameters used for the application session.
 */
export interface SessionConfig {
  /**
   * The cookie prefix name used for the session.
   *
   * A session consists of three cookies: Session (User profile), Authorization (Access Token) and Authentication (Id Token),
   * each will be prefixed with this name.
   *
   * This value must only include letters, numbers, and underscores.
   *
   * Defaults to `Mondo`.
   */
  name: string;

  /**
   * Integer value, in seconds, for the amount of time for which the user must be idle in order to be logged out.
   *
   * Defaults to `86400` seconds (1 day).
   */
  duration: number | false;

  /**
   * The session cookie
   *
   * Given the sensitivity of session cookies, `httpOnly` is strictly enforced.
   */
  cookie: Omit<CookieConfig, 'httpOnly'>;
}

/**
 * Configuration parameters used for the application transaction.
 */
export interface TransactionConfig {
  /**
   * The cookie name used for the transaction.
   *
   * A transaction is used to store data while performing an authentication request.
   *
   * This value must only include letters, numbers, and underscores.
   *
   * Defaults to `Mondo.Verification`.
   */
  name: string;

  /**
   * The transaction cookie
   *
   * Given the sensitivity of session cookies, `httpOnly` is strictly enforced.
   */
  cookie: Omit<CookieConfig, 'httpOnly'>;
}

export interface CookieConfig {
  /**
   * Domain name for the cookie.
   * Passed to the [response cookie](https://expressjs.com/en/api.html#res.cookie) as `domain`.
   */
  domain?: string;

  /**
   * Path for the cookie.
   * Passed to the [response cookie](https://expressjs.com/en/api.html#res.cookie) as `path`.
   */
  path?: string;

  /**
   * Marks the cookie to be used over secure channels only.
   * Passed to the [response cookie](https://expressjs.com/en/api.html#res.cookie) as `secure`.
   * Defaults to the protocol of {@link Config.baseURL}.
   */
  secure?: boolean;

  /**
   * Value of the SameSite `Set-Cookie` attribute.
   * Passed to the [response cookie](https://expressjs.com/en/api.html#res.cookie) as `samesite`.
   * Defaults to `Lax` but will be adjusted based on {@link AuthorizationParameters.response_type}.
   */
  sameSite: 'lax' | 'strict' | 'none';
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer I>
    ? Array<DeepPartial<I>>
    : DeepPartial<T[P]>;
};

export type PartialConfig = DeepPartial<Config>;
