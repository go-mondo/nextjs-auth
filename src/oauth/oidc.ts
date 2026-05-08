import * as oidc from 'openid-client';
import type { Config } from '../config/types';

/**
 * Discovers the provider metadata and returns an `openid-client`
 * configuration for the current auth client.
 *
 * Localhost issuers are allowed to use insecure HTTP so local identity-provider
 * development remains possible.
 *
 * @param config - Validated auth configuration.
 */
export async function discoverOIDC(
  config: Config,
): Promise<oidc.Configuration> {
  const isLocalDevelopment =
    config.issuerBaseURL.includes('localhost') ||
    config.issuerBaseURL.includes('127.0.0.1');

  return await oidc.discovery(
    new URL(config.issuerBaseURL),
    config.clientId,
    config.clientSecret,
    undefined,
    isLocalDevelopment
      ? {
          execute: [oidc.allowInsecureRequests],
        }
      : undefined,
  );
}
