// Tap-to-begin screen. Exists mainly to satisfy iOS's user-gesture
// requirement for audio/video autoplay before anything tries to play a clip.
export default function StartGate({ onBegin }) {
  return (
    <div className="bc-screen bc-startgate">
      <span className="bc-startgate-icon" role="img" aria-label="Snowflake">
        ❄️
      </span>
      <p className="bc-kicker">Hanmer Springs</p>
      <h1 className="bc-startgate-title">The Big Chill</h1>
      <p className="bc-startgate-sub">
        The hot pools have run stone cold overnight. Tap in to join the case.
      </p>
      <button className="bc-btn bc-btn-primary" onClick={onBegin}>
        Tap to begin
      </button>
    </div>
  );
}
