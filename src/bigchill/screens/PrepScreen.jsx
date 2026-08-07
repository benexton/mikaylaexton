import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton.jsx';
import { preloadClips, requestWakeLock } from '../pwa.js';

// Runs right after the start-gate tap (the same user gesture that satisfies
// iOS's autoplay requirement also covers the Wake Lock request here).
// Pre-downloads every clip into Cache Storage so a hotspot blip never
// interrupts playback later - see docs/04-build-spec.md.
export default function PrepScreen({ onDone, onBack }) {
  const [progress, setProgress] = useState({ done: 0, total: 1 });

  useEffect(() => {
    let cancelled = false;
    requestWakeLock();
    preloadClips((done, total) => {
      if (!cancelled) setProgress({ done, total });
    }).then(() => {
      if (!cancelled) onDone();
    });
    return () => {
      cancelled = true;
    };
  }, [onDone]);

  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <div className="bc-screen bc-prep">
      <BackButton onClick={onBack} />
      <span className="bc-startgate-icon" role="img" aria-label="Steam">
        💨
      </span>
      <h2 className="bc-startgate-title">Preparing your case files&hellip;</h2>
      <p className="bc-startgate-sub">Downloading video clips so the game runs smoothly on the day.</p>
      <div className="bc-progress-meter">
        <div className="bc-progress-meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
