import { startAuthentication } from '@simplewebauthn/browser';
import { useState } from 'react';

export default function PasskeyLogin({ redirect }: { redirect: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleLogin() {
    setStatus('loading');
    setMessage('');
    try {
      const optRes = await fetch('/api/login/begin', { method: 'POST' });
      if (!optRes.ok) {
        const err = await optRes.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || `Failed to get login options (${optRes.status})`);
      }
      const options = await optRes.json();

      const credential = await startAuthentication({ optionsJSON: options });

      const finishRes = await fetch('/api/login/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credential, redirect }),
      });
      if (!finishRes.ok) {
        const err = await finishRes.json().catch(() => ({ error: 'Authentication failed' }));
        throw new Error(err.error || `Login failed (${finishRes.status})`);
      }
      const result = await finishRes.json();
      if (!result.verified) throw new Error('Authentication failed');

      window.location.href = result.redirect;
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        setStatus('idle');
        setMessage('');
      } else {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Login failed');
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleLogin}
        disabled={status === 'loading'}
        className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {status === 'loading' ? 'Authenticating…' : 'Sign in with Passkey'}
      </button>
      {message && <p className="text-red-400 text-sm">{message}</p>}
    </div>
  );
}
