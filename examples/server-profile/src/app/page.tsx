export default function HomePage() {
  return (
    <main style={{ margin: '48px auto', maxWidth: 720, padding: 24 }}>
      <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>
        Server component example
      </p>
      <h1 style={{ fontSize: 40, margin: '12px 0' }}>Mondo Identity</h1>
      <p style={{ color: '#334155', lineHeight: 1.6 }}>
        This example protects <code>/profile</code> with <code>proxy.ts</code>,
        then renders the authenticated user from a server component.
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        <a href="/auth/login?returnTo=/profile">Log in</a>
        <a href="/profile">View server profile</a>
        <a href="/auth/logout">Log out</a>
      </div>
    </main>
  );
}
