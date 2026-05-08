import { getConfig } from '../config/config';
import type { Config, PartialConfig } from '../config/types';

/**
 * Runtime state shared by route handlers and server helpers.
 */
export type MondoInstance = {
  /** Validated auth configuration for this client instance. */
  config: Config;
};

/**
 * Validates configuration and creates the runtime auth instance.
 *
 * @param params - Optional explicit config. Environment variables provide the
 * remaining values.
 */
export const initInstance = (params?: PartialConfig): MondoInstance => {
  const config = getConfig(params);
  return {
    config,
  };
};
