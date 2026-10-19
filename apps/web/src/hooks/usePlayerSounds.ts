import { useEffect, useRef } from "react";
import type { GamePhase, PlayerViewState } from "@nofus/shared";
import { getSoundStatus, playSound } from "../lib/sound";

// Phases where the player needs to act. Everyone gets the same chime,
// including the expert, so phones never give away who the expert is.
const ACTION_PHASES: GamePhase[] = ["TOPIC_SELECTION", "GUESSING", "VOTING"];
const RESEARCH_PHASES: GamePhase[] = ["TOPIC_SELECTION", "WRITING"];

/**
 * Plays personal sound effects on a player's phone. The TV carries the main
 * soundtrack; phones only chime when it's time to act and when you score.
 * Sounds for the player's own taps are played directly in the action handlers.
 */
export function usePlayerSounds(gameState: PlayerViewState | null) {
  const prevRef = useRef<PlayerViewState | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = gameState;
    if (!gameState || !prev) return;

    const { phase, playerId } = gameState;
    const enteredResearch =
      RESEARCH_PHASES.includes(phase) && !RESEARCH_PHASES.includes(prev.phase);
    if (
      phase !== prev.phase &&
      ACTION_PHASES.includes(phase) &&
      (enteredResearch || !RESEARCH_PHASES.includes(phase))
    ) {
      playSound("ding");
      if (getSoundStatus() === "on") navigator.vibrate?.(60);
    }

    const score = gameState.players[playerId]?.score ?? 0;
    const prevScore = prev.players[playerId]?.score ?? 0;
    if (score > prevScore) playSound("coin");
  }, [gameState]);
}
