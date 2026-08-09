import { useState } from 'react';
import DragDropBoard from './DragDropBoard.jsx';
import { shuffle } from './shuffle.js';

// Drag each shape token onto the word it belongs to - the slot only shows
// the label (no icon hint), so the challenge is actually reading and
// matching the word rather than pattern-matching a picture to its ghost.
export default function ShapeDragPuzzle({ data, onSolved }) {
  const [solved, setSolved] = useState(false);
  const [tokens] = useState(() =>
    shuffle(data.pieces.map((p) => ({ id: p.id, render: <span className="bc-drag-icon">{p.icon}</span> })))
  );
  const slots = data.pieces.map((p) => ({
    id: p.id,
    render: <span className="bc-drag-slot-label">{p.label}</span>,
  }));

  function handleSolved() {
    setSolved(true);
    onSolved?.();
  }

  return (
    <div className="bc-puzzle">
      <DragDropBoard tokens={tokens} slots={slots} onSolved={handleSolved} slotClassName="bc-drag-slot-outline" />
      {solved && <p className="bc-kicker">Solved - every shape in its outline!</p>}
    </div>
  );
}
