import { PlayerViewState, GamePhase } from "@nofus/shared";
import { gameMachine } from "../machines/gameMachine";
import { useMachine } from "@xstate/react";

const API_BASE = "/api/v1";

// Convert state machine state names (camelCase) to GamePhase enum (UPPERCASE_SNAKE_CASE)
function stateToPhase(stateValue: string): GamePhase {
  const mapping: Record<string, GamePhase> = {
    lobby: "LOBBY",
    tutorial: "TUTORIAL",
    topicSelection: "TOPIC_SELECTION",
    writing: "WRITING",
    guessing: "GUESSING",
    presenting: "PRESENTING",
    voting: "VOTING",
    reveal: "REVEAL",
    leaderboard: "LEADERBOARD",
  };
  return mapping[stateValue] || "LOBBY";
}

export interface CreateRoomResponse {
  roomCode: string;
  hostToken: string;
}

export async function createRoom(): Promise<CreateRoomResponse> {
  const response = await fetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to create room");
  }

  return response.json();
}

export function getWebSocketUrl(
  roomCode: string,
  params: Record<string, string>
): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const queryString = new URLSearchParams(params).toString();
  return `${protocol}//${host}${API_BASE}/rooms/${roomCode}/ws?${queryString}`;
}

export function machineStateToPlayerViewState(
  state: ReturnType<typeof useMachine<typeof gameMachine>>[0],
  playerId: string
): PlayerViewState {
  // writing and selecting
  const isFirstHalf =
    state.matches("writing") || state.matches("topicSelection");
  // guessing, presenting, voting, reveal
  const isSecondHalf =
    state.matches("guessing") ||
    state.matches("presenting") ||
    state.matches("voting") ||
    state.matches("reveal");
  let response = {
    roomCode: state.context.roomCode,
    phase: stateToPhase(state.value.toString()),
    playerId: playerId,
    timer: state.context.timer,
    players: state.context.players,
  };
  if (isFirstHalf) {
    const playerArticles = state.context.selectedArticles[playerId] || [];
    const expectedCount = state.context.researchRoundIndex + 1;
    const hasSubmitted = playerArticles.length >= expectedCount;

    return {
      ...response,
      articleOptions: state.context.articleOptions[playerId] || [],
      currentArticle: playerArticles[state.context.researchRoundIndex] || null,
      hasSubmitted,
    };
  }
  if (isSecondHalf) {
    const currentRound = state.context.rounds[state.context.currentRoundIndex];
    return {
      ...response,
      answers: Object.entries(currentRound.lies).map(([id, text]) => ({
        id,
        text,
      })),
      hasSubmitted: currentRound.votes[playerId] !== undefined,
      hasVoted: currentRound.votes[playerId] !== undefined,
    };
  }
  return response;
}
