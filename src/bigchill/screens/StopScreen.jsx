import { useState } from 'react';
import VideoCharacter from '../components/VideoCharacter.jsx';
import BackButton from '../components/BackButton.jsx';

// One stop, end to end: optional suspect video + interrogation, the group
// puzzle, the separate Junior Detective strip, then the evidence recap.
// Reused for all six stops - stop 1 has no suspect, so those sections just
// don't render.
export default function StopScreen({ stop, suspect, juniorNames, onComplete, onOpenCaseFile, onBack }) {
  const [suspectSeen, setSuspectSeen] = useState(!stop.suspectId);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [askedQuestionIds, setAskedQuestionIds] = useState([]);
  const [hintIndex, setHintIndex] = useState(-1);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [juniorDone, setJuniorDone] = useState(false);
  const [juniorCount, setJuniorCount] = useState('');
  const [showEvidence, setShowEvidence] = useState(false);

  function handleBack() {
    if (showEvidence) {
      setShowEvidence(false);
      return;
    }
    if (activeQuestionId) {
      setActiveQuestionId(null);
      return;
    }
    if (suspectSeen && suspect) {
      setSuspectSeen(false);
      return;
    }
    onBack?.();
  }

  if (!suspectSeen) {
    return (
      <div className="bc-screen bc-stop">
        <BackButton onClick={handleBack} />
        <VideoCharacter clip={suspect?.introClip} name={suspect?.name} onDone={() => setSuspectSeen(true)} />
      </div>
    );
  }

  if (showEvidence) {
    return (
      <div className="bc-screen bc-stop">
        <BackButton onClick={handleBack} />
        <div className="bc-card bc-evidence-card">
          <h3>Case file updated</h3>
          <p>{stop.evidenceLabel}</p>
        </div>
        <button className="bc-btn bc-btn-primary" onClick={onComplete}>
          Continue
        </button>
      </div>
    );
  }

  const activeQuestion = suspect?.questions.find((q) => q.id === activeQuestionId);
  const hasJuniors = juniorNames && juniorNames.length > 0;

  return (
    <div className="bc-screen bc-stop">
      <BackButton onClick={handleBack} />

      <div className="bc-stop-header">
        <p className="bc-kicker">Stop {stop.order}</p>
        <h2 className="bc-stop-title">{stop.title}</h2>
        <p className="bc-stop-location">{stop.locationLabel}</p>
        {onOpenCaseFile && (
          <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={onOpenCaseFile}>
            Case file
          </button>
        )}
      </div>

      {suspect && (
        <div className="bc-card">
          <h3>Interrogate {suspect.name}</h3>
          {activeQuestion ? (
            <VideoCharacter
              clip={activeQuestion.answerClip}
              name={suspect.name}
              onDone={() => {
                setAskedQuestionIds((ids) =>
                  ids.includes(activeQuestion.id) ? ids : [...ids, activeQuestion.id]
                );
                setActiveQuestionId(null);
              }}
            />
          ) : (
            <div className="bc-question-list">
              {suspect.questions.map((q) => (
                <button
                  key={q.id}
                  className="bc-btn bc-btn-ghost bc-question-btn"
                  onClick={() => setActiveQuestionId(q.id)}
                >
                  {q.prompt}
                  {askedQuestionIds.includes(q.id) && <span className="bc-kicker"> Asked</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bc-card">
        <h3>The puzzle</h3>
        <p>{stop.puzzle.prompt}</p>
        {hintIndex >= 0 && (
          <ul className="bc-hint-list">
            {stop.puzzle.hints.slice(0, hintIndex + 1).map((hint, i) => (
              <li key={i}>{hint}</li>
            ))}
          </ul>
        )}
        <div className="bc-junior-actions">
          {hintIndex + 1 < stop.puzzle.hints.length && (
            <button
              className="bc-btn bc-btn-ghost bc-btn-small"
              onClick={() => setHintIndex((i) => i + 1)}
            >
              Need a hint?
            </button>
          )}
          {!puzzleSolved && (
            <button className="bc-btn bc-btn-small" onClick={() => setPuzzleSolved(true)}>
              Found it
            </button>
          )}
          {puzzleSolved && <span className="bc-kicker">Solved</span>}
        </div>
      </div>

      {hasJuniors && (
        <div className="bc-junior-strip">
          <span className="bc-junior-badge">
            Junior Detective{juniorNames.length > 1 ? 's' : ''}: {juniorNames.join(', ')}
          </span>
          <p>{stop.juniorTask.prompt}</p>
          {stop.juniorTask.type === 'count' && !juniorDone && (
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={juniorCount}
              onChange={(e) => setJuniorCount(e.target.value)}
              placeholder="How many?"
            />
          )}
          <div className="bc-junior-actions">
            {!juniorDone && (
              <button className="bc-btn bc-btn-small" onClick={() => setJuniorDone(true)}>
                {stop.juniorTask.type === 'count' ? 'Submit' : 'Spotted it!'}
              </button>
            )}
            {!juniorDone && stop.juniorTask.skippable && (
              <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={() => setJuniorDone(true)}>
                Skip
              </button>
            )}
            {juniorDone && <span className="bc-kicker">Nice work</span>}
          </div>
        </div>
      )}

      <button className="bc-btn bc-btn-primary" disabled={!puzzleSolved} onClick={() => setShowEvidence(true)}>
        Continue
      </button>
    </div>
  );
}
