import { redirect } from 'next/navigation.js';
import type { Config } from '../config/types';
import type { MondoInstance } from '../init';
import { sessionStoreFactory } from '../session/stores/stateless-store';
import type {
  AppRouterOpts,
  AppRouterPageRoute,
  ParamsPromise,
  SearchParamsPromise,
} from './types';

/**
 * Specify the URL to `returnTo` - this is important in app router pages because the server component
 * won't know the URL of the page.
 *
 * @category Server
 */
export type AuthRequiredOptions<
  Params = ParamsPromise,
  SearchParams = SearchParamsPromise,
> = {
  returnTo?:
    | string
    | ((obj: AppRouterOpts<Params, SearchParams>) => Promise<string> | string);
};

export type AuthRequiredRouter<
  Params = ParamsPromise,
  SearchParams = SearchParamsPromise,
> = (
  fn: AppRouterPageRoute<Params, SearchParams>,
  opts?: AuthRequiredOptions<Params, SearchParams>,
) => AppRouterPageRoute<Params, SearchParams>;

export const authRequiredFactory =
  <Params = ParamsPromise, SearchParams = SearchParamsPromise>(
    instance: MondoInstance,
  ): AuthRequiredRouter<Params, SearchParams> =>
  (
    fn: AppRouterPageRoute<Params, SearchParams>,
    opts?: AuthRequiredOptions<Params, SearchParams>,
  ) =>
    handler<Params, SearchParams>(instance.config)(fn, opts);

const handler =
  <Params = ParamsPromise, SearchParams = SearchParamsPromise>(
    config: Config,
  ): AuthRequiredRouter<Params, SearchParams> =>
  (fn, opts = {}) =>
  async (params) => {
    const sessionStore = sessionStoreFactory(config);

    const session = await sessionStore.get();
    if (!session?.user) {
      const returnTo =
        typeof opts.returnTo === 'function'
          ? await opts.returnTo(params)
          : opts.returnTo;

      redirect(
        `${config.routes.login}${returnTo ? `?returnTo=${returnTo}` : ''}`,
      );
    }

    return fn(params);
  };
