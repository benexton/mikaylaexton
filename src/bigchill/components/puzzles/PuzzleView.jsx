import LookAtWorldPuzzle from './LookAtWorldPuzzle.jsx';
import CountPuzzle from './CountPuzzle.jsx';
import CipherPuzzle from './CipherPuzzle.jsx';
import MatchPuzzle from './MatchPuzzle.jsx';
import ImagePuzzle from './ImagePuzzle.jsx';
import RiddlePuzzle from './RiddlePuzzle.jsx';
import NumberCipherPuzzle from './NumberCipherPuzzle.jsx';

const PUZZLES_BY_TYPE = {
  lookAtWorld: LookAtWorldPuzzle,
  count: CountPuzzle,
  cipher: CipherPuzzle,
  match: MatchPuzzle,
  image: ImagePuzzle,
  riddle: RiddlePuzzle,
  numberCipher: NumberCipherPuzzle,
};

// Picks the interactive puzzle for a stop by puzzle.type. Each one is a
// self-contained mini-game - the prompt/hints stay in StopScreen, this is
// just the "solve it" widget that replaces the old self-report "Found it"
// button once solved for real.
//
// Interactive types (count/match/lookAtWorld/cipher) call onSolved
// themselves the moment they're correctly completed. Digit-answer types
// (image/riddle/numberCipher) don't self-check any more - they just take
// guess/onGuessChange, and StopScreen validates the typed answer centrally
// when the group hits Check. Both sets of props are passed to every
// component; each just uses the ones it needs.
export default function PuzzleView({ puzzle, onSolved, guess, onGuessChange }) {
  const Component = PUZZLES_BY_TYPE[puzzle.type];
  if (!Component) return null;
  return <Component data={puzzle.data} onSolved={onSolved} guess={guess} onGuessChange={onGuessChange} />;
}
