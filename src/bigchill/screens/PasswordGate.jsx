import { useState } from 'react';
import { redeemPassword } from '../lib/bigchillSupabase.js';

// The very first screen. Redeeming here (see bigchill-redeem-password)
// burns the code immediately, whether or not the group ever finishes
// playing - see BigChillApp's onSuccess for the localStorage note on why a
// stray page reload doesn't burn a second one.
export default function PasswordGate({ onSuccess }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await redeemPassword(trimmed);
      if (result.ok) {
        onSuccess(trimmed);
      } else {
        setError(result.error || 'That code is invalid or has already been used.');
      }
    } catch (err) {
      setError(err.message || 'Could not check that code. Try again.');
    }
    setBusy(false);
  }

  return (
    <div className="bc-screen bc-startgate">
      <span className="bc-startgate-icon" role="img" aria-label="Key">
        &#128273;
      </span>
      <p className="bc-kicker">Hanmer Springs</p>
      <h1 className="bc-startgate-title">Enter your code</h1>
      <p className="bc-startgate-sub">
        Your one-time play code unlocks the case. Each code only works once, so type it carefully.
      </p>
      <form className="bc-password-form" onSubmit={handleSubmit}>
        <input
          className="bc-password-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Your code"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          disabled={busy}
        />
        {error && <p className="bc-password-error">{error}</p>}
        <button className="bc-btn bc-btn-primary" type="submit" disabled={busy || !code.trim()}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
