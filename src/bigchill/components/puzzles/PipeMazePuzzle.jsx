import { useRef, useState } from 'react';

const VIEWBOX_W = 300;
const VIEWBOX_H = 340;
const PIPE_WIDTH = 30;
const PIPE_OUTLINE_WIDTH = PIPE_WIDTH + 10;
const CATCH_RADIUS = PIPE_WIDTH / 2 + 8; // a little slack past the pipe wall so small fingers aren't punished
const SOLVE_RADIUS = 22;

const PATH = [
  { x: 150, y: 40 },
  { x: 150, y: 90 },
  { x: 70, y: 90 },
  { x: 70, y: 180 },
  { x: 240, y: 180 },
  { x: 240, y: 260 },
  { x: 110, y: 260 },
  { x: 110, y: 300 },
];
const START = PATH[0];
const END = PATH[PATH.length - 1];
const PATH_D = PATH.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

function nearestOnPath(px, py) {
  let best = null;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    let t = lenSq === 0 ? 0 : ((px - a.x) * abx + (py - a.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const x = a.x + abx * t;
    const y = a.y + aby * t;
    const dist = Math.hypot(px - x, py - y);
    if (!best || dist < best.dist) best = { x, y, dist };
  }
  return best;
}

// A pipe-styled tracing maze: drag the water drop from the valve at the
// top, through the pipe, down to the leak at the bottom. The whole route
// is visible (same as a paper maze) - the pointer has to stay inside the
// pipe's width to move the drop at all, so tracing steadily through the
// turns is the actual challenge, not pathfinding. Lifting off just leaves
// the drop where it was; pressing it again picks the trace back up.
export default function PipeMazePuzzle({ onSolved }) {
  const [pos, setPos] = useState(START);
  const svgRef = useRef(null);
  const dragging = useRef(false);
  const solvedFired = useRef(false);

  function toSvgPoint(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEWBOX_W,
      y: ((clientY - rect.top) / rect.height) * VIEWBOX_H,
    };
  }

  function handlePointerDown(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
  }

  function handlePointerMove(e) {
    if (!dragging.current) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    const nearest = nearestOnPath(p.x, p.y);
    if (nearest.dist <= CATCH_RADIUS) {
      setPos({ x: nearest.x, y: nearest.y });
      if (!solvedFired.current && Math.hypot(nearest.x - END.x, nearest.y - END.y) <= SOLVE_RADIUS) {
        solvedFired.current = true;
        onSolved?.();
      }
    }
  }

  function handlePointerUp() {
    dragging.current = false;
  }

  return (
    <div className="bc-pipe-maze">
      <svg ref={svgRef} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} className="bc-pipe-maze-svg">
        <path d={PATH_D} className="bc-pipe-outline" strokeWidth={PIPE_OUTLINE_WIDTH} />
        <path d={PATH_D} className="bc-pipe-fill" strokeWidth={PIPE_WIDTH} />
        {PATH.slice(1, -1).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={PIPE_WIDTH / 2 + 3} className="bc-pipe-joint" />
        ))}
        <text x={START.x} y={START.y - 16} textAnchor="middle" className="bc-pipe-icon">
          🚰
        </text>
        <text x={END.x} y={END.y + 34} textAnchor="middle" className="bc-pipe-icon bc-pipe-icon-faint">
          💧
        </text>
        <circle
          cx={pos.x}
          cy={pos.y}
          r={PIPE_WIDTH / 2}
          className="bc-pipe-token-hit"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" className="bc-pipe-token-icon">
          💧
        </text>
      </svg>
    </div>
  );
}
