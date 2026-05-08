import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/client.ts',
    'src/config.ts',
    'src/errors.ts',
    'src/oidc.ts',
    'src/session.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
  external: [
    'cookie',
    'iron-session',
    'next',
    'next/headers.js',
    'next/server.js',
    'openid-client',
    'zod',
  ],
});
