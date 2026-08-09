import { useRef } from 'react';

const DEBOUNCE_MS = 400;

// Renders nothing when there's nowhere to go back to - callers just pass
// onBack straight through, no need to check it first.
//
// iOS Safari can occasionally deliver a tap as two rapid synthetic clicks
// (ghost clicks, or a real fast double-tap from an eager kid), and since
// every "back" handler in this app is a step-back (pop one local sub-stage,
// or pop one history entry), two clicks in quick succession silently step
// back TWICE - reading to the player as "back skipped a step". Debouncing
// here fixes it once for every screen that uses this component, regardless
// of which specific handler is wired up.
export default function BackButton({ onClick }) {
  const lastClickRef = useRef(0);

  if (!onClick) return null;

  function handleClick(e) {
    const now = Date.now();
    if (now - lastClickRef.current < DEBOUNCE_MS) return;
    lastClickRef.current = now;
    onClick(e);
  }

  return (
    <button className="bc-back-btn" onClick={handleClick} aria-label="Go back">
      &lsaquo; Back
    </button>
  );
}
