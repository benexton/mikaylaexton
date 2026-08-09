import { useEffect, useRef, useState } from 'react';
import { clipUrl } from '../lib/bigchillSupabase.js';

// Plays a character clip by filename from the bigchill-clips Supabase
// Storage bucket. Real clips don't exist yet (the family generates them via
// ElevenLabs + a lip-sync tool - see docs/03-character-scripts.md), so a
// missing/erroring file falls back to a captioned placeholder card instead
// of a broken player. Once real MP4s land in the bucket, playback just
// starts working - no code change.
//
// Under `vite dev`, a missing clip path 200s back index.html (SPA fallback)
// instead of 404ing, so the <video> never fires `error`. A load timeout
// catches that case too, not just genuine network errors. That path doesn't
// apply once clips are cross-origin (Storage 404s properly), but the
// timeout is harmless to keep as a backstop.
export default function VideoCharacter({ clip, name, role, onDone, autoPlay = false }) {
  const [mode, setMode] = useState(autoPlay ? 'playing' : 'idle');
  const [paused, setPaused] = useState(false);
  const videoRef = useRef(null);
  const loadTimeoutRef = useRef(null);

  useEffect(() => {
    if (mode !== 'playing') return;
    loadTimeoutRef.current = setTimeout(() => setMode('fallback'), 4000);
    return () => clearTimeout(loadTimeoutRef.current);
  }, [mode]);

  if (!clip) return null;
  const src = clipUrl(clip.file);
  const initials = (clip.character || name || '?')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function play() {
    setMode('playing');
    setPaused(false);
  }

  function handleEnded() {
    videoRef.current?.pause();
    setMode('done');
    onDone?.();
  }

  function handleError() {
    setMode('fallback');
  }

  function handleLoaded() {
    clearTimeout(loadTimeoutRef.current);
  }

  function restart() {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
  }

  function togglePause() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play();
    else videoRef.current.pause();
  }

  return (
    <div className="bc-video-character">
      <div className="bc-video-frame">
        {mode === 'idle' && (
          <button className="bc-video-play" onClick={play} aria-label={`Play ${clip.character || name}`}>
            <span className="bc-video-avatar">{initials}</span>
            <span className="bc-play-icon">&#9658;</span>
          </button>
        )}

        {mode === 'playing' && (
          <video
            ref={videoRef}
            className="bc-video-el"
            src={src}
            crossOrigin="anonymous"
            autoPlay
            playsInline
            controls={false}
            onEnded={handleEnded}
            onError={handleError}
            onLoadedData={handleLoaded}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
          />
        )}

        {(mode === 'fallback' || mode === 'done') && (
          <div className="bc-video-placeholder">
            <span className="bc-video-avatar large">{initials}</span>
            {mode === 'fallback' && <p className="bc-video-placeholder-note">Clip not recorded yet</p>}
          </div>
        )}
      </div>

      {mode === 'playing' && (
        <div className="bc-video-controls">
          <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={restart} aria-label="Restart clip">
            &#9198; Restart
          </button>
          <button
            className="bc-btn bc-btn-ghost bc-btn-small"
            onClick={togglePause}
            aria-label={paused ? 'Resume clip' : 'Pause clip'}
          >
            {paused ? <>&#9658; Play</> : <>&#10074;&#10074; Pause</>}
          </button>
          <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={handleEnded} aria-label="Skip clip">
            Skip &#9197;
          </button>
        </div>
      )}

      <div className="bc-caption-box">
        <p className="bc-caption-name">{clip.character || name}</p>
        <p className="bc-caption-text">{clip.caption}</p>
      </div>

      {(mode === 'fallback' || mode === 'idle') && (
        <button
          className="bc-btn bc-btn-primary bc-video-continue"
          onClick={mode === 'idle' ? play : handleEnded}
        >
          {mode === 'idle' ? 'Play' : 'Continue'}
        </button>
      )}
      {mode === 'done' && (
        <button className="bc-btn bc-btn-primary bc-video-continue" onClick={onDone}>
          Continue
        </button>
      )}
    </div>
  );
}
