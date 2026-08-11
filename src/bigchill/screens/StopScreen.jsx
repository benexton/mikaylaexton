import { useState } from 'react';
import VideoCharacter from '../components/VideoCharacter.jsx';
import BackButton from '../components/BackButton.jsx';
import HeatMeter from '../components/HeatMeter.jsx';
import PuzzleView from '../components/puzzles/PuzzleView.jsx';
import JuniorPuzzleView from '../components/puzzles/JuniorPuzzleView.jsx';

// Puzzle types whose answer is a typed digit code rather than something
// solved by direct interaction - these don't self-report solved any more,
// StopScreen checks the typed guess centrally when the group hits Check.
const DIGIT_ANSWER_TYPES = ['image', 'riddle', 'numberCipher'];
const FLASH_MS = 1800;

function normalizeDigits(s) {
  return s.trim().replace(/^-/, '');
}

// One stop, end to end: optional suspect video + interrogation, the group
// puzzle, the separate Junior Detective strip, then the evidence recap.
export default function StopScreen({ stop, suspect, juniorNames, progress, onComplete, onOpenCaseFile, onBack }) {
  const [suspectSeen, setSuspectSeen] = useState(!stop.suspectId);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [askedQuestionIds, setAskedQuestionIds] = useState([]);
  const [hintIndex, setHintIndex] = useState(-1);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [mainGuess, setMainGuess] = useState('');
  const [juniorDone, setJuniorDone] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [flash, setFlash] = useState(null); // null | 'correct' | 'wrong'
  const [needsJuniorNotice, setNeedsJuniorNotice] = useState(false);

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
          <h3>Interview complete</h3>
          <p>You&rsquo;ve finished your interview with {suspect?.name}. Time to move on to the next spot.</p>
        </div>
        <button className="bc-btn bc-btn-primary" onClick={onComplete}>
          Continue
        </button>
      </div>
    );
  }

  const activeQuestion = suspect?.questions.find((q) => q.id === activeQuestionId);
  const hasJuniors = juniorNames && juniorNames.length > 0;
  const isDigitAnswer = DIGIT_ANSWER_TYPES.includes(stop.puzzle.type);
  const mainPuzzleCorrect = isDigitAnswer
    ? normalizeDigits(mainGuess) === normalizeDigits(stop.puzzle.data.answer)
    : puzzleSolved;

  // Below unlocked, the bottom button checks everything at once - the main
  // puzzle plus the junior puzzle if one is in play - and flashes the whole
  // screen green or red rather than silently gating a disabled button. A
  // correct check is also the moment the interrogation questions unlock, not
  // something that happens later after the interview. Once unlocked, the
  // same button just moves the group on to the evidence card.
  //
  // A right main-puzzle answer with the junior puzzle still outstanding is
  // its own case, not a 'wrong' one: flashing red there reads as "your main
  // answer is wrong" when it's actually correct, so this shows a specific
  // nudge instead of the red flash.
  function handleBottomButtonClick() {
    if (unlocked) {
      setShowEvidence(true);
      return;
    }
    if (mainPuzzleCorrect && hasJuniors && !juniorDone) {
      setNeedsJuniorNotice(true);
      return;
    }
    setNeedsJuniorNotice(false);
    const complete = mainPuzzleCorrect && (!hasJuniors || juniorDone);
    setFlash(complete ? 'correct' : 'wrong');
    setTimeout(() => {
      setFlash(null);
      if (complete) setUnlocked(true);
    }, FLASH_MS);
  }

  return (
    <div className="bc-screen bc-stop">
      {flash && <div className={`bc-answer-flash bc-answer-flash-${flash}`} />}
      <BackButton onClick={handleBack} />
      <HeatMeter value={progress} />

      <div className="bc-stop-header">
        <p className="bc-kicker">Stop {stop.order}</p>
        <h2 className="bc-stop-title">{stop.title}</h2>
        {onOpenCaseFile && (
          <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={onOpenCaseFile}>
            Case file
          </button>
        )}
      </div>

      {suspect && (
        <div className="bc-card">
          <h3>Interrogate {suspect.name}</h3>
          {!unlocked ? (
            <p className="bc-stop-location">
              Solve the puzzle{hasJuniors ? 's' : ''} below to unlock your questions.
            </p>
          ) : activeQuestion ? (
            <>
              <p className="bc-active-question">{activeQuestion.prompt}</p>
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
            </>
          ) : (
            <div className="bc-question-list">
              {suspect.questions.map((q) => (
                <button
                  key={q.id}
                  className="bc-btn bc-btn-ghost bc-question-btn"
                  onClick={() => setActiveQuestionId(q.id)}
                >
                  <span className="bc-question-prompt">{q.prompt}</span>
                  {askedQuestionIds.includes(q.id) && <span className="bc-kicker">Asked</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!unlocked && (
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
          {hintIndex + 1 < stop.puzzle.hints.length && (
            <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={() => setHintIndex((i) => i + 1)}>
              Need a hint?
            </button>
          )}
          <PuzzleView
            puzzle={stop.puzzle}
            onSolved={() => setPuzzleSolved(true)}
            guess={mainGuess}
            onGuessChange={setMainGuess}
          />
        </div>
      )}

      {hasJuniors && !unlocked && (
        <div className="bc-junior-strip">
          <span className="bc-junior-badge">
            Junior Detective{juniorNames.length > 1 ? 's' : ''}: {juniorNames.join(', ')}
          </span>
          <p>{stop.juniorPuzzle.prompt}</p>
          {needsJuniorNotice && !juniorDone && (
            <p className="bc-junior-notice">
              Main puzzle solved! Finish this Junior Detective puzzle too before you check again.
            </p>
          )}
          {!juniorDone && (
            <JuniorPuzzleView puzzle={stop.juniorPuzzle} onSolved={() => setJuniorDone(true)} />
          )}
          <div className="bc-junior-actions">
            {!juniorDone && stop.juniorPuzzle.skippable !== false && (
              <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={() => setJuniorDone(true)}>
                Skip
              </button>
            )}
            {juniorDone && <span className="bc-kicker">Nice work</span>}
          </div>
        </div>
      )}

      <button className="bc-btn bc-btn-primary" onClick={handleBottomButtonClick}>
        {unlocked ? 'Continue' : 'Check'}
      </button>
    </div>
  );
}
