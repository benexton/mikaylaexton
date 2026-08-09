import { useRef, useState } from 'react';

// Generic true drag-and-drop engine shared by every junior puzzle that's
// "drag a token onto the one slot it belongs to" (ShapeDragPuzzle,
// JuniorMatchPuzzle) - matching id between a token and a slot is the only
// rule. Built on the Pointer Events API rather than HTML5 drag-and-drop,
// which is unreliable on iOS/iPadOS touch; pointer capture keeps move/up
// events routed to the token that's being dragged no matter where the
// finger ends up, so hit-testing at drop time just asks the DOM what's
// visually under the release point.
export default function DragDropBoard({ tokens, slots, onSolved, slotClassName = '' }) {
  const [placed, setPlaced] = useState({}); // slotId -> tokenId
  const [dragging, setDragging] = useState(null); // { tokenId, pointerId, x, y, width, height }
  const dragOffset = useRef({ x: 0, y: 0 });
  const solvedFired = useRef(false);

  const placedTokenIds = Object.values(placed);
  const trayTokens = tokens.filter((t) => !placedTokenIds.includes(t.id));

  function handlePointerDown(e, token) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({
      tokenId: token.id,
      pointerId: e.pointerId,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }

  function handlePointerMove(e) {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    setDragging((d) => d && { ...d, x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
  }

  function handlePointerUp(e) {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = el?.closest('[data-slot-id]');
    const slotId = slotEl?.dataset.slotId;
    if (slotId && slotId === dragging.tokenId && !placed[slotId]) {
      // Compute the next map here rather than inside a setState updater -
      // updater functions can run during React's render phase, and calling
      // the parent's onSolved (another component's setState) from in there
      // trips "Cannot update a component while rendering a different
      // component". Reading `placed` from the event-handler closure is
      // safe since this only ever runs from a real pointerup event.
      const next = { ...placed, [slotId]: dragging.tokenId };
      setPlaced(next);
      if (Object.keys(next).length === slots.length && !solvedFired.current) {
        solvedFired.current = true;
        onSolved?.();
      }
    }
    setDragging(null);
  }

  return (
    <div className="bc-drag-board">
      <div className="bc-drag-slots">
        {slots.map((slot) => {
          const tokenId = placed[slot.id];
          const token = tokenId && tokens.find((t) => t.id === tokenId);
          return (
            <div
              key={slot.id}
              data-slot-id={slot.id}
              className={`bc-drag-slot ${slotClassName} ${token ? 'bc-drag-slot-filled' : ''}`}
            >
              {slot.render}
              {token && <span className="bc-drag-slot-token">{token.render}</span>}
            </div>
          );
        })}
      </div>

      <div className="bc-drag-tray">
        {trayTokens.map((token) => (
          <button
            key={token.id}
            type="button"
            className={`bc-drag-token${dragging?.tokenId === token.id ? ' bc-drag-token-hidden' : ''}`}
            onPointerDown={(e) => handlePointerDown(e, token)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setDragging(null)}
          >
            {token.render}
          </button>
        ))}
      </div>

      {dragging && (
        <div
          className="bc-drag-token bc-drag-token-ghost"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: dragging.width,
            height: dragging.height,
            transform: `translate(${dragging.x}px, ${dragging.y}px)`,
            pointerEvents: 'none',
          }}
        >
          {tokens.find((t) => t.id === dragging.tokenId)?.render}
        </div>
      )}
    </div>
  );
}
