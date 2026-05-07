import { z } from 'zod';

const sessionSchema = z.object({
  name: z.string().optional().default('Mondo'),
  duration: z.number().default(24 * 60 * 60), // 1 day when rolling is enabled, else false
  cookie: z.object({
    domain: z.string().optional(),
    path: z.string().optional(), // TODO - validate relative only uri
    httpOnly: z.boolean().optional().default(true),
    sameSite: z.enum(['lax', 'strict', 'none']).optional().default('lax'),
    secure: z.boolean().default(true),
  }),
});

const schema = z.object({
  authorizationParams: z.object({
    response_type: z.enum(['code']).default('code'),
    scope: z.string().default('openid profile email'),
    response_mode: z.enum(['query', 'form_post']).default('query'),
  }),
  baseURL: z.string().url(),
  clientId: z.string(),
  clientSecret: z.string().optional(),
  issuerBaseURL: z.string().url(),
  secret: z.union([z.string().min(8), z.array(z.string().min(8))]),
  session: sessionSchema,
  routes: z.object({
    login: z.string().default('/auth/login'), // TODO - Validate for relative only
    callback: z.string().default('/auth/callback'), // TODO - Validate for relative only
    postLogoutRedirect: z.string().default('/'), // TODO - Validate for relative optional
  }),
  transaction: z.object({
    name: z.string().default('Mondo.Verification'),
    cookie: z.object({
      domain: z.string().optional(),
      secure: z.boolean().optional(),
      sameSite: z.enum(['lax', 'strict', 'none']).default('lax'),
      path: z.string().optional(),
    }),
  }),
});

export default schema;
