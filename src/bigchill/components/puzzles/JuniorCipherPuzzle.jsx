import { useState } from 'react';
import PigpenGlyph from './PigpenGlyph.jsx';

// The early-reader version of CipherPuzzle.jsx: same pigpen symbol system
// (so it visually reads as "the same code, easier"), but a single short
// word instead of a phrase, and the legend only lists the letters that
// actually appear in the word instead of the full A-Z - a beginning reader
// shouldn't have to hunt through 26 symbols to decode 4 letters.
export default function JuniorCipherPuzzle({ data, onSolved }) {
  const [guess, setGuess] = useState('');
  const [status, setStatus] = useState(null); // null | 'wrong'
  const [solved, setSolved] = useState(false);

  const word = data.word.toUpperCase();
  const usedLetters = [...new Set([...word])].sort();

  function submit(e) {
    e.preventDefault();
    if (guess.trim().toUpperCase() === word) {
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
        {[...word].map((letter, i) => (
          <PigpenGlyph key={i} letter={letter} />
        ))}
      </div>

      <details className="bc-cipher-legend">
        <summary>Show the decoder key</summary>
        <div className="bc-cipher-legend-grid">
          {usedLetters.map((letter) => (
            <div className="bc-cipher-legend-cell" key={letter}>
              <PigpenGlyph letter={letter} size={20} />
              <span>{letter}</span>
            </div>
          ))}
        </div>
      </details>

      {solved ? (
        <p className="bc-kicker">Solved - it says &ldquo;{word}&rdquo;.</p>
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
