import { getConfig } from './config/config';
import type { Config, PartialConfig } from './config/types';

/**
 * The Mondo instance
 */
export type MondoInstance = {
  config: Config;
};

let instance: MondoInstance;

export function getInstance(): MondoInstance {
  if (instance) {
    return instance;
  }
  instance = initInstance();
  return instance;
}

/**
 * Initialize a new instance;
 *
 * @param params
 * @returns
 */
export const initInstance = (params?: PartialConfig): MondoInstance => {
  const config = getConfig(params);
  return {
    config,
  };
};
