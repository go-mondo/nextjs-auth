import { ProfileClient } from './profile-client';

export default function ProfilePage() {
  return (
    <main style={{ margin: '48px auto', maxWidth: 860, padding: 24 }}>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        <a href="/">Home</a>
        <a href="/auth/logout">Log out</a>
      </nav>
      <ProfileClient />
    </main>
  );
}
