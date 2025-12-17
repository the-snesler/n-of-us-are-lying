import type { Player, Article } from "@nofus/shared";
import PhaseProgress from "../components/PhaseProgress";

interface WritingPhaseProps {
  players: Record<string, Player>;
  selectedArticles: Record<string, Article[]>;
  researchRoundIndex: number;
}

export default function WritingPhase({
  players,
  selectedArticles,
  researchRoundIndex,
}: WritingPhaseProps) {
  const playerStatus = Object.keys(players).reduce(
    (acc, playerId) => {
      const playerArticles = selectedArticles[playerId] || [];
      const currentArticle = playerArticles[researchRoundIndex];
      const hasSubmitted = !!(currentArticle && currentArticle.summary);
      acc[playerId] = hasSubmitted ? "ready" : "waiting";
      return acc;
    },
    {} as Record<string, "waiting" | "ready" | "presenting" | "voted">,
  );

  return (
    <div className="bg-gray-800 text-white rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4">
        Players Writing Summaries (Round {researchRoundIndex + 1}/3)
      </h3>
      <PhaseProgress players={players} playerStatus={playerStatus} />
    </div>
  );
}
