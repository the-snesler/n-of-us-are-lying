import type { Player } from "@nofus/shared";

interface TutorialPhaseProps {
  players: Record<string, Player>;
  playerId: string;
  onContinue?: () => void;
}

export default function TutorialPhase({ players, playerId, onContinue }: TutorialPhaseProps) {
  const currentPlayer = players[playerId];
  const isVIP = currentPlayer?.isVip || false;

  return (
    <div className="text-center">
      <div className="mb-6">
        <p className="text-gray-300 text-lg mb-2">
          📺 Review the tutorial on screen
        </p>
        <p className="text-gray-400 text-sm">
          Learn how to play N Of Us Are Lying!
        </p>
      </div>

      {isVIP && onContinue && (
        <button
          onClick={onContinue}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg"
        >
          Continue
        </button>
      )}

      {!isVIP && (
        <p className="text-gray-400 text-sm">
          Waiting for host to continue...
        </p>
      )}
    </div>
  );
}
