import { auth } from '@/lib/auth';

export function proxy(request: Request) {
  return auth.proxy(request);
}

export const config = {
  matcher: ['/profile/:path*'],
};
