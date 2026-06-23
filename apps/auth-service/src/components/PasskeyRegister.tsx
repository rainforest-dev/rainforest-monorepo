import { startRegistration } from '@simplewebauthn/browser';
import { useState } from 'react';

export default function PasskeyRegister() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleRegister() {
    setStatus('loading');
    setMessage('');
    try {
      const optRes = await fetch('/api/register/begin', { method: 'POST' });
      if (!optRes.ok) throw new Error('Failed to get registration options');
      const options = await optRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const finishRes = await fetch('/api/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      if (!finishRes.ok) {
        const err = await finishRes.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || `Registration failed (${finishRes.status})`);
      }
      const result = await finishRes.json();
      if (!result.verified) throw new Error('Registration not verified');

      setStatus('success');
      setMessage('Passkey registered. You can now log in.');
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        setStatus('idle');
        setMessage('');
      } else {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Registration failed');
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleRegister}
        disabled={status === 'loading' || status === 'success'}
        className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {status === 'loading' ? 'Registering…' : 'Register Passkey'}
      </button>
      {message && (
        <p className={status === 'error' ? 'text-red-400' : 'text-green-400'}>{message}</p>
      )}
    </div>
  );
}
