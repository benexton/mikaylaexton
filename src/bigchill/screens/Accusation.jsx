import { useState } from 'react';
import BackButton from '../components/BackButton.jsx';

const FLASH_MS = 1800;

// The deduction finale. A wrong guess in story mode is handled gently -
// "look again" - rather than penalised (race mode's timer penalty is a
// later milestone). The culprit id is checked server side via onGuess (see
// bigchillSupabase.js's submitAccusation) - it's never compared in this
// component, so it's never in the client bundle either.
//
// No summary of evidence lives on this screen any more - the case file
// (numbers + the group's own notes from every interview) is the single
// source of truth, opened from here the same way it's opened mid-stop.
export default function Accusation({ suspects, onGuess, onCorrect, onOpenCaseFile, onBack }) {
  const [wrongName, setWrongName] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(null); // null | 'wrong'

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
        setFlash('wrong');
        setTimeout(() => setFlash(null), FLASH_MS);
      }
    } catch (err) {
      setError(err.message || 'Could not check that guess. Try again.');
    }
    setBusy(false);
  }

  return (
    <div className="bc-screen bc-stop bc-accusation">
      {flash && <div className={`bc-answer-flash bc-answer-flash-${flash}`} />}
      <BackButton onClick={onBack} />
      <div className="bc-stop-header">
        <p className="bc-kicker">The accusation</p>
        <h2 className="bc-startgate-title">Who stole the heat?</h2>
        {onOpenCaseFile && (
          <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={onOpenCaseFile}>
            Case file
          </button>
        )}
      </div>

      <p className="bc-startgate-sub">
        Check every number and note you gathered before you make the call.
      </p>

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
