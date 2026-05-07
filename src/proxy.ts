import { type NextProxy, type NextRequest, NextResponse } from 'next/server.js';
import { getInstance, type MondoInstance } from './init';
import { sessionStoreFactory } from './session/stores/stateless-store';

/**
 * Pass custom options to {@link WithProxyAuthRequired}.
 *
 * @category Server
 */
export type WithProxyAuthRequiredOptions = {
  proxy?: NextProxy;
  returnTo?: string | ((req: NextRequest) => Promise<string> | string);
};

/**
 * Protect your pages with Next.js Proxy. For example:
 *
 * To protect all your routes:
 *
 * ```js
 * // middleware.js
 * import { withProxyAuthRequired } from '@auth0/nextjs-auth0/edge';
 *
 * export default withProxyAuthRequired();
 * ```
 *
 * To protect specific routes:
 *
 * ```js
 * // middleware.js
 * import { withProxyAuthRequired } from '@auth0/nextjs-auth0/edge';
 *
 * export default withProxyAuthRequired();
 *
 * export const config = {
 *   matcher: '/about/:path*',
 * };
 * ```
 * For more info see: https://nextjs.org/docs/advanced-features/middleware#matching-paths
 *
 * To run custom middleware for authenticated users:
 *
 * ```js
 * // middleware.js
 * import { withProxyAuthRequired, getSession } from '@auth0/nextjs-auth0/edge';
 *
 * export default withProxyAuthRequired(async function middleware(req) {
 *   const res = NextResponse.next();
 *   const user = await getSession(req, res);
 *   res.cookies.set('hl', user.language);
 *   return res;
 * });
 * ```
 *
 * To provide a custom `returnTo` url to login:
 *
 * ```js
 * // middleware.js
 * import { withProxyAuthRequired, getSession } from '@auth0/nextjs-auth0/edge';
 *
 * export default withProxyAuthRequired({
 *   returnTo: '/foo',
 *   // Custom middleware is provided with the `middleware` config option
 *   async middleware(req) { return NextResponse.next(); }
 * });
 * ```
 *
 * You can also provide a method for `returnTo` that takes the req as an argument.
 *
 * ```js
 * // middleware.js
 * import { withProxyAuthRequired, getSession } from '@auth0/nextjs-auth0/edge';
 *
 * export default withProxyAuthRequired({
 *   returnTo(req) { return `${req.nextURL.basePath}${req.nextURL.pathname}`};
 * });
 * ```
 *
 * @category Server
 */
export type WithProxyAuthRequired = (
  middlewareOrOpts?: NextProxy | WithProxyAuthRequiredOptions,
) => NextProxy;

export default function withProxyAuthRequiredFactory(
  instance: MondoInstance,
): WithProxyAuthRequired {
  return function withProxyAuthRequired(opts?): NextProxy {
    return async function wrappedProxy(...args) {
      const [req] = args;

      const { pathname, origin, search } = req.nextUrl;

      // We'll redirect the user back
      let returnTo = `${pathname}${search}`;

      /**
       * Proxy
       */
      let proxy: NextProxy | undefined;

      // Form one, it's a function and not
      if (typeof opts === 'function') {
        proxy = opts;
      } else if (opts) {
        proxy = opts.proxy;
        returnTo =
          (typeof opts.returnTo === 'function'
            ? await opts.returnTo(req)
            : opts.returnTo) || returnTo;
      }

      const {
        routes: { login, callback },
      } = instance.config;

      // Ignore our own login and callback paths
      if ([login, callback].some((p) => pathname.startsWith(p))) {
        console.log('Skipping auth middleware for path:', pathname);
        return;
      }

      // Get our session store
      const sessionStore = sessionStoreFactory(instance.config, req);

      const session = await sessionStore.get();
      if (!session?.user) {
        return NextResponse.redirect(
          new URL(`${login}?returnTo=${encodeURIComponent(returnTo)}`, origin),
        );
      }

      return await proxy?.(...args);
    };
  };
}

export const withProxyAuthRequired: WithProxyAuthRequired = (...args) =>
  withProxyAuthRequiredFactory(getInstance())(...args);
