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
const FADE_MS = 1000;

export default function VideoCharacter({ clip, name, role, onDone, autoPlay = false, overlay }) {
  const [mode, setMode] = useState(autoPlay ? 'playing' : 'idle');
  const [paused, setPaused] = useState(false);
  // Drives the video's opacity - false at the start of every 'playing' run
  // (fade in once frames actually arrive) and flipped back to false to fade
  // out before finish() hands off to onDone, so cutting to the next screen
  // never feels like a hard jump cut.
  const [visible, setVisible] = useState(false);
  const [ending, setEnding] = useState(false);
  const videoRef = useRef(null);
  const loadTimeoutRef = useRef(null);
  const endTimeoutRef = useRef(null);

  useEffect(() => {
    if (mode !== 'playing') return;
    loadTimeoutRef.current = setTimeout(() => setMode('fallback'), 4000);
    return () => clearTimeout(loadTimeoutRef.current);
  }, [mode]);

  useEffect(() => () => clearTimeout(endTimeoutRef.current), []);

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
    setVisible(false);
    setEnding(false);
    setMode('playing');
    setPaused(false);
  }

  // Fades the clip out before handing off to onDone (unless there's no
  // video actually playing to fade - the fallback/idle continue button
  // calls this too and should just advance immediately).
  function finish() {
    if (mode !== 'playing') {
      onDone?.();
      return;
    }
    videoRef.current?.pause();
    setEnding(true);
    setVisible(false);
    endTimeoutRef.current = setTimeout(() => {
      setMode('done');
      onDone?.();
    }, FADE_MS);
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
          <button
            className={`bc-video-play${clip.poster ? ' bc-video-play-poster' : ''}`}
            style={clip.poster ? { backgroundImage: `url(${clip.poster})` } : undefined}
            onClick={play}
            aria-label={`Play ${clip.character || name}`}
          >
            {!clip.poster && <span className="bc-video-avatar">{initials}</span>}
            <span className="bc-play-icon">&#9658;</span>
          </button>
        )}

        {mode === 'playing' && (
          <video
            ref={videoRef}
            className={`bc-video-el${visible ? ' bc-video-visible' : ''}`}
            src={src}
            poster={clip.poster}
            crossOrigin="anonymous"
            autoPlay
            playsInline
            controls={false}
            onEnded={finish}
            onError={handleError}
            onLoadedData={handleLoaded}
            onPlaying={() => {
              setVisible(true);
              setPaused(false);
            }}
            onPause={() => setPaused(true)}
          />
        )}

        {(mode === 'fallback' || mode === 'done') && (
          <div className="bc-video-placeholder">
            <span className="bc-video-avatar large">{initials}</span>
            {mode === 'fallback' && <p className="bc-video-placeholder-note">Clip not recorded yet</p>}
          </div>
        )}

        {overlay}
      </div>

      {mode === 'playing' && !ending && (
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
          <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={finish} aria-label="Skip clip">
            Skip &#9197;
          </button>
        </div>
      )}

      <div className="bc-caption-box">
        <p className="bc-caption-name">{clip.character || name}</p>
        <p className="bc-caption-text">{clip.caption}</p>
      </div>

      {(mode === 'fallback' || mode === 'idle') && (
        <button className="bc-btn bc-btn-primary bc-video-continue" onClick={mode === 'idle' ? play : finish}>
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
