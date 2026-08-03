import { useEffect, useState } from 'react';
import { rodeo, teamOf, TEAMS } from './rodeoSupabase.js';

// Gate for the Rodeo HQ. Two shared logins, one per team, each tagged with
// user_metadata.team = 'ben' | 'miki' (set when you create the users). Renders
// children({ session, team, teamName, signOut }) once signed in.
export default function RodeoLoginGate({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rodeo.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = rodeo.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await rodeo.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
  }

  async function signOut() { await rodeo.auth.signOut(); }

  if (!ready) return <div className="rodeo-loading">Saddling up...</div>;

  if (!session) {
    return (
      <div className="rodeo-login">
        <div className="rodeo-login-card">
          <div className="rodeo-login-brand">
            <span className="rodeo-kicker">The Rodeo</span>
            <h1>Bosphorus or Bust</h1>
            <p className="rodeo-muted">Team HQ. Sign in to file your leg.</p>
          </div>
          <form onSubmit={signIn}>
            <label htmlFor="email">Team email</label>
            <input id="email" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
            <button className="rodeo-btn" type="submit" disabled={busy}>
              {busy ? 'Signing in...' : 'Enter the arena'}
            </button>
            {err && <p className="rodeo-err">{err}</p>}
          </form>
          <p className="rodeo-hint">Two logins: one for Ben &amp; John, one for Miki &amp; Bruce.</p>
        </div>
      </div>
    );
  }

  const team = teamOf(session);
  if (!team || !TEAMS[team]) {
    return (
      <div className="rodeo-login">
        <div className="rodeo-login-card">
          <h2>Account not on a team</h2>
          <p className="rodeo-muted">
            This login has no <code>user_metadata.team</code> set. Set it to
            <code> "ben"</code> or <code>"miki"</code> in Supabase, then sign in again.
          </p>
          <button className="rodeo-btn ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return children({ session, team, teamName: TEAMS[team].name, signOut });
}
