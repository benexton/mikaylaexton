import { useState } from 'react';
import VideoCharacter from '../components/VideoCharacter.jsx';
import BackButton from '../components/BackButton.jsx';
import RestoreGesture from '../components/RestoreGesture.jsx';
import { NARRATOR_CLIPS } from '../game.config.js';

// Real restore gesture (press and hold, then blow into the mic or shake -
// see RestoreGesture.jsx), then chiefFinale and the optional barty_caught
// clip, then handoff to the certificate.
export default function Finale({ onDone, onBack }) {
  const [stage, setStage] = useState('restore'); // restore | chief | caught

  if (stage === 'restore') {
    return (
      <div className="bc-screen bc-stop">
        <RestoreGesture onComplete={() => setStage('chief')} onBack={onBack} />
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
