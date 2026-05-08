# Server Profile Example

This example shows the authenticated user from a server component.

## Setup

```sh
cp .env.example .env.local
pnpm --filter @go-mondo/nextjs-auth-example-server-profile dev
```

Fill in `.env.local` with your own Mondo Identity OIDC application
credentials. The application callback URL should be:

```txt
http://localhost:3001/auth/callback
```

The logout redirect URL should be:

```txt
http://localhost:3001/
```

Visit `http://localhost:3001`, log in, and open `/profile`.
