import { useEffect, useRef } from 'react';

// Overlay, reachable between stops and during the accusation. Each stop
// gets its own card: once solved, it shows the number the group dialled in
// (they'll need every one to open the heat lock at the end), plus a free
// text field where the team writes down their own take on what came up
// while questioning that suspect - the game doesn't hand them a canned
// clue here, the deduction is theirs to record. Stops not yet reached just
// show a placeholder, so the case file doubles as a progress tracker.
//
// highlightStopId marks the stop the group just finished interviewing -
// BigChillApp opens the case file automatically the moment they hit
// Continue on the "Interview complete" card, and this scrolls straight to
// that stop's notes field so writing them down is the next natural action
// rather than a separate trip back in later.
export default function CaseFile({ stops, suspects, completedStopIds, notes, onNoteChange, onClose, highlightStopId }) {
  const highlightRef = useRef(null);

  useEffect(() => {
    if (highlightStopId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
      highlightRef.current.focus();
    }
  }, [highlightStopId]);

  return (
    <div className="bc-overlay" role="dialog" aria-label="Case file">
      <div className="bc-overlay-panel">
        <div className="bc-overlay-header">
          <h2>Case file</h2>
          <button className="bc-btn bc-btn-ghost bc-btn-small" onClick={onClose}>
            Close
          </button>
        </div>

        {highlightStopId && (
          <p className="bc-casefile-prompt">
            Nice work! Jot down what you learned before you head to the next stop.
          </p>
        )}

        <div className="bc-suspect-list">
          {stops.map((stop) => {
            const done = completedStopIds.includes(stop.id);
            const suspect = suspects.find((s) => s.id === stop.suspectId);
            return (
              <div className="bc-card bc-suspect-card" key={stop.id}>
                <h3>{stop.title}</h3>
                {suspect && <p className="bc-stop-location">{suspect.name}</p>}
                {done ? (
                  <>
                    <p className="bc-casefile-number">{stop.puzzle.data.answer}</p>
                    <label className="bc-casefile-notes-label" htmlFor={`bc-notes-${stop.id}`}>
                      What did you learn from questioning them?
                    </label>
                    <textarea
                      id={`bc-notes-${stop.id}`}
                      ref={stop.id === highlightStopId ? highlightRef : undefined}
                      className="bc-casefile-notes"
                      rows={2}
                      value={notes[stop.id] || ''}
                      onChange={(e) => onNoteChange(stop.id, e.target.value)}
                      placeholder="Write down what you found out..."
                    />
                  </>
                ) : (
                  <p className="bc-stop-location">Not yet solved.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
