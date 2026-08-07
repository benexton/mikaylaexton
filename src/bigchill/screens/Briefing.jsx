import { useState } from 'react';
import VideoCharacter from '../components/VideoCharacter.jsx';
import BackButton from '../components/BackButton.jsx';
import { NARRATOR_CLIPS } from '../game.config.js';

// chiefIntro -> junior detective names (zero or more, added one at a time)
// -> thiefTaunt -> hand off to stop 1.
export default function Briefing({ onComplete, onBack }) {
  const [stage, setStage] = useState('intro'); // intro | names | taunt
  const [names, setNames] = useState([]);
  const [draft, setDraft] = useState('');

  function addName(e) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setNames((n) => [...n, trimmed]);
    setDraft('');
  }

  function removeName(index) {
    setNames((n) => n.filter((_, i) => i !== index));
  }

  const backHandler =
    stage === 'intro' ? onBack : stage === 'names' ? () => setStage('intro') : () => setStage('names');

  return (
    <div className="bc-screen bc-briefing">
      <BackButton onClick={backHandler} />

      {stage === 'intro' && <VideoCharacter clip={NARRATOR_CLIPS.chiefIntro} onDone={() => setStage('names')} />}

      {stage === 'names' && (
        <div className="bc-briefing-names">
          <p className="bc-briefing-names-label">
            Chief Wembley needs your Junior Detectives&rsquo; names for the badges
          </p>

          {names.length > 0 && (
            <ul className="bc-junior-name-list">
              {names.map((name, i) => (
                <li key={i}>
                  {name}
                  <button
                    type="button"
                    className="bc-junior-name-remove"
                    onClick={() => removeName(i)}
                    aria-label={`Remove ${name}`}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="bc-add-name-form" onSubmit={addName}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Junior Detective's name"
              autoFocus
            />
            <button className="bc-btn bc-btn-primary" type="submit" disabled={!draft.trim()}>
              Add
            </button>
          </form>

          <button className="bc-btn bc-btn-primary" onClick={() => setStage('taunt')}>
            {names.length > 0 ? 'Continue' : 'No junior detectives'}
          </button>
        </div>
      )}

      {stage === 'taunt' && <VideoCharacter clip={NARRATOR_CLIPS.thiefTaunt} onDone={() => onComplete(names)} />}
    </div>
  );
}
