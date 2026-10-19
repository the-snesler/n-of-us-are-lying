import RoomCode from "../shared/RoomCode";
import ConnectionBadge from "../shared/ConnectionBadge";
import ErrorMessage from "../shared/ErrorMessage";
import SoundToggle from "../shared/SoundToggle";
import RoundProgress from "../shared/RoundProgress";

interface PlayerLayoutProps {
  roomCode: string;
  isConnected: boolean;
  phase?: string;
  timer?: number | null;
  roundProgress?: { current: number; total: number };
  error?: string | null;
  children: React.ReactNode;
}

export default function PlayerLayout({
  roomCode,
  isConnected,
  roundProgress,
  error,
  children
}: PlayerLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <RoomCode code={roomCode} size="md" />
            {roundProgress && <RoundProgress {...roundProgress} size="sm" />}
          </div>
          <div className="flex items-center gap-2">
            <SoundToggle size="sm" />
            <ConnectionBadge isConnected={isConnected} size="sm" />
          </div>
        </div>

        {/* Error Display */}
        {error && <ErrorMessage message={error} />}

        {/* Phase Content */}
        <div className="bg-gray-800 rounded-lg p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
