import { useState } from 'react';
import { fetchPasswordList } from './lib/bigchillAdmin.js';
import { writePreviewProgress } from './lib/progressStorage.js';

function formatElapsed(seconds) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// A separate hidden page (the-big-chill/admin/), not part of the game's own
// phase flow in BigChillApp.jsx - see bigchill-admin-list for why a shared
// password checked server-side is enough protection for a single-family
// party game's code list.
export default function AdminApp() {
  const [password, setPassword] = useState('');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError('');
    try {
      setRows(await fetchPasswordList(password));
    } catch (err) {
      setError(err.message || 'Could not load the list.');
    }
    setBusy(false);
  }

  if (!rows) {
    return (
      <div className="bc-app">
        <div className="bc-screen">
          <p className="bc-kicker">The Big Chill</p>
          <h1 className="bc-startgate-title">Admin</h1>
          <form className="bc-password-form" onSubmit={handleSubmit}>
            <input
              className="bc-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              autoComplete="off"
              disabled={busy}
            />
            {error && <p className="bc-password-error">{error}</p>}
            <button className="bc-btn bc-btn-primary" type="submit" disabled={busy || !password}>
              {busy ? 'Checking…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const usedCount = rows.filter((r) => r.used_at).length;

  return (
    <div className="bc-app">
      <div className="bc-screen bc-admin-screen">
        <p className="bc-kicker">The Big Chill</p>
        <h1 className="bc-startgate-title">Codes</h1>
        <p className="bc-startgate-sub">
          {usedCount} of {rows.length} codes used.
        </p>
        {/* Writes a fake, never-inserted code straight into this browser's
            local game state and opens the real game on it - trial runs
            never touch the real one-time-code pool (see PREVIEW_CODE). */}
        <a
          className="bc-btn bc-btn-ghost"
          href="/the-big-chill/"
          target="_blank"
          rel="noopener"
          onClick={writePreviewProgress}
        >
          Launch game (skip code)
        </a>
        <div className="bc-admin-table-wrap">
          <table className="bc-admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Used</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}>
                  <td>{r.code}</td>
                  <td>{r.used_at ? new Date(r.used_at).toLocaleString() : '—'}</td>
                  <td>{formatElapsed(r.elapsed_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
