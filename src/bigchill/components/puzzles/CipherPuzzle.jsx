import { useState } from 'react';
import PigpenGlyph from './PigpenGlyph.jsx';
import { PIGPEN_ALPHABET } from './pigpen.js';

// A real pigpen cipher, not a "spot the bold letters" trick - encode data.
// phrase as a row of symbols with a full A-Z legend underneath, same as a
// real escape room hands out a decoder key. The challenge is the tedious,
// careful letter-by-letter decode, not finding a shortcut.
export default function CipherPuzzle({ data, onSolved }) {
  const [guess, setGuess] = useState('');
  const [status, setStatus] = useState(null); // null | 'wrong'
  const [solved, setSolved] = useState(false);

  function normalize(s) {
    return s.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function submit(e) {
    e.preventDefault();
    if (normalize(guess) === normalize(data.phrase)) {
      setSolved(true);
      setStatus(null);
      onSolved?.();
    } else {
      setStatus('wrong');
    }
  }

  return (
    <div className="bc-puzzle">
      <div className="bc-cipher-message">
        {data.phrase.split(' ').map((word, wi) => (
          <span className="bc-cipher-word" key={wi}>
            {[...word].map((letter, li) => (
              <PigpenGlyph key={li} letter={letter} />
            ))}
          </span>
        ))}
      </div>

      <details className="bc-cipher-legend">
        <summary>Show the decoder key</summary>
        <div className="bc-cipher-legend-grid">
          {PIGPEN_ALPHABET.map((letter) => (
            <div className="bc-cipher-legend-cell" key={letter}>
              <PigpenGlyph letter={letter} size={20} />
              <span>{letter}</span>
            </div>
          ))}
        </div>
      </details>

      {solved ? (
        <p className="bc-kicker">Solved - it reads &ldquo;{data.phrase}&rdquo;.</p>
      ) : (
        <form className="bc-count-form" onSubmit={submit}>
          <input
            type="text"
            value={guess}
            onChange={(e) => {
              setGuess(e.target.value);
              setStatus(null);
            }}
            placeholder="What does it say?"
          />
          <button className="bc-btn bc-btn-small" type="submit">
            Check
          </button>
        </form>
      )}
      {status === 'wrong' && <p className="bc-puzzle-status-wrong">Not quite - check each symbol again.</p>}
    </div>
  );
}
