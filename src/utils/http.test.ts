import { describe, expect, it } from 'vitest';
import type { Config } from '../config/types';
import {
  getAuthorizationRedirectURL,
  pathOrURLToURL,
  toSafeRedirect,
} from './http';

const config = {
  baseURL: 'https://app.example.com',
  routes: {
    callback: '/auth/callback',
  },
} as Config;

describe('http utils', () => {
  describe('toSafeRedirect', () => {
    it('allows redirects on the same origin', () => {
      expect(
        toSafeRedirect('/dashboard', new URL('https://app.example.com')),
      ).toBe('https://app.example.com/dashboard');
    });

    it('blocks redirects to a different origin', () => {
      expect(
        toSafeRedirect('https://evil.example.com', new URL(config.baseURL)),
      ).toBeUndefined();
    });
  });

  describe('pathOrURLToURL', () => {
    it('returns absolute URLs unchanged', () => {
      expect(
        pathOrURLToURL(config, 'https://identity.example.com/callback').href,
      ).toBe('https://identity.example.com/callback');
    });

    it('resolves relative paths against the configured base URL', () => {
      expect(pathOrURLToURL(config, '/profile').href).toBe(
        'https://app.example.com/profile',
      );
    });

    it('prefers the request origin when provided', () => {
      expect(
        getAuthorizationRedirectURL(config, 'https://preview.example.com').href,
      ).toBe('https://preview.example.com/auth/callback');
    });
  });
});
