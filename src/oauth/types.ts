/**
 * Minimal token endpoint response shape used by the session model.
 */
export interface TokenEndpointResponse {
  access_token?: string;
  token_type?: string;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
  [key: string]: unknown;
}

/**
 * PKCE challenge method supported by this SDK.
 */
export const CodeChallengeMethod = {
  S256: 'S256',
} as const;

type PKCEParams = {
  code_challenge_method: typeof CodeChallengeMethod.S256;
  code_challenge: string;
};

type AuthorizationCodeOptionalParams = {
  audience?: string;
};

/**
 * Authorization URL parameters assembled for the login redirect.
 *
 * Runtime-generated fields such as `state`, `nonce`, and PKCE values are added
 * by the login route handler rather than accepted from user config.
 */
export type AuthorizationCodeParams = {
  response_type: 'code';
  scope: string;
  redirect_uri: string;
  state: string;
  nonce: string;
  response_mode?: 'query' | 'form_post';
  display?: 'page' | 'popup' | 'touch' | 'wap';
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  max_age?: number;
  ui_locales?: string;
  id_token_hint?: string;
  login_hint?: string;
  acr_values?: string;
} & AuthorizationCodeOptionalParams &
  PKCEParams;

type BaseConfigurableAuthorizationParams = Omit<
  AuthorizationCodeParams,
  'client_id' | 'state' | 'nonce' | 'code_challenge_method' | 'code_challenge'
>;

/**
 * Per-request authorization parameter overrides accepted by `handleLogin`.
 */
export type OverrideAuthorizationParams =
  Partial<BaseConfigurableAuthorizationParams>;
