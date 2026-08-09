import PigpenGlyph from './PigpenGlyph.jsx';
import { PIGPEN_ALPHABET } from './pigpen.js';
import DigitInput from './DigitInput.jsx';

// The adult pigpen cipher (same mechanic as the original CipherPuzzle),
// but data.phrase spells out a number in words rather than a sentence -
// decoding it is still the real challenge, the player just enters the
// digit form of what they decoded. The typed guess is owned by StopScreen
// and checked centrally.
export default function NumberCipherPuzzle({ data, guess, onGuessChange }) {
  return (
    <div className="bc-puzzle">
      <div className="bc-cipher-message">
        {data.phrase.split(' ').map((word, wi) => (
          <span className="bc-cipher-word" key={wi}>
            {[...word].map((letter, li) => (
              <PigpenGlyph key={li} letter={letter} />
            ))}
          </span>
        ))}
      </div>

      <details className="bc-cipher-legend">
        <summary>Show the decoder key</summary>
        <div className="bc-cipher-legend-grid">
          {PIGPEN_ALPHABET.map((letter) => (
            <div className="bc-cipher-legend-cell" key={letter}>
              <PigpenGlyph letter={letter} size={20} />
              <span>{letter}</span>
            </div>
          ))}
        </div>
      </details>

      <DigitInput value={guess} onChange={onGuessChange} />
    </div>
  );
}
