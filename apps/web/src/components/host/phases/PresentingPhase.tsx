import type { Round } from "@nofus/shared";

interface PresentingPhaseProps {
  currentRound?: Round;
}

export default function PresentingPhase({
  currentRound,
}: PresentingPhaseProps) {
  if (!currentRound || !currentRound.shuffledAnswerIds) return null;

  return (
    <div className="bg-gray-800 text-white rounded-lg p-6 flex flex-col gap-6">
      <div className="text-center">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-1">
          Presenting:
        </h3>
        <h2 className="text-3xl font-bold text-white leading-tight">
          {currentRound.article.title}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentRound.shuffledAnswerIds.map((playerId, index) => {
          const text =
            playerId === currentRound.targetPlayerId
              ? currentRound.article.summary
              : currentRound.lies[playerId];

          return (
            <div
              key={playerId}
              className="bg-gray-700 p-6 rounded-xl border-2 border-gray-600 flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <span className="bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded">
                  Option {index + 1}
                </span>
              </div>
              <p className="text-xl font-medium leading-relaxed italic">
                "{text}"
              </p>
            </div>
          );
        })}
      </div>

      <div className="text-center mt-4">
        <p className="text-gray-400 animate-pulse">
          Presenters, justify your summaries!
        </p>
      </div>
    </div>
  );
}
