import RodeoLoginGate from './RodeoLoginGate.jsx';
import RodeoInput from './RodeoInput.jsx';

// Single mountable island for the private HQ page.
export default function RodeoHQ() {
  return (
    <RodeoLoginGate>
      {({ team, teamName, signOut }) => (
        <RodeoInput team={team} teamName={teamName} signOut={signOut} />
      )}
    </RodeoLoginGate>
  );
}
