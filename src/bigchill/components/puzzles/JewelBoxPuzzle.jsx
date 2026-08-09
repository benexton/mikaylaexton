import { useState } from 'react';
import DragDropBoard from './DragDropBoard.jsx';
import { shuffle } from './shuffle.js';

// Each cushion shape is defined once and reused for both the coloured gem
// (the draggable token) and the dashed cushion outline (the slot) - same
// silhouette for both, so a correct drop always looks like a perfect fit.
const SHAPES = {
  heart: {
    el: 'path',
    props: {
      d: 'M20 33 C3 20 3 7 14 7 C18 7 20 11 20 11 C20 11 22 7 26 7 C37 7 37 20 20 33 Z',
    },
  },
  oval: { el: 'ellipse', props: { cx: 20, cy: 16, rx: 17, ry: 12 } },
  drop: {
    el: 'path',
    props: { d: 'M20 3 C29 15 34 22 34 28 A14 14 0 1 1 6 28 C6 22 11 15 20 3 Z' },
  },
  trapezoid: { el: 'polygon', props: { points: '12,6 28,6 36,34 4,34' } },
  circle: { el: 'circle', props: { cx: 20, cy: 20, r: 16 } },
  triangle: { el: 'polygon', props: { points: '20,4 36,34 4,34' } },
};

const GEMS = [
  { id: 'heart', color: '#ff5f8f' },
  { id: 'oval', color: '#ffab2e' },
  { id: 'drop', color: '#4fb3ff' },
  { id: 'trapezoid', color: '#b667ff' },
  { id: 'circle', color: '#ff4d4d' },
  { id: 'triangle', color: '#3fbf6f' },
];

function ShapeSvg({ shape, fill, outline }) {
  const def = SHAPES[shape];
  const Tag = def.el;
  return (
    <svg viewBox="0 0 40 40" className="bc-jewel-svg">
      <Tag
        {...def.props}
        fill={fill || 'none'}
        stroke={outline ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.35)'}
        strokeWidth={outline ? 2 : 1.5}
        strokeDasharray={outline ? '4 3' : undefined}
      />
      {fill && <ellipse cx="15" cy="14" rx="5" ry="3" fill="rgba(255,255,255,.5)" />}
    </svg>
  );
}

// The Baroness's spilled jewel box: six gems, six velvet cushions, drag
// each gem back onto the cushion with the matching outline. Built on the
// same DragDropBoard engine as every other junior drag puzzle, just with
// custom SVG shapes instead of emoji.
export default function JewelBoxPuzzle({ onSolved }) {
  const [tokens] = useState(() =>
    shuffle(GEMS.map((g) => ({ id: g.id, render: <ShapeSvg shape={g.id} fill={g.color} /> })))
  );
  const slots = GEMS.map((g) => ({ id: g.id, render: <ShapeSvg shape={g.id} outline /> }));

  return (
    <div className="bc-puzzle">
      <div className="bc-jewel-box">
        <DragDropBoard tokens={tokens} slots={slots} onSolved={onSolved} slotClassName="bc-jewel-slot" />
      </div>
    </div>
  );
}
