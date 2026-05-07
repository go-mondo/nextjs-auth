import { parse, serialize, type SerializeOptions } from 'cookie';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { cookies } from 'next/headers.js';

/**
 * {@link https://wicg.github.io/cookie-store/#dictdef-cookielistitem CookieListItem}
 * as specified by W3C.
 */
interface CookieListItem
  extends Pick<SerializeOptions, 'domain' | 'path' | 'sameSite' | 'secure'> {
  /** A string with the name of a cookie. */
  name: string;
  /** A string containing the value of the cookie. */
  value: string;
  /** A number of milliseconds or Date interface containing the expires of the cookie. */
  // expires?: SerializeOptions["expires"] | number;
}

// /**
//  * Superset of {@link CookieListItem} extending it with
//  * the `httpOnly`, `maxAge` and `priority` properties.
//  */
type ResponseCookie = CookieListItem &
  Pick<SerializeOptions, 'httpOnly' | 'maxAge' | 'priority'>;

/**
 * The high-level type definition of the .get() and .set() methods
 * of { cookies() } from "next/headers"
 */
export interface CookieStore {
  get: (name: string) => { name: string; value: string } | undefined;
  set: {
    (name: string, value: string, cookie?: Partial<ResponseCookie>): void;
    (options: ResponseCookie): void;
  };
}

type RequestType = IncomingMessage | Request;
type ResponseType = Response | ServerResponse;

export async function cookieFactory(
  req?: RequestType,
  res?: ResponseType,
): Promise<CookieStore> {
  if (req && res) {
    return new HttpCookieStore(req, res);
  }

  return cookies();
}

export function OLDcookieFactory(): CookieFactory {
  return async (req?: RequestType, res?: ResponseType): Promise<CookieStore> =>
    cookieFactory(req, res);
}

export type CookieFactory = (
  req?: RequestType,
  res?: ResponseType,
) => Promise<CookieStore>;

export class HttpCookieStore implements CookieStore {
  constructor(
    readonly req: RequestType,
    readonly res?: ResponseType,
  ) {}

  get(cookieName: string): { name: string; value: string } | undefined {
    return {
      name: cookieName,
      value:
        parse(
          ('headers' in this.req && typeof this.req.headers.get === 'function'
            ? this.req.headers.get('cookie')
            : (this.req as IncomingMessage).headers.cookie) ?? '',
        )[cookieName] ?? '',
    };
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

  /**
   * Set a cookie
   *
   * @param name
   * @param value
   * @param cookie
   * @returns
   */
  private setCookie(
    name: string,
    value: string,
    cookie?: Partial<ResponseCookie>,
  ) {
    if (!this.res) {
      return;
    }

    const cookieValue = serialize(name, value, cookie);

    if (
      'headers' in this.res &&
      typeof this.res.headers.append === 'function'
    ) {
      this.res.headers.append('set-cookie', cookieValue);
      return;
    }
    let existingSetCookie =
      (this.res as ServerResponse).getHeader('set-cookie') ?? [];
    if (!Array.isArray(existingSetCookie)) {
      existingSetCookie = [existingSetCookie.toString()];
    }
    (this.res as ServerResponse).setHeader('set-cookie', [
      ...existingSetCookie,
      cookieValue,
    ]);
  }
}
