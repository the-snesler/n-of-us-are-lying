import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import type { PlayerViewState } from '@nofus/shared';

export default function Player() {
  const { code } = useParams<{ code: string }>();

  const [gameState, setGameState] = useState<PlayerViewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasRerolled, setHasRerolled] = useState(false);

  // Check for existing session
  const existingPlayerName = sessionStorage.getItem(`player_name`);
  const existingPlayerId = sessionStorage.getItem(`player_id_${code}`);
  const existingToken = sessionStorage.getItem(`player_token_${code}`);

  const { isConnected, sendMessage } = useWebSocket({
    roomCode: code!,
    playerName: existingPlayerName!,
    playerId: existingPlayerId || undefined,
    token: existingToken || undefined,
    onMessage: (message) => {
      const payload = message.payload as Record<string, unknown>;
      if (message.type === "ROOM_JOINED") {
        sessionStorage.setItem(`player_id_${code}`, payload.playerId as string);
        sessionStorage.setItem(
          `player_token_${code}`,
          payload.reconnectToken as string
        );
      } else if (message.type === "SYNC_STATE") {
        setGameState(payload as unknown as PlayerViewState);
      } else if (message.type === "ERROR") {
        setError(payload.message as string);
      }
    },
  });

  // Reset reroll state when phase changes to TOPIC_SELECTION
  useEffect(() => {
    if (gameState?.phase === 'TOPIC_SELECTION') {
      setHasRerolled(false);
    }
  }, [gameState?.phase]);

  const handleReroll = () => {
    sendMessage({ type: "REROLL_ARTICLES", target: "HOST", payload: {} });
    setHasRerolled(true);
  };

  const handleChooseArticle = (articleId: string) => {
    sendMessage({
      type: "CHOOSE_ARTICLE",
      target: "HOST",
      payload: { articleId },
    });
  };

  // Calculate which articles to show based on reroll status
  const articlesToShow = gameState?.articleOptions?.slice(
    hasRerolled ? 3 : 0,
    hasRerolled ? 6 : 3
  ) || [];

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-white">Room: {code}</h1>
          <div
            className={`px-2 py-1 rounded text-xs ${isConnected ? "bg-green-600" : "bg-red-600"} text-white`}
          >
            {isConnected ? "Connected" : "Connecting..."}
          </div>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-600 rounded-lg p-4 mb-4">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6">
          {!gameState ? (
            <p className="text-gray-400 text-center">Waiting for host...</p>
          ) : gameState.phase === 'TOPIC_SELECTION' ? (
            <>
              <h2 className="text-lg font-semibold text-white mb-4">
                Choose an Article
              </h2>

              {gameState.hasSubmitted ? (
                <div className="text-center py-8">
                  <div className="text-green-400 text-5xl mb-4">✓</div>
                  <p className="text-gray-300 text-lg">Article selected!</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Waiting for other players...
                  </p>
                </div>
              ) : articlesToShow.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">Loading articles...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-4">
                    {articlesToShow.map((article) => (
                      <div
                        key={article.id}
                        className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                      >
                        <h3 className="text-white font-semibold mb-2">
                          {article.title}
                        </h3>
                        <p className="text-gray-300 text-sm mb-3 line-clamp-3">
                          {article.extract}
                        </p>
                        <button
                          onClick={() => handleChooseArticle(article.id)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
                        >
                          Choose This Article
                        </button>
                      </div>
                    ))}
                  </div>

                  {!hasRerolled && (
                    <button
                      onClick={handleReroll}
                      className="w-full bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded transition-colors"
                    >
                      Reroll (Show 3 Different Articles)
                    </button>
                  )}

                  {hasRerolled && (
                    <p className="text-gray-400 text-sm text-center">
                      Reroll used
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-4">
                Phase: {gameState.phase}
              </h2>
              <p className="text-gray-400">Waiting for game updates...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
