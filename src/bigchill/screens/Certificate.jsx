import BackButton from '../components/BackButton.jsx';

// Printable finale screen. The family prints it themselves (browser print),
// no server-generated PDF needed per the build spec.
export default function Certificate({ juniorNames, onRestart, onBack }) {
  const hasJuniors = juniorNames && juniorNames.length > 0;
  const names = hasJuniors ? juniorNames.join(' & ') : 'The Detective Team';

  return (
    <div className="bc-screen bc-certificate-screen">
      <BackButton onClick={onBack} />
      <div className="bc-certificate">
        <p className="bc-kicker">The Big Chill</p>
        <h1>Case Closed</h1>
        <p className="bc-certificate-name">{names}</p>
        <p>
          {hasJuniors
            ? `${juniorNames.length > 1 ? 'are' : 'is'} hereby recognised as the Junior Detective${
                juniorNames.length > 1 ? 's' : ''
              } who cracked the case and brought the heat back to Hanmer Springs.`
            : 'is hereby recognised for cracking the case and bringing the heat back to Hanmer Springs.'}
        </p>
      </div>
      <div className="bc-junior-actions bc-no-print">
        <button className="bc-btn bc-btn-primary" onClick={() => window.print()}>
          Print certificate
        </button>
        <button className="bc-btn bc-btn-ghost" onClick={onRestart}>
          Play again
        </button>
      </div>
    </div>
  );
}
