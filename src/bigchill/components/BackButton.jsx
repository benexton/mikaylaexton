// Renders nothing when there's nowhere to go back to - callers just pass
// onBack straight through, no need to check it first.
export default function BackButton({ onClick }) {
  if (!onClick) return null;
  return (
    <button className="bc-back-btn" onClick={onClick} aria-label="Go back">
      &lsaquo; Back
    </button>
  );
}
