import { getInstance } from '../init';
import { authRequiredFactory, type AuthRequiredRouter } from './auth-required';
import type { ParamsPromise, SearchParamsPromise } from './types';

/**
 * Wrap a Server Component with this method to make sure the user is authenticated before
 * visiting the page.
 *
 * ```js
 * // app/profile/page.js
 * import { withAuthRequired } from '@go-mondo/nextjs-auth';
 *
 * export default withAuthRequired(
 *   async function Page() {
 *     return (
 *         <h1>Profile</h1>
 *     );
 *   },
 *   { returnTo: '/profile' }
 * );
 * ```
 *
 * Note: Server Components are not url aware therefore if you want to return the user to the page after
 * login, you must specify the `returnTo` option.
 */
export const withAuthRequired = <
  Params = ParamsPromise,
  SearchParams = SearchParamsPromise,
>(
  ...args: Parameters<AuthRequiredRouter<Params, SearchParams>>
) => authRequiredFactory<Params, SearchParams>(getInstance())(...args);
