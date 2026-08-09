import { useRef, useState } from 'react';

// A plain riddle, no cipher to decode - just one blank box per letter of
// the answer, filled in like a crossword clue. Auto-advances focus as each
// box is typed and jumps back on backspace, the same feel as a PIN input.
export default function RiddleFillPuzzle({ data, onSolved }) {
  const answer = data.answer.toUpperCase();
  const [letters, setLetters] = useState(() => Array(answer.length).fill(''));
  const [status, setStatus] = useState(null); // null | 'wrong'
  const inputRefs = useRef([]);

  function handleChange(i, value) {
    const char = value.slice(-1).toUpperCase();
    setLetters((prev) => {
      const next = [...prev];
      next[i] = char;
      return next;
    });
    setStatus(null);
    if (char && i + 1 < answer.length) {
      inputRefs.current[i + 1]?.focus();
    }
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !letters[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function check() {
    if (letters.join('') === answer) {
      onSolved?.();
    } else {
      setStatus('wrong');
    }
  }

  return (
    <div className="bc-puzzle">
      <div className="bc-riddle-fill-boxes">
        {letters.map((letter, i) => (
          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="text"
            inputMode="text"
            maxLength={1}
            value={letter}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="bc-riddle-fill-box"
            aria-label={`Letter ${i + 1}`}
          />
        ))}
      </div>
      <button className="bc-btn bc-btn-small" onClick={check}>
        Check
      </button>
      {status === 'wrong' && <p className="bc-puzzle-status-wrong">Not quite - try again.</p>}
    </div>
  );
}
