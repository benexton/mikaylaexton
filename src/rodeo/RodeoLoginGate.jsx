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
  const [info, setInfo] = useState('');
  // True after arriving from a password-reset email: Supabase has signed the
  // user in with a short-lived recovery session, and we must ask for the new
  // password before letting them into HQ.
  const [recovering, setRecovering] = useState(
    () => typeof window !== 'undefined' && /type=recovery/.test(window.location.hash)
  );
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    rodeo.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = rodeo.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendReset() {
    if (!email) { setErr('Type the team email above first.'); return; }
    setBusy(true); setErr(''); setInfo('');
    // Must be listed under Supabase > Authentication > URL Configuration >
    // Redirect URLs, or Supabase falls back to the project's Site URL.
    const { error } = await rodeo.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/rodeo-hq/`,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setInfo('Reset email sent. Open the link on this device to choose a new password.');
  }

  async function setPasswordFromReset(e) {
    e.preventDefault();
    if (newPassword.length < 8) { setErr('Use at least 8 characters.'); return; }
    setBusy(true); setErr('');
    const { error } = await rodeo.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setRecovering(false);
    setNewPassword('');
    window.history.replaceState(null, '', window.location.pathname);
  }

  async function signIn(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await rodeo.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
  }

  async function signOut() { await rodeo.auth.signOut(); }

  if (!ready) return <div className="rodeo-loading">Saddling up...</div>;

  if (session && recovering) {
    return (
      <div className="rodeo-login">
        <div className="rodeo-login-card">
          <div className="rodeo-login-brand">
            <span className="rodeo-kicker">The Rodeo</span>
            <h1>New password</h1>
            <p className="rodeo-muted">Choose a new password for {session.user.email}.</p>
          </div>
          <form onSubmit={setPasswordFromReset}>
            <label htmlFor="newpw">New password</label>
            <input id="newpw" type="password" autoComplete="new-password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} required />
            <button className="rodeo-btn" type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Save and enter'}
            </button>
            {err && <p className="rodeo-err">{err}</p>}
          </form>
        </div>
      </div>
    );
  }

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
            {info && <p className="rodeo-hint">{info}</p>}
          </form>
          <button type="button" className="rodeo-btn ghost small" onClick={sendReset} disabled={busy}>
            Forgot password?
          </button>
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
