# @go-mondo/nextjs-auth

Next.js authentication helpers for Mondo Identity.

This package provides a small OIDC auth layer for modern Next.js apps. It is
centered around a single auth client that can mount auth routes, protect routes
from `proxy.ts`, read the current session, and return or refresh access tokens.

## Install

```sh
pnpm add @go-mondo/nextjs-auth
```

## Public Entry Points

This package uses explicit subpath exports for supporting types. Import the
auth client from `@go-mondo/nextjs-auth` or `@go-mondo/nextjs-auth/client`, and
import supporting public types from `@go-mondo/nextjs-auth/config`,
`@go-mondo/nextjs-auth/session`, `@go-mondo/nextjs-auth/oidc`, or
`@go-mondo/nextjs-auth/errors`.

## Environment

At minimum, configure:

```env
MONDO_SECRET="replace-with-at-least-32-characters"
MONDO_ISSUER_BASE_URL="https://identity.example.com"
MONDO_BASE_URL="http://localhost:3000"
MONDO_CLIENT_ID="your-client-id"
MONDO_CLIENT_SECRET="your-client-secret"
```

Common optional values:

```env
MONDO_AUDIENCE="https://api.example.com"
MONDO_SCOPE="openid profile email offline_access"

NEXT_PUBLIC_MONDO_LOGIN="/auth/login"
MONDO_CALLBACK="/auth/callback"
MONDO_LOGOUT="/auth/logout"
MONDO_SESSION="/auth/session"
MONDO_ACCESS_TOKEN="/auth/access-token"
MONDO_POST_LOGOUT_REDIRECT="/"

MONDO_SESSION_IDLE_DURATION="86400"
MONDO_SESSION_ABSOLUTE_DURATION="604800"
MONDO_COOKIE_SECURE="true"
MONDO_COOKIE_SAME_SITE="lax"
```

`MONDO_SECRET` is used by `iron-session` to seal session and transaction
cookies. Use at least 32 characters. For secret rotation, pass an array of
secrets when creating the auth client.

## Quick Start

Create one auth client and reuse it everywhere.

```ts
// src/lib/auth.ts
import { createAuth } from '@go-mondo/nextjs-auth';

export const auth = createAuth();
```

Mount the auth routes.

```ts
// src/app/auth/[...auth]/route.ts
import { auth } from '@/lib/auth';

export const GET = auth.handleAuth();
export const POST = auth.handleAuth();
```

Protect routes with `proxy.ts`.

```ts
// src/proxy.ts
import { auth } from '@/lib/auth';

export const proxy = auth.proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
```

Link users to login and logout with normal anchors.

```tsx
export function AuthLinks() {
  return (
    <nav>
      <a href="/auth/login">Log in</a>
      <a href="/auth/logout">Log out</a>
    </nav>
  );
}
```

## Public Routes

If your matcher covers the whole app, pass public paths to `auth.proxy`.

```ts
// src/proxy.ts
import { auth } from '@/lib/auth';

export function proxy(request: Request) {
  return auth.proxy(request, {
    publicPaths: ['/', '/pricing', /^\/blog(\/.*)?$/],
  });
}
```

Unauthenticated users are redirected to the configured login route with a
`returnTo` query parameter.

## Reading the Session

Use the auth client from server components, route handlers, and server actions.

```tsx
// src/app/account/page.tsx
import { auth } from '@/lib/auth';

export default async function AccountPage() {
  const session = await auth.getSession();

  if (!session) {
    return null;
  }

  return <h1>{session.user.email}</h1>;
}
```

The default session JSON endpoint is mounted at `/auth/session`.

```ts
const response = await fetch('/auth/session');
```

## Getting an Access Token

On the server, call `getAccessToken`. If the stored access token is expired and
a refresh token is available, the package refreshes the access token and writes
the updated authorization data back to the sealed session cookies.

```ts
// src/app/api/reports/route.ts
import { auth } from '@/lib/auth';

export async function GET() {
  const { accessToken } = await auth.getAccessToken({
    scopes: ['reports:read'],
  });

  const upstream = await fetch('https://api.example.com/reports', {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  return Response.json(await upstream.json(), { status: upstream.status });
}
```

The default access-token JSON endpoint is mounted at `/auth/access-token`.
Prefer server-side access-token usage when possible; expose this endpoint only
when browser code truly needs the token.

## Custom Configuration

You can configure the client in code instead of relying only on environment
variables.

```ts
// src/lib/auth.ts
import { createAuth } from '@go-mondo/nextjs-auth';

export const auth = createAuth({
  baseURL: 'https://app.example.com',
  issuerBaseURL: 'https://identity.example.com',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  secret: [
    'new-32-character-or-longer-secret',
    'old-32-character-or-longer-secret',
  ],
  authorizationParams: {
    audience: 'https://api.example.com',
    scope: 'openid profile email offline_access reports:read',
  },
  session: {
    idleDuration: 60 * 60 * 24,
    absoluteDuration: 60 * 60 * 24 * 7,
    cookie: {
      secure: true,
      sameSite: 'lax',
    },
  },
});
```

Configuration is validated with Zod at client initialization. The schema is
described in code so validation errors, generated docs, and future examples can
all draw from the same source of truth.

## Typed Claims

Pass your app-specific claims to `createAuth` to type `session.user`.

```ts
import { createAuth } from '@go-mondo/nextjs-auth';

type MondoClaims = {
  roles?: string[];
  org_id?: string;
};

export const auth = createAuth<MondoClaims>();
```

```ts
const session = await auth.getSession();
session?.user.roles;
```

## Mounted Routes

By default, `auth.handleAuth()` handles:

- `/auth/login`: starts the authorization-code login flow.
- `/auth/callback`: verifies the callback and stores the session.
- `/auth/logout`: clears the local application session.
- `/auth/session`: returns the current session as JSON.
- `/auth/access-token`: returns or refreshes the current access token.

## Session Cookies

The session is split into sealed `iron-session` cookies:

- `Mondo.Session`: user claims and session timestamps.
- `Mondo.Authorization`: access token, expiry, scopes, and refresh token.
- `Mondo.Authentication`: raw ID token.

This keeps the session stateless and tamper-proof while avoiding a server-side
session database. Cookies are HTTP-only by default.

## Session Expiration

Sessions support both idle and absolute expiration. `idleDuration` extends the
session when authenticated activity touches it, such as protected requests
handled by `auth.proxy()` or the session JSON route. `absoluteDuration` caps the
session lifetime from the original login time, regardless of activity.

The stored `expiresAt` timestamp is the earlier of the idle and absolute
expiration times. Set `idleDuration: false` to disable activity-based extension;
set `absoluteDuration: false` to disable the hard maximum lifetime. At least one
expiration mode must be enabled.

## Development

```sh
pnpm install
pnpm run check
```

`pnpm run check` runs library type-checking, example type-checking, linting,
formatting checks, tests, and the package build.

## Examples

This repository includes two runnable Next.js examples. Both require your own
Mondo Identity OIDC application credentials.

```sh
pnpm install
pnpm run build
```

Server-rendered profile:

```sh
cd examples/server-profile
cp .env.example .env.local
pnpm dev
```

Client-rendered profile:

```sh
cd examples/client-profile
cp .env.example .env.local
pnpm dev
```

The server example runs on port `3001`; the client example runs on port `3002`.
Register the matching `/auth/callback` URL with your identity provider before
logging in.
