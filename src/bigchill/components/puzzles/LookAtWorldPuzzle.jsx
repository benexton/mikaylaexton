import { useMemo, useState } from 'react';
import { shuffle } from './shuffle.js';
import FullscreenScene from './FullscreenScene.jsx';

const COLS = 8;
const ROWS = 6;

// A genuine Where's Wally style hunt: the real clues are scattered among a
// dense field of decoys (some deliberately similar-looking, e.g. a lotion
// bottle next to the real dropped bottle cap) rather than floating alone on
// an empty background - that's what actually makes hidden-object puzzles
// hard, not the number of targets.
function buildScene(targets, decoyIcons) {
  const total = COLS * ROWS;
  const order = shuffle(Array.from({ length: total }, (_, i) => i));
  const targetAt = new Map(order.slice(0, targets.length).map((cell, i) => [cell, targets[i]]));
  return Array.from({ length: total }, (_, i) => {
    const target = targetAt.get(i);
    if (target) return { ...target, isTarget: true, key: target.id };
    return { icon: decoyIcons[Math.floor(Math.random() * decoyIcons.length)], isTarget: false, key: `decoy-${i}` };
  });
}

export default function LookAtWorldPuzzle({ data, onSolved }) {
  const [foundIds, setFoundIds] = useState([]);
  const cells = useMemo(() => buildScene(data.targets, data.decoyIcons), [data]);
  const found = data.targets.filter((t) => foundIds.includes(t.id));
  const allFound = foundIds.length === data.targets.length;

  function tap(target) {
    if (!target || foundIds.includes(target.id)) return;
    const next = [...foundIds, target.id];
    setFoundIds(next);
    if (next.length === data.targets.length) onSolved?.();
  }

  return (
    <div className="bc-puzzle">
      <FullscreenScene
        label={
          foundIds.length === 0
            ? 'Tap to search the scene'
            : `${foundIds.length} of ${data.targets.length} found - keep searching`
        }
      >
        <p className="bc-scene-status">
          {foundIds.length} of {data.targets.length} found{allFound ? ' - nice spotting!' : ''}
        </p>
        <div className="bc-dense-grid">
          {cells.map((cell) =>
            cell.isTarget ? (
              <button
                key={cell.key}
                className={`bc-dense-cell${foundIds.includes(cell.id) ? ' bc-dense-cell-found' : ''}`}
                onClick={() => tap(cell)}
                aria-label={foundIds.includes(cell.id) ? cell.label : 'Tap to inspect'}
              >
                {cell.icon}
              </button>
            ) : (
              <span key={cell.key} className="bc-dense-cell bc-dense-cell-decoy">
                {cell.icon}
              </span>
            )
          )}
        </div>
      </FullscreenScene>
      {found.length > 0 && (
        <ul className="bc-hint-list">
          {found.map((t) => (
            <li key={t.id}>
              {t.icon} {t.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
