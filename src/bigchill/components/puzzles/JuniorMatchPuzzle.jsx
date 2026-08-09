import { useState } from 'react';
import DragDropBoard from './DragDropBoard.jsx';
import { shuffle } from './shuffle.js';

// Drag each icon onto its matching pair (e.g. a baby animal onto its
// parent) - the slot already shows the full-colour target icon, so this
// reads as more visually guided than ShapeDragPuzzle's outline-only slots,
// which suits the youngest player at the table.
export default function JuniorMatchPuzzle({ data, onSolved }) {
  const [solved, setSolved] = useState(false);
  const [tokens] = useState(() =>
    shuffle(data.pairs.map((p) => ({ id: p.id, render: <span className="bc-drag-icon">{p.dragIcon}</span> })))
  );
  const slots = data.pairs.map((p) => ({
    id: p.id,
    render: (
      <>
        <span className="bc-drag-slot-icon">{p.targetIcon}</span>
        <span className="bc-drag-slot-label">{p.label}</span>
      </>
    ),
  }));

  function handleSolved() {
    setSolved(true);
    onSolved?.();
  }

  return (
    <div className="bc-puzzle">
      <DragDropBoard tokens={tokens} slots={slots} onSolved={handleSolved} slotClassName="bc-drag-slot-icon-target" />
      {solved && <p className="bc-kicker">Solved - every pair matched!</p>}
    </div>
  );
}
