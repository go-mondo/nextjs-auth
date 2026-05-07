export interface TokenEndpointResponse {
  access_token?: string;
  token_type?: string;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
  [key: string]: unknown;
}

export const ResponseType = {
  ID_TOKEN: 'id_token',
  TOKEN: 'token',
  CODE: 'code',
  CODE_AND_ID_TOKEN: 'code id_token', // Can we delete this?
} as const;
export type AnyResponseType = (typeof ResponseType)[keyof typeof ResponseType];

export const CodeChallengeMethod = {
  DEFAULT: 'S256',
  S256: 'S256',
  PLAIN: 'plain',
} as const;

export type AnyCodeChallengeMethod =
  (typeof CodeChallengeMethod)[keyof typeof CodeChallengeMethod];

export const AuthorizationDisplay = {
  PAGE: 'page',
  POPUP: 'popup',
  TOUCH: 'touch',
  WAP: 'wap',
} as const;

export type AnyAuthorizationDisplay =
  (typeof AuthorizationDisplay)[keyof typeof AuthorizationDisplay];

export const AuthorizationPrompt = {
  NONE: 'none',
  LOGIN: 'login',
  CONSENT: 'consent',
  SELECT_ACCOUNT: 'select_account',
} as const;

export type AnyAuthorizationPrompt =
  (typeof AuthorizationPrompt)[keyof typeof AuthorizationPrompt];

export const AuthorizationResponseMode = {
  QUERY: 'query',
  FORM_POST: 'form_post',
} as const;
export type AnyAuthorizationResponseMode =
  (typeof AuthorizationResponseMode)[keyof typeof AuthorizationResponseMode];

/**
 * PKCE Code Challenge params
 */
type PKCEParams = {
  code_challenge_method: AnyCodeChallengeMethod;
  code_challenge: string;
};

/**
 * Authorization params unique to Mondo
 */
type AuthorizationCodeOptionalParams = {
  audience?: string; // Mondo
};

/**
 * All of the authorization code params that we're requring to make a
 * request.
 *
 * Note: the `client_id` is omitted as this value is provided through
 * via config.
 */
export type AuthorizationCodeParams = {
  response_type: typeof ResponseType.CODE;
  scope: string;
  redirect_uri: string;
  state: string;
  nonce: string;

  response_mode?: AnyAuthorizationResponseMode;

  display?: AnyAuthorizationDisplay;
  prompt?: AnyAuthorizationPrompt;

  max_age?: number;
  ui_locales?: string;
  id_token_hint?: string;
  login_hint?: string;
  acr_values?: string;
} & AuthorizationCodeOptionalParams &
  PKCEParams;

/**
 * We're excluding a handful of params here as these are generated at runtime and should
 * not be configurable
 */
type BaseConfigurableAuthorizationParams = Omit<
  AuthorizationCodeParams,
  'client_id' | 'state' | 'nonce' | 'code_challenge_method' | 'code_challenge'
>;

/**
 * Authorization params that can be overwritten
 */
export type OverrideAuthorizationParams =
  Partial<BaseConfigurableAuthorizationParams>;

/**
 * Authorization parameters that can be configured
 */
export type ConfigurableAuthorizationParams = Omit<
  BaseConfigurableAuthorizationParams,
  'redirect_uri'
>;
