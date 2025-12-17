import { useParams } from "react-router-dom";
import { useEffect } from "react";
import { useMachine } from "@xstate/react";
import { gameMachine } from "../machines/gameMachine";
import { useWebSocket } from "../hooks/useWebSocket";
import { machineStateToPlayerViewState } from "../lib/api";
import { fetchArticlesForPlayer } from "../lib/wikipedia";

export default function Host() {
  const { code } = useParams<{ code: string }>();
  const hostToken = sessionStorage.getItem(`host_token_${code}`);

  const [state, send] = useMachine(gameMachine);

  const { isConnected, sendMessage } = useWebSocket({
    roomCode: code!,
    token: hostToken!,
    onMessage: (message) => {
      // Forward messages to state machine
      const payload = message.payload as Record<string, unknown> | undefined;
      send({
        type: message.type,
        ...payload,
        senderId: message.senderId,
      } as Parameters<typeof send>[0]);
    },
  });

  // Send state changes to players
  useEffect(() => {
    if (isConnected) {
      for (const target of Object.keys(state.context.players)) {
        const payload = machineStateToPlayerViewState(state, target);
        sendMessage({
          type: "SYNC_STATE",
          target,
          payload,
        });
      }
    }
  }, [state, isConnected, sendMessage]);

  // Fetch articles when entering topicSelection phase
  useEffect(() => {
    if (state.value === "topicSelection") {
      // Fetch articles for all players who don't have them yet
      const playersNeedingArticles = Object.keys(state.context.players).filter(
        (playerId) => !state.context.articleOptions[playerId]
      );

      for (const playerId of playersNeedingArticles) {
        fetchArticlesForPlayer(6)
          .then((articles) => {
            send({
              type: "PROVIDE_ARTICLES",
              playerId,
              articles,
            });
          })
          .catch((error) => {
            console.error(`Failed to fetch articles for ${playerId}:`, error);
          });
      }
    }
  }, [state.value, state.context.players, state.context.articleOptions, send]);

  // Manage timer countdown
  useEffect(() => {
    if (state.context.timer !== null) {
      const interval = setInterval(() => {
        send({ type: "TIMER_TICK" });

        if (state.context.timer === 0) {
          send({ type: "TIMER_END" });
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [state.context.timer, send]);

  if (!hostToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Host Session</h1>
          <p className="text-gray-400">
            Please create a new room from the lobby.
          </p>
        </div>
      </div>
    );
  }

  // Helper function to format timer as MM:SS
  const formatTimer = (seconds: number | null): string => {
    if (seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper function to get human-readable phase name
  const getPhaseName = (phase: string): string => {
    const phaseNames: Record<string, string> = {
      lobby: "Lobby",
      tutorial: "Tutorial",
      topicSelection: "Topic Selection",
      writing: "Writing Summaries",
      guessing: "Guessing Round",
      presenting: "Presenting",
      voting: "Voting",
      reveal: "Reveal",
      leaderboard: "Final Results",
    };
    return phaseNames[phase] || phase;
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Room: {code}</h1>
          <div
            className={`px-3 py-1 rounded text-sm ${isConnected ? "bg-green-600" : "bg-red-600"} text-white`}
          >
            {isConnected ? "Connected" : "Connecting..."}
          </div>
        </div>

        <div className="bg-gray-800 text-white rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">
              {getPhaseName(state.value.toString())}
            </h2>
            {state.context.timer !== null && (
              <div className="text-3xl font-mono font-bold">
                {formatTimer(state.context.timer)}
              </div>
            )}
          </div>
        </div>

        {state.value === "topicSelection" && (
          <div className="bg-gray-800 text-white rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">
              Players Choosing Articles (Round {state.context.researchRoundIndex + 1}/3)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.values(state.context.players).map((player) => {
                const playerArticles = state.context.selectedArticles[player.id] || [];
                const expectedCount = state.context.researchRoundIndex + 1;
                const hasSubmitted = playerArticles.length >= expectedCount;

                return (
                  <div
                    key={player.id}
                    className={`p-4 rounded border-2 ${hasSubmitted ? "border-green-500 bg-green-900/20" : "border-gray-600 bg-gray-700/50"}`}
                  >
                    <div className="font-semibold">{player.name}</div>
                    <div className="text-sm mt-1">
                      {hasSubmitted ? (
                        <span className="text-green-400">✓ Selected</span>
                      ) : (
                        <span className="text-gray-400">Choosing...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {state.value !== "topicSelection" && (
          <div className="bg-gray-800 text-white rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Players</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.values(state.context.players).map((player) => (
                <div
                  key={player.id}
                  className="p-4 rounded border-2 border-gray-600 bg-gray-700/50"
                >
                  <div className="font-semibold">{player.name}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Score: {player.score}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
