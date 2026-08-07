import { useEffect, useRef, useState } from 'react';
import BackButton from './BackButton.jsx';

const HOLD_MS = 1400;
const BLOW_VOLUME_THRESHOLD = 55; // 0-255 average byte frequency data
const SHAKE_DELTA_THRESHOLD = 18; // m/s^2 jump between motion samples

// Press and hold the valve, then blow into the mic or give the iPad a
// shake to send the steam back. Every stage keeps a tap fallback - mic and
// motion permission can be denied, unsupported, or just awkward to use
// outside, and a stuck gesture would ruin the finale (same "manual
// override always works" rule as NextStop's geofence).
export default function RestoreGesture({ onComplete, onBack }) {
  const [stage, setStage] = useState('hold'); // hold | blow
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef(null);
  const holdStartRef = useRef(0);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const lastMotionRef = useRef(null);
  const handleMotionRef = useRef(null);
  const doneRef = useRef(false);

  function cleanup() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    if (handleMotionRef.current) window.removeEventListener('devicemotion', handleMotionRef.current);
  }

  // Unmount safety net - covers quitting mid-gesture, not just finishing it.
  useEffect(() => cleanup, []); // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    cleanup();
    onComplete?.();
  }

  function startHold() {
    holdStartRef.current = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      setHoldProgress(Math.min(1, elapsed / HOLD_MS));
      if (elapsed >= HOLD_MS) {
        clearInterval(holdTimerRef.current);
        enterBlowStage();
      }
    }, 50);
  }

  function cancelHold() {
    clearInterval(holdTimerRef.current);
    setHoldProgress(0);
  }

  async function enterBlowStage() {
    setStage('blow');

    const handleMotion = (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const magnitude = Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0);
      if (lastMotionRef.current != null && Math.abs(magnitude - lastMotionRef.current) > SHAKE_DELTA_THRESHOLD) {
        finish();
      }
      lastMotionRef.current = magnitude;
    };
    handleMotionRef.current = handleMotion;

    // iOS gates motion behind an explicit permission prompt, which must be
    // triggered by a user gesture - the hold that just ended covers that.
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceMotionEvent.requestPermission();
        if (perm === 'granted') window.addEventListener('devicemotion', handleMotion);
      } catch {
        // denied or unsupported - blow or the tap fallback still work
      }
    } else if (typeof DeviceMotionEvent !== 'undefined') {
      window.addEventListener('devicemotion', handleMotion);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        if (avg > BLOW_VOLUME_THRESHOLD) {
          finish();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // mic denied or unsupported - shake or the tap fallback still work
    }
  }

  function handleBack() {
    if (stage === 'blow') {
      cleanup();
      setStage('hold');
      setHoldProgress(0);
      return;
    }
    onBack?.();
  }

  if (stage === 'hold') {
    return (
      <>
        <BackButton onClick={handleBack} />
        <span className="bc-startgate-icon" role="img" aria-label="Valve">
          🔧
        </span>
        <h2 className="bc-startgate-title">Press and hold the valve</h2>
        <p className="bc-startgate-sub">Turn the steam back on, then get ready to blow.</p>
        <button
          className="bc-btn bc-btn-primary bc-valve-btn"
          style={{ '--bc-hold-progress': holdProgress }}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
        >
          <span>Hold to turn the valve</span>
        </button>
      </>
    );
  }

  return (
    <>
      <BackButton onClick={handleBack} />
      <span className="bc-startgate-icon" role="img" aria-label="Steam">
        💨
      </span>
      <h2 className="bc-startgate-title">Now blow!</h2>
      <p className="bc-startgate-sub">Give it a big blow, or a shake, to send the steam back to the pools.</p>
      <button className="bc-btn bc-btn-primary" onClick={finish}>
        Send it back
      </button>
    </>
  );
}
