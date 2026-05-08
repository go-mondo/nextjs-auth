import type { Config } from '../config/types';

/**
 * Password map format expected by `iron-session`.
 *
 * Higher numeric keys represent newer secrets.
 */
export type Secrets = Record<number, string>;

/**
 * Converts configured secrets into the rotation map used to seal and unseal
 * `iron-session` cookies.
 *
 * @param config - Validated auth configuration.
 */
export function getSecrets(config: Config): Secrets {
  const secretsArray = Array.isArray(config.secret)
    ? config.secret
    : [config.secret];

  const secrets: Secrets = {};
  secretsArray.forEach((secret, index) => {
    secrets[secretsArray.length - index] = secret;
  });

  return secrets;
}
