import { useEffect, useRef, useState } from 'react';
import PasswordGate from './screens/PasswordGate.jsx';
import StartGate from './screens/StartGate.jsx';
import PrepScreen from './screens/PrepScreen.jsx';
import Briefing from './screens/Briefing.jsx';
import NextStop from './screens/NextStop.jsx';
import StopScreen from './screens/StopScreen.jsx';
import CaseFile from './screens/CaseFile.jsx';
import Accusation from './screens/Accusation.jsx';
import Finale from './screens/Finale.jsx';
import Certificate from './screens/Certificate.jsx';
import VideoCharacter from './components/VideoCharacter.jsx';
import BackButton from './components/BackButton.jsx';
import { GAME_CONFIG, NARRATOR_CLIPS } from './game.config.js';
import { submitAccusation, recordElapsedTime } from './lib/bigchillSupabase.js';
import { loadProgress, saveProgress } from './lib/progressStorage.js';

const STOPS = GAME_CONFIG.stops;
const SUSPECTS = GAME_CONFIG.suspects;
const MIDWAY_AFTER_ORDER = Math.ceil(STOPS.length / 2);

function suspectFor(stop) {
  return stop.suspectId ? SUSPECTS.find((s) => s.id === stop.suspectId) : null;
}

// Full story mode, single group, all state local (milestones 1-4 - see
// docs/04-build-spec.md). The accusation is now checked server side
// (milestone 5 slice - see lib/bigchillSupabase.js); race mode itself is
// still a later milestone.
export default function BigChillApp() {
  // Read once, synchronously, before anything else needs it - every
  // useState below just picks its own field back out of the same object.
  const [saved] = useState(() => loadProgress());

  const [redeemedCode, setRedeemedCode] = useState(saved.code);
  // Only trust a saved phase past the gate if a code was actually
  // redeemed - a half-written blob with no code should never skip it.
  const [phase, setPhase] = useState(saved.code ? saved.phase : 'password');
  const [juniorNames, setJuniorNames] = useState(saved.juniorNames);
  const [stopIndex, setStopIndex] = useState(saved.stopIndex);
  const [completedStopIds, setCompletedStopIds] = useState(saved.completedStopIds);
  const [caseFileOpen, setCaseFileOpen] = useState(false);
  const [caseFileHighlightId, setCaseFileHighlightId] = useState(null);
  const [stopNotes, setStopNotes] = useState(saved.stopNotes);
  const [history, setHistory] = useState(saved.history);
  const [elapsedSeconds, setElapsedSeconds] = useState(saved.elapsedSeconds);
  const startTimeRef = useRef(saved.startTime);

  // Fires on every state change relevant to "where the group is" - cheap
  // (one small JSON blob), and means a reload can never be more than one
  // render behind. caseFileOpen/caseFileHighlightId are deliberately left
  // out - that overlay just closes on reload, nothing is lost by re-opening
  // it (the notes it edits are in stopNotes, which is persisted).
  useEffect(() => {
    saveProgress({
      code: redeemedCode,
      phase,
      juniorNames,
      stopIndex,
      completedStopIds,
      stopNotes,
      history,
      startTime: startTimeRef.current,
      elapsedSeconds,
    });
  }, [redeemedCode, phase, juniorNames, stopIndex, completedStopIds, stopNotes, history, elapsedSeconds]);

  function handlePasswordSuccess(code) {
    setRedeemedCode(code);
    setPhase('start');
  }

  // Timing runs start-to-finish across a whole playthrough: from the tap
  // that leaves the start gate to the moment the finale's prison bars start
  // dropping (see Finale's onBarsDown) - not from the password itself, so a
  // group that pauses on the start-gate screen isn't penalised.
  function handleBarsDown() {
    if (!startTimeRef.current) return;
    const secs = Math.round((Date.now() - startTimeRef.current) / 1000);
    setElapsedSeconds(secs);
    recordElapsedTime(redeemedCode, secs);
  }

  function updateStopNote(stopId, text) {
    setStopNotes((notes) => ({ ...notes, [stopId]: text }));
  }

  // The moment a group finishes an interview is the best time to get them
  // writing notes down, so instead of advancing straight to the next stop
  // this marks the stop complete right away (so its number/notes field
  // shows up in the case file immediately) and opens the case file on that
  // stop's notes field - the phase transition itself is deferred until
  // they close it (see closeCaseFile).
  function finishStopInterview() {
    setCompletedStopIds((ids) => (ids.includes(currentStop.id) ? ids : [...ids, currentStop.id]));
    setCaseFileHighlightId(currentStop.id);
    setCaseFileOpen(true);
  }

  function closeCaseFile() {
    setCaseFileOpen(false);
    if (caseFileHighlightId) {
      setCaseFileHighlightId(null);
      advanceAfterStop();
    }
  }

  const currentStop = STOPS[stopIndex];
  const completedStops = STOPS.filter((s) => completedStopIds.includes(s.id));
  const progress = completedStops.length / STOPS.length;

  // Every forward transition snapshots the state it's leaving behind, so
  // goBack can restore it exactly - covers a whole family accidentally
  // tapping ahead, not just the youngest player.
  function goTo(nextPhase, patch = {}) {
    setHistory((h) => [...h, { phase, juniorNames, stopIndex, completedStopIds }]);
    if ('juniorNames' in patch) setJuniorNames(patch.juniorNames);
    if ('stopIndex' in patch) setStopIndex(patch.stopIndex);
    if ('completedStopIds' in patch) setCompletedStopIds(patch.completedStopIds);
    setPhase(nextPhase);
  }

  function goBack() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPhase(prev.phase);
    setJuniorNames(prev.juniorNames);
    setStopIndex(prev.stopIndex);
    setCompletedStopIds(prev.completedStopIds);
  }

  // completedStopIds already has this stop by the time this runs -
  // finishStopInterview adds it before the case file even opens - so this
  // is purely a phase transition, no state patch to compute.
  function advanceAfterStop() {
    if (currentStop.order === MIDWAY_AFTER_ORDER && NARRATOR_CLIPS.chiefMidway) {
      goTo('midway');
    } else {
      goToNext();
    }
  }

  function goToNext() {
    if (stopIndex + 1 < STOPS.length) {
      goTo('nextStop', { stopIndex: stopIndex + 1 });
    } else {
      goTo('accusation');
    }
  }

  function restart() {
    setHistory([]);
    setPhase('start');
    setJuniorNames([]);
    setStopIndex(0);
    setCompletedStopIds([]);
    setCaseFileOpen(false);
    setCaseFileHighlightId(null);
    setStopNotes({});
    setElapsedSeconds(null);
    startTimeRef.current = null;
  }

  return (
    <div className="bc-app">
      {phase === 'password' && <PasswordGate onSuccess={handlePasswordSuccess} />}

      {phase === 'start' && (
        <StartGate
          onBegin={() => {
            startTimeRef.current = Date.now();
            goTo('prep');
          }}
        />
      )}

      {phase === 'prep' && <PrepScreen onDone={() => goTo('briefing')} onBack={goBack} />}

      {phase === 'briefing' && (
        <Briefing onComplete={(names) => goTo('nextStop', { juniorNames: names })} onBack={goBack} />
      )}

      {phase === 'nextStop' && (
        <NextStop
          stop={currentStop}
          stopsTotal={STOPS.length}
          progress={progress}
          onArrive={() => goTo('stop')}
          onOpenCaseFile={() => setCaseFileOpen(true)}
          onBack={goBack}
        />
      )}

      {phase === 'stop' && (
        <StopScreen
          stop={currentStop}
          suspect={suspectFor(currentStop)}
          juniorNames={juniorNames}
          progress={progress}
          onComplete={finishStopInterview}
          onOpenCaseFile={() => setCaseFileOpen(true)}
          onBack={goBack}
        />
      )}

      {phase === 'midway' && (
        <div className="bc-screen bc-stop">
          <BackButton onClick={goBack} />
          <VideoCharacter
            key={NARRATOR_CLIPS.chiefMidway.file}
            clip={NARRATOR_CLIPS.chiefMidway}
            onDone={() => goToNext()}
          />
        </div>
      )}

      {phase === 'accusation' && (
        <Accusation
          suspects={SUSPECTS}
          onGuess={submitAccusation}
          onCorrect={() => goTo('finale')}
          onOpenCaseFile={() => setCaseFileOpen(true)}
          onBack={goBack}
        />
      )}

      {phase === 'finale' && (
        <Finale
          onDone={() => goTo('certificate')}
          onOpenCaseFile={() => setCaseFileOpen(true)}
          onBarsDown={handleBarsDown}
          onBack={goBack}
        />
      )}

      {phase === 'certificate' && (
        <Certificate
          juniorNames={juniorNames}
          elapsedSeconds={elapsedSeconds}
          onRestart={restart}
          onBack={goBack}
        />
      )}

      {caseFileOpen && (
        <CaseFile
          stops={STOPS}
          suspects={SUSPECTS}
          completedStopIds={completedStopIds}
          notes={stopNotes}
          onNoteChange={updateStopNote}
          onClose={closeCaseFile}
          highlightStopId={caseFileHighlightId}
        />
      )}
    </div>
  );
}
