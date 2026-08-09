import ShapeDragPuzzle from './ShapeDragPuzzle.jsx';
import JuniorMatchPuzzle from './JuniorMatchPuzzle.jsx';
import JuniorCipherPuzzle from './JuniorCipherPuzzle.jsx';
import PipeMazePuzzle from './PipeMazePuzzle.jsx';
import RiddleFillPuzzle from './RiddleFillPuzzle.jsx';
import JewelBoxPuzzle from './JewelBoxPuzzle.jsx';
import BirdMatchPuzzle from './BirdMatchPuzzle.jsx';
import LabBeakersPuzzle from './LabBeakersPuzzle.jsx';

const JUNIOR_PUZZLES_BY_TYPE = {
  shapeDrag: ShapeDragPuzzle,
  match: JuniorMatchPuzzle,
  cipher: JuniorCipherPuzzle,
  pipeMaze: PipeMazePuzzle,
  riddleFill: RiddleFillPuzzle,
  jewelBox: JewelBoxPuzzle,
  birdMatch: BirdMatchPuzzle,
  labBeakers: LabBeakersPuzzle,
};

// Same dispatch pattern as PuzzleView.jsx, for the Junior Detective side
// puzzle instead of the main group puzzle.
export default function JuniorPuzzleView({ puzzle, onSolved }) {
  const Component = JUNIOR_PUZZLES_BY_TYPE[puzzle.type];
  if (!Component) return null;
  return <Component data={puzzle.data} onSolved={onSolved} />;
}
