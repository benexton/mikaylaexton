import DigitInput from './DigitInput.jsx';

// A picture puzzle (rebus, hidden-object count, etc) backed by a plain
// image asset under public/the-big-chill/puzzles/ - source PDFs get
// rendered to a cropped PNG at build time, see docs/. Just displays the
// image; the typed guess is owned by StopScreen and checked centrally.
export default function ImagePuzzle({ data, guess, onGuessChange }) {
  return (
    <div className="bc-puzzle">
      <img src={data.image} alt={data.alt || 'Puzzle image'} className="bc-puzzle-image" />
      <DigitInput value={guess} onChange={onGuessChange} />
    </div>
  );
}
