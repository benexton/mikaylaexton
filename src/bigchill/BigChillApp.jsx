import { useState } from 'react';
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
import { GAME_CONFIG, TELLS, NARRATOR_CLIPS } from './game.config.js';

const STOPS = GAME_CONFIG.stops;
const SUSPECTS = GAME_CONFIG.suspects;
const CULPRIT = SUSPECTS.find((s) => !s.clearedBy);
const MIDWAY_AFTER_ORDER = Math.ceil(STOPS.length / 2);

function suspectFor(stop) {
  return stop.suspectId ? SUSPECTS.find((s) => s.id === stop.suspectId) : null;
}

// Full story mode, single group, all state local (milestones 1-4 - see
// docs/04-build-spec.md). The Supabase back end and race mode are later
// milestones.
export default function BigChillApp() {
  const [phase, setPhase] = useState('start');
  const [juniorNames, setJuniorNames] = useState([]);
  const [stopIndex, setStopIndex] = useState(0);
  const [completedStopIds, setCompletedStopIds] = useState([]);
  const [caseFileOpen, setCaseFileOpen] = useState(false);
  const [history, setHistory] = useState([]);

  const currentStop = STOPS[stopIndex];
  const visitedSuspectIds = STOPS.filter(
    (s) => completedStopIds.includes(s.id) && s.suspectId
  ).map((s) => s.suspectId);

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

  function advanceAfterStop() {
    const nextCompleted = [...completedStopIds, currentStop.id];
    if (currentStop.order === MIDWAY_AFTER_ORDER && NARRATOR_CLIPS.chiefMidway) {
      goTo('midway', { completedStopIds: nextCompleted });
    } else {
      goToNext(nextCompleted);
    }
  }

  function goToNext(completedOverride) {
    const nextCompleted = completedOverride ?? completedStopIds;
    if (stopIndex + 1 < STOPS.length) {
      goTo('nextStop', { completedStopIds: nextCompleted, stopIndex: stopIndex + 1 });
    } else {
      goTo('accusation', { completedStopIds: nextCompleted });
    }
  }

  function restart() {
    setHistory([]);
    setPhase('start');
    setJuniorNames([]);
    setStopIndex(0);
    setCompletedStopIds([]);
    setCaseFileOpen(false);
  }

  return (
    <div className="bc-app">
      {phase === 'start' && <StartGate onBegin={() => goTo('prep')} />}

      {phase === 'prep' && <PrepScreen onDone={() => goTo('briefing')} onBack={goBack} />}

      {phase === 'briefing' && (
        <Briefing onComplete={(names) => goTo('nextStop', { juniorNames: names })} onBack={goBack} />
      )}

      {phase === 'nextStop' && (
        <NextStop
          stop={currentStop}
          stopsTotal={STOPS.length}
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
          onComplete={advanceAfterStop}
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
          tells={TELLS}
          culpritId={CULPRIT.id}
          onCorrect={() => goTo('finale')}
          onBack={goBack}
        />
      )}

      {phase === 'finale' && <Finale onDone={() => goTo('certificate')} onBack={goBack} />}

      {phase === 'certificate' && (
        <Certificate juniorNames={juniorNames} onRestart={restart} onBack={goBack} />
      )}

      {caseFileOpen && (
        <CaseFile
          suspects={SUSPECTS}
          visitedSuspectIds={visitedSuspectIds}
          tells={TELLS}
          onClose={() => setCaseFileOpen(false)}
        />
      )}
    </div>
  );
}
