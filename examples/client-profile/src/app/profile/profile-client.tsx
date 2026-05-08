'use client';

import { useEffect, useState } from 'react';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; session: unknown }
  | { status: 'error'; message: string };

export function ProfileClient() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      const response = await fetch('/auth/session', {
        credentials: 'same-origin',
      });
      const json = await response.json();

      if (ignore) {
        return;
      }

      if (!response.ok) {
        setState({
          status: 'error',
          message:
            typeof json?.error_description === 'string'
              ? json.error_description
              : 'Unable to load the current session.',
        });
        return;
      }

      setState({ status: 'loaded', session: json });
    }

    loadSession().catch((error: unknown) => {
      if (!ignore) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section>
      <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>
        Rendered in the browser
      </p>
      <h1 style={{ fontSize: 40, margin: '12px 0' }}>Client profile</h1>
      <p style={{ color: '#334155', lineHeight: 1.6 }}>
        This component calls <code>/auth/session</code> after the page loads and
        renders the JSON response.
      </p>

      {state.status === 'loading' ? (
        <p>Loading session...</p>
      ) : state.status === 'error' ? (
        <p style={{ color: '#b91c1c' }}>{state.message}</p>
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
          {JSON.stringify(state.session, null, 2)}
        </pre>
      )}
    </section>
  );
}
