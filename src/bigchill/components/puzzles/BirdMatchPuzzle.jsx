import { useState } from 'react';
import DragDropBoard from './DragDropBoard.jsx';
import { shuffle } from './shuffle.js';

const BIRDS = [
  { id: 'piwakawaka', label: 'Pī-wakawaka', image: '/the-big-chill/puzzles/bird-fantail.png' },
  { id: 'kiwi', label: 'Kiwi', image: '/the-big-chill/puzzles/bird-kiwi.png' },
  { id: 'pukeko', label: 'Pukeko', image: '/the-big-chill/puzzles/bird-pukeko.png' },
];

// Same label-only-slot pattern as ShapeDragPuzzle (the box shows just the
// bird's name, no picture hint), but the tokens are real bird illustrations
// instead of emoji - drag each photo onto the name it belongs to.
export default function BirdMatchPuzzle({ onSolved }) {
  const [tokens] = useState(() =>
    shuffle(
      BIRDS.map((b) => ({
        id: b.id,
        render: <img src={b.image} alt={b.label} className="bc-bird-token-img" />,
      }))
    )
  );
  const slots = BIRDS.map((b) => ({
    id: b.id,
    render: <span className="bc-drag-slot-label">{b.label}</span>,
  }));

  return (
    <div className="bc-puzzle">
      <DragDropBoard tokens={tokens} slots={slots} onSolved={onSolved} slotClassName="bc-drag-slot-outline" />
    </div>
  );
}
