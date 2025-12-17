import { useParams } from "react-router-dom";
import { useEffect } from "react";
import { useMachine } from "@xstate/react";
import { gameMachine } from "../machines/gameMachine";
import { useWebSocket } from "../hooks/useWebSocket";
import { useTimer } from "../hooks/useTimer";
import { machineStateToPlayerViewState } from "../lib/api";
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

  // Timer management
  useTimer(
    state.context.timer,
    () => send({ type: "TIMER_TICK" }),
    () => send({ type: "TIMER_END" }),
  );

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
  }, [state, state.context.players, isConnected, sendMessage]);

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
        />
      )}
      {state.matches("writing") && (
        <WritingPhase
          players={state.context.players}
          selectedArticles={state.context.selectedArticles}
          researchRoundIndex={state.context.researchRoundIndex}
        />
      )}
      {state.matches("guessing") && (
        <GuessingPhase
          players={state.context.players}
          currentRound={state.context.rounds[state.context.currentRoundIndex]}
        />
      )}
      {state.matches("presenting") && (
        <PresentingPhase
          currentRound={state.context.rounds[state.context.currentRoundIndex]}
        />
      )}
      {state.matches("voting") && (
        <VotingPhase
          players={state.context.players}
          currentRound={state.context.rounds[state.context.currentRoundIndex]}
        />
      )}
      {state.matches("reveal") && (
        <RevealPhase
          players={state.context.players}
          currentRound={state.context.rounds[state.context.currentRoundIndex]}
        />
      )}
      {state.matches("leaderboard") && <LeaderboardPhase />}
    </HostLayout>
  );
}
