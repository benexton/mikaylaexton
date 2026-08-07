// Overlay, reachable between stops and during the accusation. Suspects not
// yet interviewed stay locked so the deduction only builds from what the
// group has actually gathered. completedStops is in visit order, so the
// evidence log reads back like a case diary.
export default function CaseFile({ suspects, visitedSuspectIds, tells, completedStops, onClose }) {
  return (
    <div className="bc-overlay" role="dialog" aria-label="Case file">
      <div className="bc-overlay-panel">
        <div className="bc-overlay-header">
          <h2>Case file</h2>
          <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={onClose}>
            Close
          </button>
        </div>

        {completedStops && completedStops.length > 0 && (
          <div className="bc-card bc-evidence-card">
            <h3>Evidence gathered</h3>
            <ul className="bc-hint-list">
              {completedStops.map((stop) => (
                <li key={stop.id}>
                  <strong>{stop.title}:</strong> {stop.evidenceLabel}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bc-suspect-list">
          {suspects.map((s) => {
            const visited = visitedSuspectIds.includes(s.id);
            return (
              <div className="bc-card bc-suspect-card" key={s.id}>
                <h3>{s.name}</h3>
                <p className="bc-stop-location">{s.role}</p>
                {visited ? (
                  <>
                    <ul className="bc-hint-list">
                      {tells.map((tell) => (
                        <li key={tell.id}>
                          {s.traits[tell.id] ? '✓' : '✗'} {tell.label}
                        </li>
                      ))}
                    </ul>
                    <p>{s.clearedBy || 'No alibi confirmed.'}</p>
                  </>
                ) : (
                  <p className="bc-stop-location">Not yet interviewed.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
