import { parse, serialize, type SerializeOptions } from 'cookie';
import { cookies } from 'next/headers.js';

interface CookieListItem
  extends Pick<SerializeOptions, 'domain' | 'path' | 'sameSite' | 'secure'> {
  name: string;
  value: string;
}

type ResponseCookie = CookieListItem &
  Pick<SerializeOptions, 'httpOnly' | 'maxAge' | 'priority'>;

/**
 * Minimal cookie API shared by `next/headers` cookies and request/response
 * adapters used in route handlers and proxy.
 */
export interface CookieStore {
  get: (name: string) => { name: string; value: string } | undefined;
  set: {
    (name: string, value: string, cookie?: Partial<ResponseCookie>): void;
    (options: ResponseCookie): void;
  };
}

/**
 * Returns a cookie store for the current execution context.
 *
 * Without a request it delegates to Next.js `cookies()`. With a request it
 * adapts Web `Request`/`Response` objects so session updates can append
 * `Set-Cookie` headers.
 */
export async function cookieFactory(
  req?: Request,
  res?: Response,
): Promise<CookieStore> {
  if (req) {
    return new HttpCookieStore(req, res);
  }

  return cookies();
}

/**
 * Cookie store adapter for Web `Request` and `Response` objects.
 */
export class HttpCookieStore implements CookieStore {
  constructor(
    readonly req: Request,
    readonly res?: Response,
  ) {}

  get(cookieName: string): { name: string; value: string } | undefined {
    const value = parse(this.req.headers.get('cookie') ?? '')[cookieName];

    return value === undefined ? undefined : { name: cookieName, value };
  }

  set(name: string, value: string, cookie?: Partial<ResponseCookie>): void;
  set(options: ResponseCookie): void;
  set(
    nameOrOptions: string | ResponseCookie,
    value?: string,
    cookie?: Partial<ResponseCookie>,
  ) {
    if (typeof nameOrOptions === 'string') {
      return this.setCookie(nameOrOptions, value as string, cookie);
    }

    return this.setCookie(
      nameOrOptions.name,
      nameOrOptions.value,
      nameOrOptions,
    );
  }

  private setCookie(
    name: string,
    value: string,
    cookie?: Partial<ResponseCookie>,
  ) {
    if (!this.res) {
      return;
    }

    const cookieValue = serialize(name, value, cookie);

    this.res.headers.append('set-cookie', cookieValue);
  }
}
