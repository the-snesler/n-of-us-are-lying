import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { usePlayerSounds } from "../hooks/usePlayerSounds";
import { playSound } from "../lib/sound";
import type { Article, PlayerViewState } from "@nofus/shared";
import {
  clearPlayerSession,
  getPlayerSession,
  updatePlayerSession,
} from "../lib/session";
import PlayerLayout from "../components/player/PlayerLayout";
import LoadingState from "../components/shared/LoadingState";
import LobbyPhase from "../components/player/phases/LobbyPhase";
import TutorialPhase from "../components/player/phases/TutorialPhase";
import TopicSelectionPhase from "../components/player/phases/TopicSelectionPhase";
import WritingPhase from "../components/player/phases/WritingPhase";
import GuessingPhase from "../components/player/phases/GuessingPhase";
import PresentingPhase from "../components/player/phases/PresentingPhase";
import VotingPhase from "../components/player/phases/VotingPhase";
import RevealPhase from "../components/player/phases/RevealPhase";
import LeaderboardPhase from "../components/player/phases/LeaderboardPhase";

export default function Player() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = code!.toUpperCase();

  const [gameState, setGameState] = useState<PlayerViewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [encryptedHostState, setEncryptedHostState] = useState<string | null>(null);
  const [hasSession] = useState(() => !!getPlayerSession(roomCode));

  // Read the stored session on every (re)connect: after the first join the
  // server-issued id/token must be used so we reclaim the same player
  const getConnectionParams = useCallback(() => {
    const session = getPlayerSession(roomCode);
    if (!session) return null;
    const params: Record<string, string> = { name: session.name };
    if (session.playerId && session.token) {
      params.playerId = session.playerId;
      params.token = session.token;
    }
    return params;
  }, [roomCode]);

  const { isConnected, failedAttempts, sendMessage } = useWebSocket({
    roomCode,
    getConnectionParams,
    onMessage: (message) => {
      const payload = message.payload as Record<string, unknown>;
      if (message.type === "ROOM_JOINED") {
        updatePlayerSession(roomCode, {
          playerId: payload.playerId as string,
          token: payload.reconnectToken as string,
        });
        setError(null);
      } else if (message.type === "SYNC_STATE") {
        const statePayload = payload as unknown as PlayerViewState & { encryptedHostState?: string };
        setGameState(statePayload);
        // Store encrypted host state for recovery
        if (statePayload.encryptedHostState) {
          setEncryptedHostState(statePayload.encryptedHostState);
        }
      } else if (message.type === "REQUEST_STATE_RECOVERY") {
        // Host is requesting state recovery - send our stored encrypted state
        if (encryptedHostState) {
          console.log("Providing state recovery to host");
          sendMessage({
            type: "PROVIDE_STATE_RECOVERY",
            target: "HOST",
            payload: { encryptedHostState },
          });
        }
      } else if (message.type === "ERROR") {
        setError(payload.message as string);
      }
    },
  });

  usePlayerSounds(gameState);

  // Message handlers
  const handleReroll = () => {
    playSound("tap");
    sendMessage({ type: "REROLL_ARTICLES", target: "HOST", payload: {} });
  };

  const handleChooseArticle = (articleId: string) => {
    playSound("tap");
    sendMessage({
      type: "CHOOSE_ARTICLE",
      target: "HOST",
      payload: { articleId },
    });
  };

  const handleChooseCustomArticle = (article: Article) => {
    playSound("tap");
    sendMessage({
      type: "CHOOSE_CUSTOM_ARTICLE",
      target: "HOST",
      payload: { article },
    });
  };

  const handleRejoinAsNew = () => {
    const session = getPlayerSession(roomCode);
    clearPlayerSession(roomCode);
    navigate(`/?code=${roomCode}${session ? `&name=${encodeURIComponent(session.name)}` : ""}`);
  };

  // No stored name for this room (e.g. opened the link directly), go pick one
  if (!hasSession) {
    return <Navigate to={`/?code=${roomCode}`} replace />;
  }

  const handleStartGame = () => {
    playSound("tap");
    sendMessage({
      type: "START_GAME",
      target: "HOST",
      payload: {},
    });
  };

  const handleContinue = () => {
    playSound("tap");
    sendMessage({
      type: "NEXT_PHASE",
      target: "HOST",
      payload: {},
    });
  };

  return (
    <PlayerLayout
      roomCode={roomCode}
      isConnected={isConnected}
      phase={gameState?.phase}
      timer={gameState?.timer}
      error={error}
    >
      {!gameState ? (
        failedAttempts >= 3 ? (
          <div className="text-center">
            <LoadingState message="Can't reconnect to this room. The game may have ended, or your session expired." />
            <button
              onClick={handleRejoinAsNew}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
            >
              Back to Lobby
            </button>
          </div>
        ) : (
          <LoadingState
            message={isConnected ? "Waiting for host..." : "Connecting..."}
          />
        )
      ) : (
        <>
          {gameState.phase === "LOBBY" && (
            <LobbyPhase
              players={gameState.players}
              playerId={gameState.playerId}
              onStartGame={handleStartGame}
            />
          )}
          {gameState.phase === "TUTORIAL" && (
            <TutorialPhase
              players={gameState.players}
              playerId={gameState.playerId}
              onContinue={handleContinue}
            />
          )}
          {gameState.phase === "TOPIC_SELECTION" && (
            <TopicSelectionPhase
              articleOptions={gameState.articleOptions || []}
              hasSubmitted={gameState.hasSubmittedChoice || false}
              canReroll={gameState.canReroll || false}
              progress={gameState.researchProgress}
              onChooseArticle={handleChooseArticle}
              onChooseCustomArticle={handleChooseCustomArticle}
              onReroll={handleReroll}
            />
          )}
          {gameState.phase === "WRITING" && (
            <WritingPhase
              key={gameState.currentArticle?.id ?? "done"}
              roomCode={roomCode}
              currentArticle={gameState.currentArticle}
              hasSubmitted={gameState.hasSubmittedSummary || false}
              progress={gameState.researchProgress}
              onSubmitSummary={(summary) => {
                playSound("submit", 4);
                sendMessage({
                  type: "SUBMIT_SUMMARY",
                  target: "HOST",
                  payload: { articleId: gameState.currentArticle?.id, summary },
                });
              }}
            />
          )}
          {gameState.phase === "GUESSING" && (
            <GuessingPhase
              articleTitle={gameState.articleTitle}
              currentArticle={gameState.currentArticle}
              isExpert={gameState.isExpert || false}
              hasSubmitted={gameState.hasSubmittedLie || false}
              onSubmitLie={(text) => {
                playSound("submit", 4);
                sendMessage({
                  type: "SUBMIT_LIE",
                  target: "HOST",
                  payload: { text },
                });
              }}
            />
          )}
          {gameState.phase === "PRESENTING" && (
            <PresentingPhase
              isExpert={gameState.isExpert || false}
              isVIP={gameState.players[gameState.playerId]?.isVip || false}
              currentArticle={gameState.currentArticle}
              mySubmission={gameState.mySubmission}
              onContinue={handleContinue}
            />
          )}
          {gameState.phase === "VOTING" && (
            <VotingPhase
              playerId={gameState.playerId}
              players={gameState.players}
              isExpert={gameState.isExpert || false}
              answers={gameState.answers || []}
              hasVoted={gameState.hasVoted || false}
              markedTrue={gameState.markedTrue}
              onVote={(answerId) => {
                playSound("submit", 4);
                sendMessage({
                  type: "SUBMIT_VOTE",
                  target: "HOST",
                  payload: { answerId },
                });
              }}
              onMarkTrue={(playerId) => {
                playSound("submit", 4);
                sendMessage({
                  type: "MARK_TRUE",
                  target: "HOST",
                  payload: { playerId },
                });
              }}
            />
          )}
          {gameState.phase === "REVEAL" && (
            <RevealPhase
              isVIP={gameState.players[gameState.playerId]?.isVip || false}
              timer={gameState.timer}
              onContinue={handleContinue}
            />
          )}
          {gameState.phase === "LEADERBOARD" && (
            <LeaderboardPhase
              playerId={gameState.playerId}
              players={gameState.players}
            />
          )}
        </>
      )}
    </PlayerLayout>
  );
}
