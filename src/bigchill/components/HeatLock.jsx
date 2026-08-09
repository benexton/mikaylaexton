import { useState } from 'react';
import BackButton from './BackButton.jsx';
import { STOPS } from '../game.config.js';

// The code is every stop's puzzle answer concatenated in stop order - the
// same digits the group has been collecting in their case file all game,
// so there's nothing new to invent here, just derive it once.
const CODE = STOPS.map((s) => s.puzzle.data.answer).join('');
const FLASH_MS = 1800;

// A pump/valve-style combination lock: one rotating dial per digit of the
// code, tap the arrows to dial each wheel in, then try to turn the heat
// back on. Same green/red whole-screen flash as every other answer check
// in the game, just guarding the finale instead of a single stop.
export default function HeatLock({ onComplete, onBack }) {
  const [digits, setDigits] = useState(() => CODE.split('').map(() => 0));
  const [flash, setFlash] = useState(null); // null | 'correct' | 'wrong'

  function bump(i, delta) {
    setDigits((d) => {
      const next = [...d];
      next[i] = (next[i] + delta + 10) % 10;
      return next;
    });
  }

  function handleCheck() {
    const correct = digits.join('') === CODE;
    setFlash(correct ? 'correct' : 'wrong');
    setTimeout(() => {
      setFlash(null);
      if (correct) onComplete?.();
    }, FLASH_MS);
  }

  return (
    <>
      {flash && <div className={`bc-answer-flash bc-answer-flash-${flash}`} />}
      <BackButton onClick={onBack} />
      <span className="bc-startgate-icon bc-heatlock-icon" role="img" aria-label="Valve">
        🚰
      </span>
      <p className="bc-kicker">Restore the heat</p>
      <h2 className="bc-startgate-title">Turn the heat back on</h2>
      <p className="bc-heatlock-flavor">
        The villain jammed the valve shut so no one could get hot water to the pools. Dial in every
        number your case file collected along the way, then crank it open and get the water flowing
        again for the whole town.
      </p>

      <div className="bc-heat-lock">
        {digits.map((d, i) => (
          <div className="bc-lock-digit" key={i}>
            <button type="button" className="bc-lock-arrow" onClick={() => bump(i, 1)} aria-label="Dial up">
              &#9650;
            </button>
            <span key={d} className="bc-lock-digit-value">
              {d}
            </span>
            <button type="button" className="bc-lock-arrow" onClick={() => bump(i, -1)} aria-label="Dial down">
              &#9660;
            </button>
          </div>
        ))}
      </div>

      <button className="bc-btn bc-btn-primary" onClick={handleCheck}>
        Turn the heat back on
      </button>
    </>
  );
}
