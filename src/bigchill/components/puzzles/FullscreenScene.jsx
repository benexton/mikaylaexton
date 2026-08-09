import { useState } from 'react';

// A dense hidden-object scene reads as a real challenge only at real size -
// a thumbnail crammed into a card is unsolvable. Tap in, it goes fullscreen
// (position: fixed, covers the viewport) with an X to back out; children
// render the actual grid of icons.
export default function FullscreenScene({ label, children }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="bc-scene-launch" onClick={() => setOpen(true)}>
        <span className="bc-scene-launch-icon">🔍</span>
        <span>{label || 'Tap to search the scene'}</span>
      </button>
    );
  }

  return (
    <div className="bc-scene-fullscreen">
      <button className="bc-scene-close" onClick={() => setOpen(false)} aria-label="Close scene">
        &times;
      </button>
      {children}
    </div>
  );
}
