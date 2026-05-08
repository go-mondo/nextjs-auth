# Client Profile Example

This example fetches and displays the authenticated session from a client
component.

## Setup

```sh
cp .env.example .env.local
pnpm --filter @go-mondo/nextjs-auth-example-client-profile dev
```

Fill in `.env.local` with your own Mondo Identity OIDC application
credentials. The application callback URL should be:

```txt
http://localhost:3002/auth/callback
```

The logout redirect URL should be:

```txt
http://localhost:3002/
```

Visit `http://localhost:3002`, log in, and open `/profile`.
