import { useEffect, useRef } from 'react';
import StopMap from '../components/StopMap.jsx';
import BackButton from '../components/BackButton.jsx';
import { useLiveLocation, haversineMeters } from '../geo.js';

// Real street map with a live location dot and a geofenced auto-unlock.
// The manual "I'm here" button always works regardless of GPS state -
// coverage in the valley can drift, and a stuck geofence would ruin the
// game (see docs/04-build-spec.md).
export default function NextStop({ stop, stopsTotal, onArrive, onOpenCaseFile, onBack }) {
  const { position, error } = useLiveLocation();
  const arrivedRef = useRef(false);

  const distance = position ? haversineMeters(position, stop.coords) : null;
  const inRange = distance != null && distance <= stop.geofenceRadiusM;

  useEffect(() => {
    if (inRange && !arrivedRef.current) {
      arrivedRef.current = true;
      onArrive();
    }
  }, [inRange, onArrive]);

  return (
    <div className="bc-screen bc-nextstop">
      <BackButton onClick={onBack} />
      <p className="bc-kicker">
        Next stop {stop.order} of {stopsTotal}
      </p>
      <h2 className="bc-startgate-title">{stop.title}</h2>
      <p className="bc-startgate-sub">{stop.locationLabel}</p>

      <StopMap stop={stop} userPosition={position} />

      {error && (
        <p className="bc-stop-location">Location unavailable - tap &ldquo;I&rsquo;m here&rdquo; when you arrive.</p>
      )}
      {!error && position && !inRange && (
        <p className="bc-stop-location">About {Math.round(distance)}m away</p>
      )}

      <button className="bc-btn bc-btn-primary" onClick={onArrive}>
        I&rsquo;m here
      </button>
      <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={onOpenCaseFile}>
        Case file
      </button>
    </div>
  );
}
