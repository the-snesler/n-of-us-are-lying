import type { Player } from "@nofus/shared";
import SubmissionConfirm from "../components/SubmissionConfirm";

interface VotingPhaseProps {
  playerId: string;
  players: Record<string, Player>;
  isExpert: boolean;
  answers: { id: string; text: string }[];
  hasVoted: boolean;
  markedTrue?: string[];
  onVote: (answerId: string) => void;
  onMarkTrue: (playerId: string) => void;
}

export default function VotingPhase({
  playerId,
  players,
  isExpert,
  answers,
  hasVoted,
  markedTrue = [],
  onVote,
  onMarkTrue,
}: VotingPhaseProps) {
  // Players who didn't submit are shown on the TV, but there's nothing to vote for
  const votable = answers.filter(
    (answer) => answer.text && answer.id !== playerId,
  );

  if (hasVoted) {
    return (
      <SubmissionConfirm
        message="Vote cast!"
        subtext="Waiting for other players..."
      />
    );
  }

  if (isExpert) {
    return (
      <div className="flex flex-col gap-6">
        <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            You are the EXPERT!
          </h2>
          <p className="text-blue-200 text-sm leading-tight">
            If someone already knew the truth, mark their summary as "Also True"
            to award them points.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {votable.map((answer) => {

            const isMarked = markedTrue.includes(answer.id);
            const writer = players[answer.id];

            return (
              <div
                key={answer.id}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-3 ${
                  isMarked
                    ? "bg-green-900/20 border-green-500"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                <div className="flex justify-between items-start">
                  <p className="text-white italic">"{answer.text}"</p>
                  <span className="text-[10px] font-bold text-gray-500 uppercase ml-2 shrink-0">
                    {writer?.name || "System"}
                  </span>
                </div>
                <button
                  onClick={() => onMarkTrue(answer.id)}
                  disabled={isMarked}
                  className={`py-2 px-4 rounded-lg font-bold text-sm transition-colors ${
                    isMarked
                      ? "bg-green-600 text-white cursor-default"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600"
                  }`}
                >
                  {isMarked ? "✓ Marked as True" : "Mark as Also True"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">
          Which one is the truth?
        </h2>
        <p className="text-gray-400 text-sm">Pick carefully...</p>
      </div>

      {votable.length === 0 && (
        <p className="text-center text-gray-400">
          Nobody submitted an answer this round.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {votable.map((answer) => {
          const writer = players[answer.id];
          return (
            <button
              key={answer.id}
              onClick={() => onVote(answer.id)}
              className="p-5 rounded-xl bg-gray-800 border-2 border-gray-700 hover:border-blue-500 hover:bg-gray-750 transition-all text-left group flex flex-col gap-2"
            >
              <div className="flex justify-between items-start w-full">
                <p className="text-white text-lg font-medium leading-snug group-hover:text-blue-200 transition-colors italic">
                  "{answer.text}"
                </p>
                <span className="text-[10px] font-bold text-gray-500 uppercase ml-2 shrink-0 group-hover:text-gray-400">
                  {writer?.name || "System"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
