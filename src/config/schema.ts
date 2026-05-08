import { z } from 'zod';

const RelativePathSchema = z
  .string()
  .startsWith('/', 'Must start with "/".')
  .refine((value) => !value.includes('//'), 'Must not contain "//".')
  .describe(
    'An application-relative path, such as "/auth/login". Double slashes are not allowed.',
  );

const StringUrlSchema = z
  .string()
  .url()
  .transform((value) => value.replace(/\/+$/, ''))
  .describe('An absolute URL. Trailing slashes are removed after parsing.');

const AuthorizationParamValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
]);

const SessionSchema = z
  .object({
    name: z
      .string()
      .optional()
      .default('Mondo')
      .describe('Cookie name prefix used for the session cookie set.'),
    duration: z
      .union([z.number().positive(), z.literal(false)])
      .default(24 * 60 * 60)
      .describe(
        'Rolling session duration in seconds. Set to false to disable rolling session updates.',
      ),
    cookie: z
      .object({
        domain: z
          .string()
          .optional()
          .describe('Optional domain shared by session cookies.'),
        path: RelativePathSchema.optional()
          .default('/')
          .describe('Path scope for session cookies.'),
        httpOnly: z
          .boolean()
          .optional()
          .default(true)
          .describe('Always true for server-managed authentication cookies.'),
        sameSite: z
          .enum(['lax', 'strict', 'none'])
          .optional()
          .default('lax')
          .describe('SameSite policy used for session cookies.'),
        secure: z
          .boolean()
          .default(true)
          .describe('Whether session cookies require HTTPS.'),
      })
      .describe('Cookie options for the tamper-proof iron-session cookies.'),
  })
  .describe('Application session storage and rolling expiration settings.');

const Schema = z
  .object({
    authorizationParams: z
      .object({
        response_type: z
          .enum(['code'])
          .default('code')
          .describe(
            'OAuth response type. This SDK uses authorization code flow.',
          ),
        scope: z
          .string()
          .default('openid profile email')
          .describe('Default scopes requested during login.'),
        response_mode: z
          .enum(['query', 'form_post'])
          .default('query')
          .describe(
            'How the authorization response is returned to the callback.',
          ),
        audience: z
          .string()
          .optional()
          .describe('Optional API audience for access token issuance.'),
        display: z
          .enum(['page', 'popup', 'touch', 'wap'])
          .optional()
          .describe(
            'OIDC display preference forwarded to the authorization URL.',
          ),
        prompt: z
          .enum(['none', 'login', 'consent', 'select_account'])
          .optional()
          .describe('OIDC prompt behavior forwarded to the authorization URL.'),
        max_age: z
          .number()
          .optional()
          .describe('Maximum authentication age, in seconds.'),
        ui_locales: z
          .string()
          .optional()
          .describe('Preferred UI locales sent to the identity provider.'),
        id_token_hint: z
          .string()
          .optional()
          .describe('Optional ID token hint sent to the identity provider.'),
        login_hint: z
          .string()
          .optional()
          .describe('Optional login hint sent to the identity provider.'),
        acr_values: z
          .string()
          .optional()
          .describe('Optional authentication context values.'),
      })
      .catchall(AuthorizationParamValueSchema)
      .describe(
        'Authorization URL parameters. Unknown string, number, and boolean values are preserved for provider-specific options.',
      ),
    baseURL: StringUrlSchema.describe(
      'Public application origin used to construct default redirect URLs.',
    ),
    clientId: z
      .string()
      .min(1)
      .describe('OIDC client identifier for this Next.js application.'),
    clientSecret: z
      .string()
      .min(1)
      .describe('OIDC client secret used for token endpoint authentication.'),
    issuerBaseURL: StringUrlSchema.describe(
      'Issuer origin used for OIDC discovery and logout redirects.',
    ),
    secret: z
      .union([z.string().min(32), z.array(z.string().min(32)).min(1)])
      .describe(
        'Secret or rotated secrets used by iron-session to seal transaction and session cookies.',
      ),
    session: SessionSchema,
    routes: z
      .object({
        login: RelativePathSchema.default('/auth/login').describe(
          'Route that starts the login transaction.',
        ),
        callback: RelativePathSchema.default('/auth/callback').describe(
          'Route that completes the authorization code exchange.',
        ),
        logout: RelativePathSchema.default('/auth/logout').describe(
          'Route that clears the application session.',
        ),
        session: RelativePathSchema.default('/auth/session').describe(
          'Route that returns the current session as JSON.',
        ),
        accessToken: RelativePathSchema.default('/auth/access-token').describe(
          'Route that returns or refreshes the current access token.',
        ),
        postLogoutRedirect: RelativePathSchema.default('/').describe(
          'Application path to redirect to after logout.',
        ),
      })
      .describe('Application routes mounted by the auth client.'),
    transaction: z
      .object({
        name: z
          .string()
          .default('Mondo.Verification')
          .describe(
            'Cookie name used to store login transaction verification.',
          ),
        cookie: z
          .object({
            domain: z
              .string()
              .optional()
              .describe('Optional domain shared by transaction cookies.'),
            secure: z
              .boolean()
              .optional()
              .describe('Whether transaction cookies require HTTPS.'),
            sameSite: z
              .enum(['lax', 'strict', 'none'])
              .default('lax')
              .describe('SameSite policy used for transaction cookies.'),
            path: RelativePathSchema.optional()
              .default('/')
              .describe('Path scope for transaction cookies.'),
          })
          .describe('Cookie options for temporary login transaction state.'),
      })
      .describe('Short-lived state used to verify authorization callbacks.'),
  })
  .describe('Validated configuration for @go-mondo/nextjs-auth.');

export default Schema;
