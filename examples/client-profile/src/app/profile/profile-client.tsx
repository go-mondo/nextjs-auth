'use client';

import { useUserProfile } from '@go-mondo/nextjs-auth/hooks';

export function ProfileClient() {
  const { data: user, error, isPending } = useUserProfile();

  return (
    <section>
      <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>
        Rendered in the browser
      </p>
      <h1 style={{ fontSize: 40, margin: '12px 0' }}>Client profile</h1>
      <p style={{ color: '#334155', lineHeight: 1.6 }}>
        This component reads the current user with <code>useUserProfile()</code>
        .
      </p>

      {isPending ? (
        <p>Loading session...</p>
      ) : error ? (
        <p style={{ color: '#b91c1c' }}>{error.message}</p>
      ) : !user ? (
        <p>No signed-in user.</p>
      ) : (
        <pre
          style={{
            background: '#0f172a',
            borderRadius: 8,
            color: '#e2e8f0',
            marginTop: 24,
            overflow: 'auto',
            padding: 20,
          }}
        >
          {JSON.stringify(user, null, 2)}
        </pre>
      )}
    </section>
  );
}
