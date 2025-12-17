import type { Player } from "@nofus/shared";
import PlayerGrid from "../../shared/PlayerGrid";
import HostPlayerCard from "./HostPlayerCard";

interface PhaseProgressProps {
  players: Record<string, Player>;
  playerStatus: Record<string, "waiting" | "ready" | "presenting" | "voted">;
}

export default function PhaseProgress({
  players,
  playerStatus,
}: PhaseProgressProps) {
  return (
    <PlayerGrid>
      {Object.values(players).map((player) => (
        <HostPlayerCard
          key={player.id}
          player={player}
          status={playerStatus[player.id] || "waiting"}
        />
      ))}
    </PlayerGrid>
  );
}
