import type { Player, Article } from "@nofus/shared";
import PhaseProgress from "../components/PhaseProgress";

interface TopicSelectionPhaseProps {
  players: Record<string, Player>;
  selectedArticles: Record<string, Article[]>;
  researchRoundIndex: number;
  totalRounds: number;
}

export default function TopicSelectionPhase({
  players,
  selectedArticles,
  researchRoundIndex,
  totalRounds,
}: TopicSelectionPhaseProps) {
  const playerStatus = Object.keys(players).reduce(
    (acc, playerId) => {
      const playerArticles = selectedArticles[playerId] || [];
      const hasSubmitted = playerArticles.length >= researchRoundIndex + 1;
      acc[playerId] = hasSubmitted ? "ready" : "waiting";
      return acc;
    },
    {} as Record<string, "waiting" | "ready" | "presenting" | "voted">,
  );

  return (
    <div className="bg-gray-800 text-white rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4">
        Players Choosing Articles (Round {researchRoundIndex + 1}/{totalRounds})
      </h3>
      <PhaseProgress players={players} playerStatus={playerStatus} />
    </div>
  );
}
