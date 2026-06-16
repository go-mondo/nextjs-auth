import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLoginUrl } from './login';

describe('buildLoginUrl', () => {
  const originalEnv = process.env.NEXT_PUBLIC_LOGIN_ROUTE;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_LOGIN_ROUTE;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_LOGIN_ROUTE;
    } else {
      process.env.NEXT_PUBLIC_LOGIN_ROUTE = originalEnv;
    }
  });

  it('returns the default login route', () => {
    const url = buildLoginUrl();
    expect(url).toEqual('/auth/login?returnTo=%2F');
  });

  it('uses NEXT_PUBLIC_LOGIN_ROUTE when set', () => {
    process.env.NEXT_PUBLIC_LOGIN_ROUTE = '/custom/login';
    const url = buildLoginUrl();
    expect(url).toEqual('/custom/login?returnTo=%2F');
  });

  it('preserves absolute NEXT_PUBLIC_LOGIN_ROUTE when set', () => {
    process.env.NEXT_PUBLIC_LOGIN_ROUTE = 'https://auth.example.com/login';
    const url = buildLoginUrl();
    expect(url).toEqual('https://auth.example.com/login?returnTo=%2F');
  });

  it('includes explicit returnTo', () => {
    const url = buildLoginUrl({ returnTo: '/dashboard?tab=reports' });
    expect(url).toEqual('/auth/login?returnTo=%2Fdashboard%3Ftab%3Dreports');
  });

  it('encodes returnTo with special characters', () => {
    const url = buildLoginUrl({
      returnTo: '/path with spaces?foo=bar&baz=qux',
    });
    // URLSearchParams encodes spaces as `+` which is valid per RFC 3986.
    expect(url).toEqual(
      '/auth/login?returnTo=%2Fpath+with+spaces%3Ffoo%3Dbar%26baz%3Dqux',
    );
  });

  it('defaults returnTo to current window location in the browser', () => {
    vi.stubGlobal('window', {
      location: {
        pathname: '/app/profile',
        search: '?id=42',
      },
    });

    const url = buildLoginUrl();
    expect(url).toEqual('/auth/login?returnTo=%2Fapp%2Fprofile%3Fid%3D42');

    vi.unstubAllGlobals();
  });

  it('does not override explicit returnTo with window.location', () => {
    vi.stubGlobal('window', {
      location: {
        pathname: '/ignored',
        search: '',
      },
    });

    const url = buildLoginUrl({ returnTo: '/explicit' });
    expect(url).toEqual('/auth/login?returnTo=%2Fexplicit');

    vi.unstubAllGlobals();
  });
});

describe('redirectToLogin', () => {
  const originalEnv = process.env.NEXT_PUBLIC_LOGIN_ROUTE;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_LOGIN_ROUTE;
    // Reset the module-level redirect guard before each test.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_LOGIN_ROUTE;
    } else {
      process.env.NEXT_PUBLIC_LOGIN_ROUTE = originalEnv;
    }
    vi.unstubAllGlobals();
  });

  it('throws when called outside the browser', async () => {
    const { redirectToLogin } = await import('./login');
    vi.stubGlobal('window', undefined);
    await expect(redirectToLogin()).rejects.toThrow(
      'redirectToLogin can only be called from browser code.',
    );
  });

  it('calls window.location.assign by default', async () => {
    const { redirectToLogin } = await import('./login');
    const url = '/auth/login?returnTo=%2Fcurrent';
    const assign = vi.fn();
    const addEventListener = vi.fn();
    const location = {
      pathname: '/current',
      search: '',
      assign,
    };
    const stubWindow = {
      location,
      addEventListener,
    } as Record<string, unknown>;
    vi.stubGlobal('window', stubWindow);

    await redirectToLogin();

    expect(assign).toHaveBeenCalledWith(url);
  });

  it('calls window.location.replace when replace is true', async () => {
    const { redirectToLogin } = await import('./login');
    const replace = vi.fn();
    const addEventListener = vi.fn();
    const location = {
      pathname: '/current',
      search: '',
      replace,
    };
    const stubWindow = {
      location,
      addEventListener,
    } as Record<string, unknown>;
    vi.stubGlobal('window', stubWindow);

    await redirectToLogin({ replace: true });

    expect(replace).toHaveBeenCalledWith('/auth/login?returnTo=%2Fcurrent');
  });

  it('uses explicit returnTo', async () => {
    const { redirectToLogin } = await import('./login');
    const assign = vi.fn();
    const addEventListener = vi.fn();
    const location = {
      pathname: '/current',
      search: '',
      assign,
    };
    const stubWindow = {
      location,
      addEventListener,
    } as Record<string, unknown>;
    vi.stubGlobal('window', stubWindow);

    await redirectToLogin({ returnTo: '/custom-redirect' });

    expect(assign).toHaveBeenCalledWith(
      '/auth/login?returnTo=%2Fcustom-redirect',
    );
  });
});
