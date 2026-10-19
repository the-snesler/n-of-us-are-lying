import type { Article, Player, Round } from "@nofus/shared";

interface LeaderboardPhaseProps {
  players: Record<string, Player>;
  playedRounds: Round[];
}

export default function LeaderboardPhase({
  players,
  playedRounds,
}: LeaderboardPhaseProps) {
  const sortedPlayers = Object.values(players).sort(
    (a, b) => b.score - a.score,
  );
  // Only articles that came up as a round; "everyone lies" topics weren't anyone's story
  const storiesByPlayer: Record<string, Article[]> = {};
  for (const round of playedRounds) {
    if (round.isEveryoneLies) continue;
    (storiesByPlayer[round.targetPlayerId] ??= []).push(round.article);
  }
  const winner = sortedPlayers[0];

  return (
    <div className="bg-gray-800 text-white rounded-lg p-8 flex flex-col gap-8 items-center">
      <div className="text-center">
        <h2 className="text-4xl font-black uppercase tracking-widest text-yellow-500 mb-2">
          Final Results
        </h2>
        {winner && (
          <p className="text-2xl font-bold">
            👑 <span className="text-yellow-400">{winner.name}</span> wins with{" "}
            {winner.score} points!
          </p>
        )}
      </div>

      <div className="w-full max-w-2xl">
        <div className="flex flex-col gap-4">
          {sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className={`flex flex-col gap-3 p-4 rounded-xl border-2 transition-all ${
                index === 0
                  ? "bg-yellow-900/20 border-yellow-500 scale-105"
                  : "bg-gray-700/50 border-gray-600"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-2xl font-black w-8 text-center text-gray-400">
                  {index + 1}
                </div>
                <div className="flex-1 font-bold text-xl">{player.name}</div>
                <div className="text-2xl font-black text-blue-400">
                  {player.score}
                </div>
              </div>

              {storiesByPlayer[player.id] && (
                <ul className="ml-12 flex flex-col gap-2">
                  {storiesByPlayer[player.id].map((article) => (
                    <li key={article.id}>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-gray-200 hover:text-white hover:underline"
                      >
                        {article.title}
                      </a>
                      <p className="text-sm italic text-gray-400">
                        "{article.summary}"
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 text-gray-500 text-sm">
        Thanks for playing "N of Us Are Lying"!
      </div>
    </div>
  );
}
