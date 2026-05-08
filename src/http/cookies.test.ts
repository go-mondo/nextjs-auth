import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
}));

vi.mock('next/headers.js', () => ({
  cookies: mocks.cookies,
}));

const { HttpCookieStore, cookieFactory } = await import('./cookies');

describe('cookieFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to Next cookies when a request is not provided', async () => {
    const nextCookieStore = { get: vi.fn(), set: vi.fn() };
    mocks.cookies.mockResolvedValue(nextCookieStore);

    await expect(cookieFactory()).resolves.toBe(nextCookieStore);
    expect(mocks.cookies).toHaveBeenCalledWith();
  });

  it('uses the HTTP cookie adapter when a request is provided', async () => {
    const response = new Response();
    const store = await cookieFactory(
      new Request('https://app.example.com', {
        headers: { cookie: 'session=abc123' },
      }),
      response,
    );

    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(store).toBeInstanceOf(HttpCookieStore);
    expect(store.get('session')).toEqual({ name: 'session', value: 'abc123' });

    store.set('session', 'updated', { path: '/', secure: true });

    expect(response.headers.get('set-cookie')).toBe(
      'session=updated; Path=/; Secure',
    );
  });
});

describe('HttpCookieStore', () => {
  it('reads cookies from the request header', () => {
    const store = new HttpCookieStore(
      new Request('https://app.example.com', {
        headers: { cookie: 'first=one; session=abc123' },
      }),
    );

    expect(store.get('session')).toEqual({ name: 'session', value: 'abc123' });
    expect(store.get('missing')).toBeUndefined();
  });

  it('appends serialized cookies to the response', () => {
    const response = new Response();
    const store = new HttpCookieStore(
      new Request('https://app.example.com'),
      response,
    );

    store.set('session', 'abc123', {
      httpOnly: true,
      maxAge: 60,
      path: '/',
      sameSite: 'lax',
      secure: true,
    });

    expect(response.headers.get('set-cookie')).toBe(
      'session=abc123; Max-Age=60; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
  });

  it('accepts object-form cookies', () => {
    const response = new Response();
    const store = new HttpCookieStore(
      new Request('https://app.example.com'),
      response,
    );

    store.set({
      name: 'transaction',
      value: 'state',
      path: '/',
      secure: true,
    });

    expect(response.headers.get('set-cookie')).toBe(
      'transaction=state; Path=/; Secure',
    );
  });

  it('does not throw when a response is not available', () => {
    const store = new HttpCookieStore(new Request('https://app.example.com'));

    expect(() => store.set('session', 'abc123')).not.toThrow();
  });
});
