/**
 * Utility functions for formatting game data
 */

/**
 * Format timer seconds as MM:SS
 */
export function formatTimer(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get human-readable phase name from phase string
 */
export function getPhaseName(phase: string): string {
  const phaseNames: Record<string, string> = {
    lobby: "Lobby",
    tutorial: "Tutorial",
    research: "Research",
    guessing: "Guessing Round",
    presenting: "Presenting",
    voting: "Voting",
    reveal: "Reveal",
    leaderboard: "Final Results",
  };
  return phaseNames[phase] || phase;
}
