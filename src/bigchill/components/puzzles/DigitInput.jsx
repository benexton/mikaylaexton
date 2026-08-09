// Plain controlled text field shared by the "reveals a short digit code"
// puzzles (ImagePuzzle, RiddlePuzzle, NumberCipherPuzzle). Checking the
// answer happens centrally via StopScreen's single Check/Continue button at
// the bottom of the screen, not here - this is just the input.
export default function DigitInput({ value, onChange }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter the number"
      className="bc-digit-input"
    />
  );
}
