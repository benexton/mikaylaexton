import { useState } from 'react';
import VideoCharacter from '../components/VideoCharacter.jsx';
import BackButton from '../components/BackButton.jsx';
import { NARRATOR_CLIPS } from '../game.config.js';

// Restore gesture placeholder (press and hold, then blow) is a milestone 6
// polish item (see docs/04-build-spec.md) - here it's a straight tap so the
// finale is reachable end to end. chiefFinale then the optional
// barty_caught clip, then handoff to the certificate.
export default function Finale({ onDone, onBack }) {
  const [stage, setStage] = useState('restore'); // restore | chief | caught

  if (stage === 'restore') {
    return (
      <div className="bc-screen bc-stop">
        <BackButton onClick={onBack} />
        <span className="bc-startgate-icon" role="img" aria-label="Steam">
          💨
        </span>
        <h2 className="bc-startgate-title">Turn the valve, then blow!</h2>
        <p className="bc-startgate-sub">
          Press and hold the valve, then give it a big blow to send the steam back to the pools.
        </p>
        <button className="bc-btn bc-btn-primary" onClick={() => setStage('chief')}>
          Restore the heat
        </button>
      </div>
    );
  }

  if (stage === 'chief') {
    return (
      <div className="bc-screen bc-stop">
        <BackButton onClick={() => setStage('restore')} />
        <VideoCharacter
          key={NARRATOR_CLIPS.chiefFinale.file}
          clip={NARRATOR_CLIPS.chiefFinale}
          onDone={() => setStage('caught')}
        />
      </div>
    );
  }

  return (
    <div className="bc-screen bc-stop">
      <BackButton onClick={() => setStage('chief')} />
      <VideoCharacter key={NARRATOR_CLIPS.bartyCaught.file} clip={NARRATOR_CLIPS.bartyCaught} onDone={onDone} />
    </div>
  );
}
