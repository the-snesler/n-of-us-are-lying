import { PlayerViewState, GamePhase } from "@nofus/shared";
import { gameMachine, ARTICLES_PER_PAGE } from "../machines/gameMachine";
import { useMachine } from "@xstate/react";
import { getResearchProgress } from "./research";

const API_BASE = "/api/v1";

// Convert state machine state names (camelCase) to GamePhase enum (UPPERCASE_SNAKE_CASE)
function stateToPhase(stateValue: string): GamePhase {
  const mapping: Record<string, GamePhase> = {
    lobby: "LOBBY",
    tutorial: "TUTORIAL",
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
  params: Record<string, string>,
): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const queryString = new URLSearchParams(params).toString();
  return `${protocol}//${host}${API_BASE}/rooms/${roomCode}/ws?${queryString}`;
}

export function machineStateToPlayerViewState(
  state: ReturnType<typeof useMachine<typeof gameMachine>>[0],
  playerId: string,
): PlayerViewState {
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
  if (state.matches("research")) {
    // Each player progresses at their own pace, so their phase is per-player
    const progress = getResearchProgress(
      state.context.selectedArticles[playerId],
      state.context.config.articlesPerPlayer,
    );

    const options =
      progress.step === "choosing"
        ? state.context.articleOptions[playerId] || []
        : [];

    return {
      ...response,
      phase: progress.step === "choosing" ? "TOPIC_SELECTION" : "WRITING",
      articleOptions: options.slice(0, ARTICLES_PER_PAGE),
      currentArticle: progress.currentArticle,
      hasSubmittedChoice: progress.step !== "choosing",
      hasSubmittedSummary: progress.step === "done",
      canReroll: options.length > ARTICLES_PER_PAGE,
      researchProgress: { completed: progress.completed, total: progress.total },
    };
  }
  if (isSecondHalf) {
    const currentRound = state.context.rounds[state.context.currentRoundIndex];
    if (!currentRound) return response;

    const isExpert = currentRound.targetPlayerId === playerId;
    const hasSubmittedLie = isExpert
      ? state.context.expertReady
      : currentRound.lies[playerId] !== undefined;
    const hasVoted = isExpert
      ? state.context.expertReady
      : currentRound.votes[playerId] !== undefined;

    // Build answers list if we have shuffled ids
    let answers: { id: string; text: string }[] = [];
    if (currentRound.shuffledAnswerIds) {
      answers = currentRound.shuffledAnswerIds.map((id) => {
        if (id === currentRound.targetPlayerId) {
          return { id, text: currentRound.article.summary };
        }
        return { id, text: currentRound.lies[id] || "" };
      });
    }

    const mySubmission = isExpert
      ? currentRound.article.summary
      : currentRound.lies[playerId];

    return {
      ...response,
      articleTitle: currentRound.article.title,
      currentArticle: isExpert ? currentRound.article : undefined,
      isExpert,
      mySubmission,
      answers,
      hasSubmittedLie,
      hasVoted,
      markedTrue: isExpert ? currentRound.markedTrue : undefined,
    };
  }
  return response;
}
