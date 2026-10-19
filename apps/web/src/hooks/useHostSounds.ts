import { useEffect, useRef } from "react";
import type { SnapshotFrom } from "xstate";
import type { gameMachine } from "../machines/gameMachine";
import { playSound } from "../lib/sound";

type GameSnapshot = SnapshotFrom<typeof gameMachine>;

// Phases where the last seconds of the timer get a countdown tick
const COUNTDOWN_PHASES = ["research", "guessing", "presenting", "voting"];
const COUNTDOWN_SECONDS = 5;

/**
 * Answers received this phase. The expert's fake "ready" counts too, so it
 * sounds exactly like a real submission and doesn't give them away.
 */
function submissionCount(state: GameSnapshot, phase: string): number {
  const { rounds, currentRoundIndex, expertReady } = state.context;
  const round = rounds[currentRoundIndex];
  const expertSubmitted = round && !round.isEveryoneLies && expertReady ? 1 : 0;
  if (phase === "guessing" && round) {
    return Object.keys(round.lies).length + expertSubmitted;
  }
  if (phase === "voting" && round) {
    return Object.keys(round.votes).length + expertSubmitted;
  }
  if (phase === "research") {
    return Object.values(state.context.selectedArticles)
      .flat()
      .filter((a) => a.summary).length;
  }
  return 0;
}

function articlesChosen(state: GameSnapshot): number {
  return Object.values(state.context.selectedArticles).flat().length;
}

/** Plays sound effects on the host (TV) as the game state changes */
export function useHostSounds(state: GameSnapshot | null) {
  const prevRef = useRef<GameSnapshot | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;
    // Skip the first snapshot (fresh load or crash recovery)
    if (!state || !prev || state === prev) return;

    const phase = String(state.value);
    const prevPhase = String(prev.value);
    const { players, timer } = state.context;

    // Connections
    const playerChanges = Object.values(players).map((player) => ({
      now: player.isConnected,
      before: prev.context.players[player.id]?.isConnected ?? false,
    }));
    if (playerChanges.some((p) => p.now && !p.before)) playSound("join");
    else if (playerChanges.some((p) => !p.now && p.before)) playSound("leave");

    // Answers (judged by the previous phase, so the final answer that ends a phase still plinks)
    const submitted = submissionCount(state, prevPhase);
    if (submitted > submissionCount(prev, prevPhase)) {
      playSound("submit", submitted - 1);
    } else if (prevPhase === "research" && articlesChosen(state) > articlesChosen(prev)) {
      playSound("tap");
    }

    if (phase !== prevPhase) {
      const round = state.context.rounds[state.context.currentRoundIndex];
      switch (phase) {
        case "tutorial":
          playSound("start");
          break;
        case "reveal":
          playSound(round?.isEveryoneLies ? "everyoneLies" : "truth");
          break;
        case "leaderboard":
          playSound("fanfare");
          break;
        default:
          playSound("whoosh");
      }
      return;
    }

    // Expert vouching for a lie
    const round = state.context.rounds[state.context.currentRoundIndex];
    const prevRound = prev.context.rounds[prev.context.currentRoundIndex];
    if (round && prevRound && round.markedTrue.length > prevRound.markedTrue.length) {
      playSound("sparkle");
    }

    // Countdown
    if (
      timer !== null &&
      timer !== prev.context.timer &&
      COUNTDOWN_PHASES.includes(phase)
    ) {
      if (timer === 0) playSound("timeUp");
      else if (timer <= COUNTDOWN_SECONDS) playSound("tick", timer <= 3 ? 1 : 0);
    }
  }, [state]);
}
