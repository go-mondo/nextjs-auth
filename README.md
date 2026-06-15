# @go-mondo/nextjs-auth

Next.js authentication helpers for Mondo Identity.

This package provides a small OAuth/OIDC auth layer for modern Next.js apps. It
is centered around a single auth client that can mount auth routes, protect
routes from `proxy.ts`, read the current session, and return or refresh access
tokens.

## Install

```sh
pnpm add @go-mondo/nextjs-auth
```

## Public Entry Points

This package uses explicit subpath exports for supporting types. Import the
auth client from `@go-mondo/nextjs-auth` or `@go-mondo/nextjs-auth/client`, and
import supporting public types from `@go-mondo/nextjs-auth/config`,
`@go-mondo/nextjs-auth/session`, `@go-mondo/nextjs-auth/oauth`, or
`@go-mondo/nextjs-auth/errors`. Hooks are exported from
`@go-mondo/nextjs-auth/hooks`.

## Environment

At minimum, configure:

```env
MONDO_SECRET="replace-with-at-least-32-characters"
MONDO_ISSUER_BASE_URL="https://identity.example.com"
APP_BASE_URL="http://localhost:3000"
MONDO_CLIENT_ID="your-client-id"
MONDO_CLIENT_SECRET="your-client-secret"
```

Common optional values:

```env
MONDO_AUDIENCE="https://api.example.com"
MONDO_SCOPE="openid profile email offline_access"

NEXT_PUBLIC_LOGIN_ROUTE="/auth/login"
NEXT_PUBLIC_SESSION_ROUTE="/auth/session"
NEXT_PUBLIC_ACCESS_TOKEN_ROUTE="/auth/access-token"
CALLBACK_ROUTE="/auth/callback"
LOGOUT_ROUTE="/auth/logout"
SESSION_ROUTE="/auth/session"
ACCESS_TOKEN_ROUTE="/auth/access-token"
POST_LOGOUT_REDIRECT_ROUTE="/"

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

You can also compose `auth.proxy()` with other proxy checks. This is useful
when one route family needs different behavior than the rest of the protected
app.

```ts
// src/proxy.ts
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

const publicPaths = ['/', '/pricing', /^\/blog(\/.*)?$/];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === '/healthz') {
    return Response.json({ ok: true });
  }

  if (pathname.startsWith('/api/webhooks/')) {
    const signature = request.headers.get('x-webhook-signature');

    if (signature !== process.env.WEBHOOK_SHARED_SECRET) {
      return new Response(null, { status: 401 });
    }

    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    const response = await auth.proxy(request, {
      returnTo: `${pathname}${search}`,
    });

    response?.headers.set('x-route-scope', 'admin');
    return response;
  }

  return auth.proxy(request, {
    publicPaths,
    returnTo: `${pathname}${search}`,
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
```

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

## Reading the User in Client Components

Client components can read the current user with the TanStack Query hook from
the focused user hook entry point. Your app must provide a
`QueryClientProvider`.

```sh
pnpm add @tanstack/react-query
```

```tsx
// src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

```tsx
'use client';

import { useUserProfile } from '@go-mondo/nextjs-auth/hooks';

type MondoClaims = {
  roles?: string[];
  org_id?: string;
};

export function ProfileButton() {
  const { data: user, isLoading } = useUserProfile<MondoClaims>();

  if (isLoading) {
    return null;
  }

  return <span>{user?.email ?? 'Signed out'}</span>;
}
```

The hook calls `/auth/session` by default and returns `undefined` for 401/403
responses. It can read either the default session JSON shape or a transformed
route that returns `session.user` directly.

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

Client components can request a current or refreshed access token with
`useAccessToken`. The server still owns the refresh token; browser code only
receives the short-lived access token returned by the mounted access-token
route.

```tsx
'use client';

import { useAccessToken } from '@go-mondo/nextjs-auth/hooks';

export function ReportsClient() {
  const { data: token } = useAccessToken({
    scopes: ['reports:read'],
    refresh: true,
  });

  return <button disabled={!token}>Load reports</button>;
}
```

When `scopes`, `refresh`, or `refreshBeforeExpiresIn` are provided, the hook
POSTs those options to `/auth/access-token`. The authorization server validates
whether requested scopes are allowed for the stored refresh token.

For imperative browser API clients, use `createAccessTokenProvider` so repeated
API calls do not hit `/auth/access-token` before every request. The cache is
memory-only, expires entries from the returned `expiresAt` value, and shares one
in-flight token request across concurrent callers.

```ts
// src/lib/api.ts
import { createAccessTokenProvider } from '@go-mondo/nextjs-auth/hooks';

const tokens = createAccessTokenProvider({
  scopes: ['reports:read'],
});

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { accessToken } = await tokens.getAccessToken();
  const headers = new Headers(init?.headers);

  headers.set('authorization', `Bearer ${accessToken}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
```

When the access-token route returns a non-2xx response, `fetchAccessToken` throws
a typed `FetchAccessTokenError` that app code can distinguish with `instanceof`:

```ts
// src/lib/api.ts
import {
  fetchAccessToken,
  FetchAccessTokenError,
  redirectToLogin,
} from '@go-mondo/nextjs-auth/hooks';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  let token;

  try {
    const result = await fetchAccessToken();
    token = result.accessToken;
  } catch (error) {
    if (error instanceof FetchAccessTokenError) {
      // Refresh failed or session expired; start a fresh login.
      await redirectToLogin();
      // Note: the browser navigates away, so this code does not execute.
    }
    throw error;
  }

  const headers = new Headers(init?.headers);
  headers.set('authorization', `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
```

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
  authorization: {
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

- `__Host-Mondo.Session`: user claims and session timestamps.
- `__Host-Mondo.Authorization`: access token, expiry, scopes, and refresh token.
- `__Host-Mondo.Authentication`: raw ID token.

This keeps the session stateless and tamper-proof while avoiding a server-side
session database. Login transaction verification is stored in
`__Host-Mondo.Verification`.

Cookies are HTTP-only by default. The default names use the `__Host-` prefix,
which requires secure, host-only cookies with `Path=/`. If you need domain-wide
cookies for subdomains, configure non-`__Host-` names such as `__Secure-Mondo`
and set the cookie domain explicitly.

For local development, `http://localhost` is normally handled specially by
browsers for secure cookies. Custom local hostnames served over plain HTTP may
need HTTPS or explicit non-prefixed development cookie names.

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
