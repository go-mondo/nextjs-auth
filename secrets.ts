import type { Config } from './config/types';

/**
 * @example: { 1: 'secret-1', 2: 'secret-2' }
 */
export type Secrets = Record<number, string>;

/**
 * Secret Cache
 */
let secrets: Secrets;

export function getSecrets(config: Config): Secrets {
  if (secrets) {
    return secrets;
  }

  const secretsArray = Array.isArray(config.secret)
    ? config.secret
    : [config.secret];

  secrets = secretsArray.reduce((result, secret, index) => {
    return {
      ...result,
      [secretsArray.length - index]: secret,
    };
  }, {});

  return secrets;
}
