import { describe, expect, it } from 'vitest';
import { HttpCookieStore } from './cookies';

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
