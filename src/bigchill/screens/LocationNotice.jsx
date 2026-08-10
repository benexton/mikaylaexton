// Shown once, right after the one-time code is redeemed and before the
// start gate. Location permission prompts are far more likely to be
// granted when the group already understands why the site wants it and
// knows there is a fallback if GPS misbehaves - see geo.js and NextStop.jsx.
export default function LocationNotice({ onContinue }) {
  return (
    <div className="bc-screen bc-startgate">
      <span className="bc-startgate-icon" role="img" aria-label="Compass">
        &#128205;
      </span>
      <p className="bc-kicker">Before you set off</p>
      <h1 className="bc-startgate-title">Turn on location</h1>
      <p className="bc-startgate-sub">
        When your browser asks, please allow location access. It is how each stop knows you have arrived.
      </p>

      <div className="bc-card">
        <ul className="bc-hint-list">
          <li>If GPS struggles or your phone says no, do not worry - every stop also has an &ldquo;I&rsquo;m here&rdquo; button you can tap by hand.</li>
          <li>
            Safety first: keep an eye on the road and your surroundings while you play, look properly before crossing
            any street, and stay together as a group.
          </li>
          <li>
            Runs best on a tablet or iPad with a steady internet connection - a phone hotspot works well if Wi-Fi is
            patchy out and about.
          </li>
        </ul>
      </div>

      <button className="bc-btn bc-btn-primary" onClick={onContinue}>
        Got it - let&rsquo;s go
      </button>
    </div>
  );
}
