import { auth } from '@/lib/auth';

export default async function ProfilePage() {
  const session = await auth.getSession();

  return (
    <main style={{ margin: '48px auto', maxWidth: 860, padding: 24 }}>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        <a href="/">Home</a>
        <a href="/auth/logout">Log out</a>
      </nav>

      <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>
        Rendered on the server
      </p>
      <h1 style={{ fontSize: 40, margin: '12px 0' }}>
        {session?.user.name ?? session?.user.email ?? 'Signed in user'}
      </h1>
      <p style={{ color: '#334155', lineHeight: 1.6 }}>
        These claims came from <code>auth.getSession()</code> in a server
        component.
      </p>

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
        {JSON.stringify(session?.user, null, 2)}
      </pre>
    </main>
  );
}
