import { useState } from 'react';
import BackButton from '../components/BackButton.jsx';

// The deduction finale. A wrong guess in story mode is handled gently -
// "look again" - rather than penalised (race mode's timer penalty is a
// later milestone). The culprit id is checked server side via onGuess (see
// bigchillSupabase.js's submitAccusation) - it's never compared in this
// component, so it's never in the client bundle either.
export default function Accusation({ suspects, tells, onGuess, onCorrect, onBack }) {
  const [wrongName, setWrongName] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function accuse(suspect) {
    if (busy) return;
    setBusy(true);
    setError('');
    setWrongName(null);
    try {
      const correct = await onGuess(suspect.id);
      if (correct) {
        onCorrect();
      } else {
        setWrongName(suspect.name);
      }
    } catch (err) {
      setError(err.message || 'Could not check that guess. Try again.');
    }
    setBusy(false);
  }

  return (
    <div className="bc-screen bc-stop bc-accusation">
      <BackButton onClick={onBack} />
      <div className="bc-stop-header">
        <p className="bc-kicker">The accusation</p>
        <h2 className="bc-startgate-title">Who stole the heat?</h2>
      </div>

      <div className="bc-card">
        <h3>The case board</h3>
        <div className="bc-case-table-wrap">
          <table className="bc-case-table">
            <thead>
              <tr>
                <th></th>
                {suspects.map((s) => (
                  <th key={s.id}>{s.name.split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tells.map((tell) => (
                <tr key={tell.id}>
                  <th>{tell.label}</th>
                  {suspects.map((s) => (
                    <td key={s.id}>{s.traits[tell.id] ? '✓' : '✗'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="bc-card bc-wrong-card">
          <p>{error}</p>
        </div>
      )}

      {wrongName && (
        <div className="bc-card bc-wrong-card">
          <p>{wrongName} isn&rsquo;t the one. Look at the evidence again.</p>
        </div>
      )}

      <div className="bc-accusation-grid">
        {suspects.map((s) => (
          <button key={s.id} className="bc-btn bc-btn-primary" disabled={busy} onClick={() => accuse(s)}>
            Accuse {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
