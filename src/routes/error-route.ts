import { NextResponse } from 'next/server.js';
import type { Config } from '../config/types';

export function redirectToErrorRoute(
  config: Config,
  route: string,
  error: string,
): Response {
  const redirectUrl = new URL(route, config.baseURL);
  redirectUrl.searchParams.set('error', error);

  return NextResponse.redirect(redirectUrl);
}
