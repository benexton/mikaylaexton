import { useMemo, useState } from 'react';
import { shuffle } from './shuffle.js';
import FullscreenScene from './FullscreenScene.jsx';

const COLS = 9;
const ROWS = 7;

// The target icon is buried in a dense field that includes visually similar
// decoys (e.g. other kinds of seating among the benches to count) - that's
// what makes a counting puzzle a real challenge instead of "count the only
// three things on an empty screen".
function buildScene(itemEmoji, count, decoyIcons) {
  const total = COLS * ROWS;
  const order = shuffle(Array.from({ length: total }, (_, i) => i));
  const targetCells = new Set(order.slice(0, count));
  return Array.from({ length: total }, (_, i) => ({
    key: i,
    icon: targetCells.has(i) ? itemEmoji : decoyIcons[Math.floor(Math.random() * decoyIcons.length)],
    isTarget: targetCells.has(i),
  }));
}

export default function CountPuzzle({ data, onSolved }) {
  const [guess, setGuess] = useState('');
  const [status, setStatus] = useState(null); // null | 'wrong'
  const [solved, setSolved] = useState(false);

  const cells = useMemo(
    () => buildScene(data.itemEmoji, data.count, data.decoyIcons),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  function submit(e) {
    e.preventDefault();
    if (Number(guess) === data.count) {
      setSolved(true);
      setStatus(null);
      onSolved?.();
    } else {
      setStatus('wrong');
    }
  }

  return (
    <div className="bc-puzzle">
      <FullscreenScene label={`Tap to search for the ${data.itemLabel}`}>
        <p className="bc-scene-status">Count every {data.itemEmoji} you can find</p>
        <div className="bc-dense-grid">
          {cells.map((cell) => (
            <span key={cell.key} className="bc-dense-cell bc-dense-cell-decoy">
              {cell.icon}
            </span>
          ))}
        </div>
      </FullscreenScene>
      {solved ? (
        <p className="bc-kicker">
          Solved - {data.count} {data.itemLabel}, nice counting!
        </p>
      ) : (
        <form className="bc-count-form" onSubmit={submit}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={guess}
            onChange={(e) => {
              setGuess(e.target.value);
              setStatus(null);
            }}
            placeholder={`How many ${data.itemLabel}?`}
          />
          <button className="bc-btn bc-btn-small" type="submit">
            Check
          </button>
        </form>
      )}
      {status === 'wrong' && <p className="bc-puzzle-status-wrong">Not quite - look again.</p>}
    </div>
  );
}
