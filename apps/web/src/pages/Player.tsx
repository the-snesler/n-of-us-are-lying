import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import type { PlayerViewState } from "@nofus/shared";
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
    if (gameState?.phase === "TOPIC_SELECTION") {
      setHasRerolled(false);
    }
  }, [gameState?.phase]);

  // Message handlers
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

  const handleStartGame = () => {
    sendMessage({
      type: "START_GAME",
      target: "HOST",
      payload: {},
    });
  };

  const handleContinue = () => {
    sendMessage({
      type: "NEXT_PHASE",
      target: "HOST",
      payload: {},
    });
  };

  return (
    <PlayerLayout
      roomCode={code!}
      isConnected={isConnected}
      phase={gameState?.phase}
      timer={gameState?.timer}
      error={error}
    >
      {!gameState ? (
        <LoadingState message="Waiting for host..." />
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
              hasRerolled={hasRerolled}
              onChooseArticle={handleChooseArticle}
              onReroll={handleReroll}
            />
          )}
          {gameState.phase === "WRITING" && (
            <WritingPhase
              currentArticle={gameState.currentArticle}
              hasSubmitted={gameState.hasSubmittedSummary || false}
              onSubmitSummary={(summary) =>
                sendMessage({
                  type: "SUBMIT_SUMMARY",
                  target: "HOST",
                  payload: { articleId: gameState.currentArticle?.id, summary },
                })
              }
            />
          )}
          {gameState.phase === "GUESSING" && (
            <GuessingPhase
              articleTitle={gameState.articleTitle}
              currentArticle={gameState.currentArticle}
              isExpert={gameState.isExpert || false}
              hasSubmitted={gameState.hasSubmittedLie || false}
              onSubmitLie={(text) =>
                sendMessage({
                  type: "SUBMIT_LIE",
                  target: "HOST",
                  payload: { text },
                })
              }
            />
          )}
          {gameState.phase === "PRESENTING" && (
            <PresentingPhase
              isExpert={gameState.isExpert || false}
              currentArticle={gameState.currentArticle}
            />
          )}
          {gameState.phase === "VOTING" && (
            <VotingPhase
              playerId={gameState.playerId}
              isExpert={gameState.isExpert || false}
              answers={gameState.answers || []}
              hasVoted={gameState.hasVoted || false}
              markedTrue={gameState.markedTrue}
              onVote={(answerId) =>
                sendMessage({
                  type: "SUBMIT_VOTE",
                  target: "HOST",
                  payload: { answerId },
                })
              }
              onMarkTrue={(playerId) =>
                sendMessage({
                  type: "MARK_TRUE",
                  target: "HOST",
                  payload: { playerId },
                })
              }
            />
          )}
          {gameState.phase === "REVEAL" && <RevealPhase />}
          {gameState.phase === "LEADERBOARD" && <LeaderboardPhase />}
        </>
      )}
    </PlayerLayout>
  );
}
