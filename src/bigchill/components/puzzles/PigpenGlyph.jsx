import { PIGPEN_SHAPES } from './pigpen.js';

export default function PigpenGlyph({ letter, size = 26 }) {
  const shape = PIGPEN_SHAPES[letter.toUpperCase()];
  if (!shape) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" className="bc-pigpen-glyph">
      {shape.lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      ))}
      {shape.dot && <circle cx={shape.dot[0]} cy={shape.dot[1]} r="2.4" fill="currentColor" />}
    </svg>
  );
}
