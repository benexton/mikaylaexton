import { useState } from 'react';

// A single Erlenmeyer-flask silhouette, reused for every beaker on the
// bench - the liquid is just a plain rect clipped to that silhouette, so
// it always sits with a flat, realistic surface regardless of fill level.
const FLASK_PATH = 'M26 8 L34 8 L34 26 L50 78 Q52 84 46 84 L14 84 Q8 84 10 78 L26 26 Z';

const PINK = '#ff5f9e';
const BEAKERS = [
  { color: '#3fbf6f', level: 44 }, // green
  { color: '#a25fe0', level: 50 }, // purple
  { color: PINK, level: 40 },
  { color: '#ff9c3d', level: 56 }, // orange
  { color: '#4a90e2', level: 46 }, // blue
  { color: '#e8d24a', level: 52 }, // yellow
  { color: PINK, level: 60 },
  { color: '#2dbfae', level: 42 }, // teal
  { color: '#e0453f', level: 58 }, // red
  { color: PINK, level: 48 },
  { color: '#3fc7e0', level: 54 }, // cyan
];
const ANSWER = BEAKERS.filter((b) => b.color === PINK).length;

function Flask({ color, level, index }) {
  const clipId = `bc-flask-clip-${index}`;
  return (
    <svg viewBox="0 0 60 90" className="bc-flask">
      <clipPath id={clipId}>
        <path d={FLASK_PATH} />
      </clipPath>
      <rect x="0" y={level} width="60" height="90" fill={color} clipPath={`url(#${clipId})`} />
      <path d={FLASK_PATH} className="bc-flask-outline" />
    </svg>
  );
}

// A count puzzle with no external image - the lab bench is drawn as SVG
// flasks instead, checked locally like every other junior side puzzle
// (StopScreen's central Check button only gates the main group puzzle).
export default function LabBeakersPuzzle({ onSolved }) {
  const [guess, setGuess] = useState('');
  const [status, setStatus] = useState(null); // null | 'wrong'

  function check() {
    if (Number(guess) === ANSWER) {
      onSolved?.();
    } else {
      setStatus('wrong');
    }
  }

  return (
    <div className="bc-puzzle">
      <div className="bc-lab-bench">
        {BEAKERS.map((b, i) => (
          <Flask key={i} index={i} color={b.color} level={b.level} />
        ))}
      </div>
      <form
        className="bc-count-form"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          value={guess}
          onChange={(e) => {
            setGuess(e.target.value);
            setStatus(null);
          }}
          placeholder="How many?"
        />
        <button className="bc-btn bc-btn-small" type="submit">
          Check
        </button>
      </form>
      {status === 'wrong' && <p className="bc-puzzle-status-wrong">Not quite - count again.</p>}
    </div>
  );
}
