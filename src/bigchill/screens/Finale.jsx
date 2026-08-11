import { useState } from 'react';
import VideoCharacter from '../components/VideoCharacter.jsx';
import BackButton from '../components/BackButton.jsx';
import HeatLock from '../components/HeatLock.jsx';
import { NARRATOR_CLIPS } from '../game.config.js';

// The heat-restoring combination lock (see HeatLock.jsx), then chiefFinale
// and the barty_caught clip, then handoff to the certificate.
export default function Finale({ onDone, onOpenCaseFile, onBarsDown, onBack }) {
  const [stage, setStage] = useState('lock'); // lock | chief | caught

  if (stage === 'lock') {
    return (
      <div className="bc-screen bc-stop">
        <HeatLock onComplete={() => setStage('chief')} onOpenCaseFile={onOpenCaseFile} onBack={onBack} />
      </div>
    );
  }

  if (stage === 'chief') {
    return (
      <div className="bc-screen bc-stop">
        <BackButton onClick={() => setStage('lock')} />
        <VideoCharacter
          key={NARRATOR_CLIPS.chiefFinale.file}
          clip={NARRATOR_CLIPS.chiefFinale}
          onDone={() => {
            setStage('caught');
            onBarsDown?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className="bc-screen bc-stop">
      <BackButton onClick={() => setStage('chief')} />
      <VideoCharacter
        key={NARRATOR_CLIPS.bartyCaught.file}
        clip={NARRATOR_CLIPS.bartyCaught}
        onDone={onDone}
        autoPlay
      />
    </div>
  );
}
