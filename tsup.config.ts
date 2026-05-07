import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.test.ts'],
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
    'next/navigation.js',
    'next/server.js',
    'node:http',
    'openid-client',
    'zod',
  ],
});
