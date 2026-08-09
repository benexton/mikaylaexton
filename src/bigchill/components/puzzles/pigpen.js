// Pigpen cipher shapes, built from the classic rule rather than hand-drawn:
// A-I sit in a 3x3 grid and each letter's symbol is the internal grid lines
// bordering its cell (so corner letters get 2 lines, the centre letter gets
// a full box). J-R repeat the same 9 shapes with a dot added. S-V are the 4
// wedges of an X (top/right/bottom/left), and W-Z repeat those with a dot.
// This is self-consistent even if it doesn't match one "true" historical
// pigpen chart letter-for-letter - the puzzle always ships its own legend,
// so internal consistency is what actually matters for solvability.
function gridShape(index, dot) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const x0 = col * 10;
  const x1 = x0 + 10;
  const y0 = row * 10;
  const y1 = y0 + 10;
  const lines = [];
  if (col > 0) lines.push([x0, y0, x0, y1]);
  if (col < 2) lines.push([x1, y0, x1, y1]);
  if (row > 0) lines.push([x0, y0, x1, y0]);
  if (row < 2) lines.push([x0, y1, x1, y1]);
  return { lines, dot: dot ? [x0 + 5, y0 + 5] : null };
}

const X_ARMS = {
  top: [
    [0, 0, 15, 15],
    [30, 0, 15, 15],
  ],
  right: [
    [30, 0, 15, 15],
    [30, 30, 15, 15],
  ],
  bottom: [
    [0, 30, 15, 15],
    [30, 30, 15, 15],
  ],
  left: [
    [0, 0, 15, 15],
    [0, 30, 15, 15],
  ],
};
const X_DOT_POS = { top: [15, 8], right: [22, 15], bottom: [15, 22], left: [8, 15] };

function xShape(quadrant, dot) {
  return { lines: X_ARMS[quadrant], dot: dot ? X_DOT_POS[quadrant] : null };
}

const GRID_LETTERS = 'ABCDEFGHI';
const GRID_DOT_LETTERS = 'JKLMNOPQR';
const X_LETTERS = 'STUV';
const X_DOT_LETTERS = 'WXYZ';
const QUADRANT_ORDER = ['top', 'right', 'bottom', 'left'];

export const PIGPEN_SHAPES = {};
[...GRID_LETTERS].forEach((letter, i) => { PIGPEN_SHAPES[letter] = gridShape(i, false); });
[...GRID_DOT_LETTERS].forEach((letter, i) => { PIGPEN_SHAPES[letter] = gridShape(i, true); });
[...X_LETTERS].forEach((letter, i) => { PIGPEN_SHAPES[letter] = xShape(QUADRANT_ORDER[i], false); });
[...X_DOT_LETTERS].forEach((letter, i) => { PIGPEN_SHAPES[letter] = xShape(QUADRANT_ORDER[i], true); });

export const PIGPEN_ALPHABET = Object.keys(PIGPEN_SHAPES);
