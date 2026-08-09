import DigitInput from './DigitInput.jsx';

// A plain text riddle whose answer is a short digit code. Hints (e.g.
// "strip away the frost") live in the stop's own puzzle.hints array and are
// shown by StopScreen's existing "Need a hint?" control, same as every
// other puzzle type - no separate hint UI needed here. The typed guess is
// owned by StopScreen and checked centrally.
export default function RiddlePuzzle({ data, guess, onGuessChange }) {
  return (
    <div className="bc-puzzle">
      <p className="bc-riddle-text">{data.riddle}</p>
      <DigitInput value={guess} onChange={onGuessChange} />
    </div>
  );
}
