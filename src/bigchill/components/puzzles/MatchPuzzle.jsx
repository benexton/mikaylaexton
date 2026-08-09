import { useState } from 'react';
import { shuffle } from './shuffle.js';

// Tap an icon, then tap the label it belongs with. Icons and labels are
// shuffled independently once at mount (useState initializer, not computed
// during render) so the buttons don't reshuffle mid-attempt.
export default function MatchPuzzle({ data, onSolved }) {
  const [icons] = useState(() => shuffle(data.pairs));
  const [labels] = useState(() => shuffle(data.pairs));
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [matchedIds, setMatchedIds] = useState([]);
  const [wrongPair, setWrongPair] = useState(null);

  const allMatched = matchedIds.length === data.pairs.length;

  function pickIcon(id) {
    if (matchedIds.includes(id)) return;
    setSelectedIcon(id);
    setWrongPair(null);
  }

  function pickLabel(id) {
    if (!selectedIcon || matchedIds.includes(id)) return;
    if (selectedIcon === id) {
      const next = [...matchedIds, id];
      setMatchedIds(next);
      setSelectedIcon(null);
      if (next.length === data.pairs.length) onSolved?.();
    } else {
      setWrongPair({ icon: selectedIcon, label: id });
      setSelectedIcon(null);
      setTimeout(() => setWrongPair(null), 600);
    }
  }

  return (
    <div className="bc-puzzle">
      <div className="bc-match-grid">
        <div className="bc-match-col">
          {icons.map((p) => (
            <button
              key={p.id}
              className={`bc-match-btn${matchedIds.includes(p.id) ? ' bc-match-done' : ''}${
                selectedIcon === p.id ? ' bc-match-selected' : ''
              }${wrongPair?.icon === p.id ? ' bc-match-wrong' : ''}`}
              disabled={matchedIds.includes(p.id)}
              onClick={() => pickIcon(p.id)}
            >
              {p.icon}
            </button>
          ))}
        </div>
        <div className="bc-match-col">
          {labels.map((p) => (
            <button
              key={p.id}
              className={`bc-match-btn bc-match-label${
                matchedIds.includes(p.id) ? ' bc-match-done' : ''
              }${wrongPair?.label === p.id ? ' bc-match-wrong' : ''}`}
              disabled={matchedIds.includes(p.id)}
              onClick={() => pickLabel(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {allMatched && <p className="bc-kicker">Solved - every clue matched.</p>}
    </div>
  );
}
