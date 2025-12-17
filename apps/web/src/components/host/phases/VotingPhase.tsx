import type { Player, Round } from "@nofus/shared";
import PhaseProgress from "../components/PhaseProgress";

interface VotingPhaseProps {
  players: Record<string, Player>;
  currentRound?: Round;
}

export default function VotingPhase({
  players,
  currentRound,
}: VotingPhaseProps) {
  if (!currentRound) return null;

  const playerStatus = Object.keys(players).reduce(
    (acc, playerId) => {
      if (playerId === currentRound.targetPlayerId) {
        acc[playerId] = "ready"; // Expert doesn't vote
      } else {
        const hasVoted = currentRound.votes[playerId] !== undefined;
        acc[playerId] = hasVoted ? "voted" : "waiting";
      }
      return acc;
    },
    {} as Record<string, "waiting" | "ready" | "presenting" | "voted">,
  );

  return (
    <div className="bg-gray-800 text-white rounded-lg p-6 flex flex-col gap-6">
      <div className="text-center">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-1">
          Voting on:
        </h3>
        <h2 className="text-3xl font-bold text-white">
          {currentRound.article.title}
        </h2>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/50 rounded-xl p-4 text-center">
        <p className="text-blue-200">
          Which one is the truth? Players are casting their votes!
        </p>
        {currentRound.markedTrue.length > 0 && (
          <p className="text-green-400 text-sm mt-2 font-bold">
            Expert has marked {currentRound.markedTrue.length} lie(s) as "also
            true"!
          </p>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-4 text-center">
          Voter Status
        </h4>
        <PhaseProgress players={players} playerStatus={playerStatus} />
      </div>
    </div>
  );
}
