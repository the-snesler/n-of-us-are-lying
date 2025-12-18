import { useParams } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { createActor, type SnapshotFrom, type Actor } from "xstate";
import { gameMachine } from "../machines/gameMachine";
import { useWebSocket } from "../hooks/useWebSocket";
import { useTimer } from "../hooks/useTimer";
import { machineStateToPlayerViewState } from "../lib/api";
import { encryptState, decryptState } from "@nofus/shared";
import HostLayout from "../components/host/HostLayout";
import LobbyPhase from "../components/host/phases/LobbyPhase";
import TutorialPhase from "../components/host/phases/TutorialPhase";
import TopicSelectionPhase from "../components/host/phases/TopicSelectionPhase";
import WritingPhase from "../components/host/phases/WritingPhase";
import GuessingPhase from "../components/host/phases/GuessingPhase";
import PresentingPhase from "../components/host/phases/PresentingPhase";
import VotingPhase from "../components/host/phases/VotingPhase";
import RevealPhase from "../components/host/phases/RevealPhase";
import LeaderboardPhase from "../components/host/phases/LeaderboardPhase";

type GameActor = Actor<typeof gameMachine>;
type GameSnapshot = SnapshotFrom<typeof gameMachine>;

type RecoveryState = 
  | { status: "pending" }
  | { status: "not_needed" }
  | { status: "requesting" }
  | { status: "recovered"; snapshot: GameSnapshot }
  | { status: "failed" };

export default function Host() {
  const { code } = useParams<{ code: string }>();
  const hostToken = sessionStorage.getItem(`host_token_${code}`);

  // Recovery state machine
  const [recoveryState, setRecoveryState] = useState<RecoveryState>({ status: "pending" });
  const recoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Actor management (not using useMachine so we can delay creation)
  const actorRef = useRef<GameActor | null>(null);
  const [state, setState] = useState<GameSnapshot | null>(null);

  // Initialize actor once recovery status is determined
  const initializeActor = useCallback((snapshot?: GameSnapshot) => {
    if (actorRef.current) {
      actorRef.current.stop();
    }
    const actor = createActor(gameMachine, {
      snapshot,
    });

    actor.subscribe((newState) => {
      setState(newState);
    });

    actor.start();
    actorRef.current = actor;
    setState(actor.getSnapshot());
    console.log("Game actor initialized", actor.getSnapshot());
    
    // If recovering into topicSelection, re-trigger article fetching
    // since async actions are lost on crash
    if (snapshot && actor.getSnapshot().matches("topicSelection")) {
      actor.send({ type: "REFETCH_ARTICLES" });
    }
  }, []);

  // Send function that forwards to the actor
  const send = useCallback((event: Parameters<GameActor["send"]>[0]) => {
    if (actorRef.current) {
      actorRef.current.send(event);
    }
  }, []);

  // Cleanup actor on unmount
  useEffect(() => {
    return () => {
      if (actorRef.current) {
        actorRef.current.stop();
      }
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, []);

  const { isConnected, sendMessage } = useWebSocket({
    roomCode: code!,
    token: hostToken!,
    onMessage: (message) => {
      if (message.type === "HOST_CONNECTED") {
        const players = (message.payload as { players: { id: string; name: string }[] }).players;
        
        if (players.length > 0 && recoveryState.status === "pending") {
          // Players exist, we crashed - request recovery
          const randomPlayer = players[Math.floor(Math.random() * players.length)];
          console.log("Requesting state recovery from player", randomPlayer.id);
          
          setRecoveryState({ status: "requesting" });
          
          // Set a timeout in case player doesn't respond
          recoveryTimeoutRef.current = setTimeout(() => {
            console.warn("Recovery timeout - starting fresh");
            setRecoveryState({ status: "failed" });
            initializeActor();
          }, 5000);
          
          sendMessage({
            type: "REQUEST_STATE_RECOVERY",
            target: randomPlayer.id,
            payload: {},
          });
        } else if (recoveryState.status === "pending") {
          // No players, no recovery needed - start fresh
          console.log("No players connected, starting fresh game");
          setRecoveryState({ status: "not_needed" });
          initializeActor();
        }
        return;
      }

      // Handle state recovery response
      if (message.type === "PROVIDE_STATE_RECOVERY" && hostToken && recoveryState.status === "requesting") {
        if (recoveryTimeoutRef.current) {
          clearTimeout(recoveryTimeoutRef.current);
          recoveryTimeoutRef.current = null;
        }
        
        const payload = message.payload as { encryptedHostState: string };
        decryptState(payload.encryptedHostState, hostToken)
          .then((recoveredSnapshot: unknown) => {
            console.log("Recovered host state from player", message.senderId);
            const snapshot = recoveredSnapshot as GameSnapshot;
            setRecoveryState({ status: "recovered", snapshot });
            initializeActor(snapshot);
          })
          .catch((err: unknown) => {
            console.error("Failed to decrypt recovered state:", err);
            setRecoveryState({ status: "failed" });
            initializeActor();
          });
        return;
      }

      // Forward messages to state machine (only if actor exists)
      if (actorRef.current) {
        const payload = message.payload as Record<string, unknown> | undefined;
        send({
          type: message.type,
          ...payload,
          senderId: message.senderId,
        } as Parameters<typeof send>[0]);
      }
    },
  });

  // Timer management (only run when state exists)
  useTimer(
    state?.context?.timer ?? null,
    () => send({ type: "TIMER_TICK" }),
    () => send({ type: "TIMER_END" }),
  );

  // Send state changes to players
  useEffect(() => {
    if (isConnected && hostToken && state && actorRef.current && state.status !== "stopped") {
      // Get the persisted snapshot for proper serialization
      const persistedSnapshot = actorRef.current.getPersistedSnapshot();

      // Encrypt the full state
      encryptState(persistedSnapshot, hostToken).then((encryptedHostState) => {
        // Send to all players
        for (const target of Object.keys(state.context.players)) {
          const payload = {
            ...machineStateToPlayerViewState(state, target),
            encryptedHostState,
          };
          sendMessage({
            type: "SYNC_STATE",
            target,
            payload,
          });
        }
      }).catch((err: unknown) => {
        console.error("Failed to encrypt state:", err);
        // Fall back to sending without encrypted state
        for (const target of Object.keys(state.context.players)) {
          const payload = machineStateToPlayerViewState(state, target);
          sendMessage({
            type: "SYNC_STATE",
            target,
            payload,
          });
        }
      });
    }
  }, [state, isConnected, sendMessage, hostToken]);

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

  // Show loading state while waiting for recovery decision
  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">
            {recoveryState.status === "pending" && "Connecting..."}
            {recoveryState.status === "requesting" && "Recovering game state..."}
            {recoveryState.status === "failed" && "Recovery failed, starting fresh..."}
          </h1>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          {recoveryState.status === "requesting" && (
            <p className="text-gray-400 mt-4">
              Requesting state from connected players...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <HostLayout
      roomCode={code!}
      isConnected={isConnected}
      phase={state.value.toString()}
      timer={state.context.timer}
    >
      {state.matches("lobby") && <LobbyPhase players={state.context.players} />}
      {state.matches("tutorial") && <TutorialPhase />}
      {state.matches("topicSelection") && (
        <TopicSelectionPhase
          players={state.context.players}
          selectedArticles={state.context.selectedArticles}
          researchRoundIndex={state.context.researchRoundIndex}
          totalRounds={state.context.config.articlesPerPlayer}
        />
      )}
      {state.matches("writing") && (
        <WritingPhase
          players={state.context.players}
          selectedArticles={state.context.selectedArticles}
          researchRoundIndex={state.context.researchRoundIndex}
          totalRounds={state.context.config.articlesPerPlayer}
        />
      )}
      {state.matches("guessing") && (
        <GuessingPhase
          players={state.context.players}
          currentRound={state.context.rounds[state.context.currentRoundIndex]}
          expertReady={state.context.expertReady}
        />
      )}
      {state.matches("presenting") && (
        <PresentingPhase
          players={state.context.players}
          currentRound={state.context.rounds[state.context.currentRoundIndex]}
        />
      )}
      {state.matches("voting") && (
        <VotingPhase
          players={state.context.players}
          currentRound={state.context.rounds[state.context.currentRoundIndex]}
          expertReady={state.context.expertReady}
        />
      )}
      {state.matches("reveal") && (
        <RevealPhase
          players={state.context.players}
          currentRound={state.context.rounds[state.context.currentRoundIndex]}
        />
      )}
      {state.matches("leaderboard") && (
        <LeaderboardPhase players={state.context.players} />
      )}
    </HostLayout>
  );
}
