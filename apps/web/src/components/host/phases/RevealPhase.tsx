import type { Player, Round } from "@nofus/shared";

interface RevealPhaseProps {
  players: Record<string, Player>;
  currentRound?: Round;
}

export default function RevealPhase({
  players,
  currentRound,
}: RevealPhaseProps) {
  if (!currentRound || !currentRound.shuffledAnswerIds) return null;

  const isEveryoneLies = currentRound.isEveryoneLies;
  const expertId = currentRound.targetPlayerId;
  const expert = players[expertId];

  return (
    <div className="bg-gray-800 text-white rounded-lg p-6 flex flex-col gap-8">
      <div className="text-center">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-1">
          The Truth About:
        </h3>
        <h2 className="text-3xl font-bold text-white mb-2">
          {currentRound.article.title}
        </h2>
        {isEveryoneLies ? (
          <div className="inline-block bg-red-600 text-white font-black px-4 py-2 rounded-lg text-xl uppercase tracking-wider shadow-lg">
            EVERYONE WAS LYING!
          </div>
        ) : (
          <div className="inline-block bg-green-600 text-white font-black px-4 py-2 rounded-lg text-xl uppercase tracking-wider shadow-lg">
            The Expert was {expert?.name}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {currentRound.shuffledAnswerIds.map((playerId) => {
          const isExpert = !isEveryoneLies && playerId === expertId;
          const text = isExpert
            ? currentRound.article.summary
            : currentRound.lies[playerId];
          const writer = players[playerId];
          const votes = Object.entries(currentRound.votes).filter(
            ([_, answerId]) => answerId === playerId,
          );
          const isMarkedTrue = currentRound.markedTrue.includes(playerId);

          return (
            <div
              key={playerId}
              className={`p-5 rounded-xl border-2 flex flex-col gap-4 ${
                isExpert
                  ? "bg-green-900/20 border-green-500 shadow-lg shadow-green-900/20"
                  : isEveryoneLies
                    ? "bg-red-900/10 border-red-900/30"
                    : "bg-gray-700/50 border-gray-600"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-tight text-gray-400 mb-1">
                    {isExpert
                      ? "The Truth"
                      : `${writer?.name || "System"}'s Lie`}
                    {isMarkedTrue && (
                      <span className="ml-2 text-green-400 font-black">
                        (ALSO TRUE!)
                      </span>
                    )}
                  </span>
                  <p className="text-xl italic font-medium">"{text}"</p>
                </div>
              </div>

              {votes.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase">
                    Fooled:
                  </span>
                  {votes.map(([voterId]) => (
                    <span
                      key={voterId}
                      className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-600"
                    >
                      {players[voterId]?.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
