// Progress through the mystery as an actual thermometer - a vertical tube
// with mercury rising from a bulb, fixed top-right (mirroring BackButton's
// fixed top-left). value is 0-1, fraction of stops completed so far.
export default function HeatMeter({ value, label = 'Case progress' }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div
      className="bc-thermometer"
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="bc-thermometer-tube">
        <div className="bc-thermometer-fill" style={{ '--bc-heat-progress': pct }} />
      </div>
      <div className="bc-thermometer-bulb" />
    </div>
  );
}
