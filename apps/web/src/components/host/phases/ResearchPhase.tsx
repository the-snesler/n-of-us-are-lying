import type { Player, Article } from "@nofus/shared";
import PlayerGrid from "../../shared/PlayerGrid";
import PlayerCard from "../../shared/PlayerCard";
import { getResearchProgress } from "../../../lib/research";

interface ResearchPhaseProps {
  players: Record<string, Player>;
  selectedArticles: Record<string, Article[]>;
  articlesPerPlayer: number;
}

export default function ResearchPhase({
  players,
  selectedArticles,
  articlesPerPlayer,
}: ResearchPhaseProps) {
  const playerList = Object.values(players);
  const doneCount = playerList.filter(
    (p) =>
      getResearchProgress(selectedArticles[p.id], articlesPerPlayer).step ===
      "done",
  ).length;

  return (
    <div className="bg-gray-800 text-white rounded-lg p-6">
      <div className="flex justify-between items-baseline mb-2">
        <h3 className="text-xl font-semibold">Research</h3>
        <span className="text-gray-400">
          {doneCount}/{playerList.length} players done
        </span>
      </div>
      <p className="text-gray-400 mb-6">
        Pick {articlesPerPlayer} Wikipedia articles, read up, and write a
        one-sentence summary for each. Go at your own pace!
      </p>
      <PlayerGrid>
        {playerList.map((player) => {
          const articles = selectedArticles[player.id] || [];
          const progress = getResearchProgress(articles, articlesPerPlayer);
          const isDone = progress.step === "done";

          const statusText = !player.isConnected
            ? "Disconnected"
            : isDone
              ? "✓ All done"
              : progress.step === "writing"
                ? `Writing summary ${progress.completed + 1}`
                : `Picking article ${progress.completed + 1}`;

          return (
            <PlayerCard
              key={player.id}
              player={player}
              variant={isDone ? "success" : "waiting"}
            >
              <div
                className={`text-sm mt-1 ${
                  isDone
                    ? "text-green-400"
                    : player.isConnected
                      ? "text-gray-300"
                      : "text-red-400"
                }`}
              >
                {statusText}
              </div>
              <div className="flex gap-1 mt-3">
                {Array.from({ length: articlesPerPlayer }, (_, i) => {
                  const article = articles[i];
                  const slotState = article?.summary
                    ? "written"
                    : article
                      ? "chosen"
                      : "empty";
                  return (
                    <div
                      key={i}
                      title={
                        slotState === "written"
                          ? "Summary written"
                          : slotState === "chosen"
                            ? "Article chosen"
                            : "Not started"
                      }
                      className={`h-2 flex-1 rounded-full ${
                        slotState === "written"
                          ? "bg-green-500"
                          : slotState === "chosen"
                            ? "bg-yellow-400 animate-pulse"
                            : "bg-gray-600"
                      }`}
                    />
                  );
                })}
              </div>
            </PlayerCard>
          );
        })}
      </PlayerGrid>
    </div>
  );
}
