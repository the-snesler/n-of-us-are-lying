import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createRoom } from '../lib/api';
import {
  getLastRoom,
  getPlayerSession,
  setHostGameLength,
  setHostToken,
  setPlayerSession,
} from '../lib/session';
import { ROOM_CODE_LENGTH } from "@nofus/shared";
import { DEFAULT_GAME_LENGTH, type GameLength } from "../machines/gameMachine";

const GAME_LENGTH_OPTIONS: { value: GameLength; label: string; description: string }[] = [
  { value: "short", label: "Short", description: "Everyone's the expert once or twice" },
  { value: "long", label: "Long", description: "Everyone's the expert two or three times" },
];

export default function Lobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [lastRoom] = useState(() => getLastRoom());
  // inputs
  const [roomCode, setRoomCode] = useState(
    () => (searchParams.get("code") || "").toUpperCase().slice(0, ROOM_CODE_LENGTH),
  );
  const [playerName, setPlayerName] = useState(() => searchParams.get("name") || "");
  const [gameLength, setGameLength] = useState<GameLength>(DEFAULT_GAME_LENGTH);
  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length === ROOM_CODE_LENGTH && playerName.trim()) {
      const code = roomCode.toUpperCase();
      const existing = getPlayerSession(code);
      // Keep the existing identity if rejoining the same room under the same name
      if (!existing || existing.name !== playerName.trim()) {
        setPlayerSession(code, { name: playerName.trim() });
      }
      navigate(`/play/${code}`);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const { roomCode, hostToken } = await createRoom();
      // Store host token for WebSocket auth
      setHostToken(roomCode, hostToken);
      setHostGameLength(roomCode, gameLength);
      navigate(`/host/${roomCode}`);
    } catch (err) {
      setError("Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          N Of Us Are Lying
        </h1>

        {lastRoom && (
          <button
            onClick={() => navigate(`/play/${lastRoom.roomCode}`)}
            className="w-full mb-6 px-4 py-3 bg-purple-600 cursor-pointer text-white rounded font-semibold hover:bg-purple-700"
          >
            Rejoin {lastRoom.roomCode} as {lastRoom.session.name}
          </button>
        )}

        <form onSubmit={handleJoin} className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 mb-2">Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={ROOM_CODE_LENGTH}
                placeholder="67ABCD"
                className="w-full px-4 py-3 rounded bg-gray-700 text-white text-center text-2xl tracking-widest uppercase mb-4"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-2">Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your Name"
                className="w-full px-4 py-3 rounded bg-gray-700 text-white text-center text-2xl"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={
              roomCode.length !== ROOM_CODE_LENGTH || !playerName.trim()
            }
            className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Join Game
          </button>
        </form>

        <div className="border-t border-gray-700 pt-6">
          <label className="block text-gray-300 mb-2">Game Length</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {GAME_LENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={gameLength === option.value}
                onClick={() => setGameLength(option.value)}
                className={`px-3 py-2 rounded border-2 text-left transition-colors cursor-pointer ${
                  gameLength === option.value
                    ? "border-green-500 bg-green-900/30"
                    : "border-gray-600 bg-gray-700 hover:border-gray-500"
                }`}
              >
                <span className="block text-white font-semibold">{option.label}</span>
                <span className="block text-gray-400 text-xs">{option.description}</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full px-4 py-3 bg-green-600 cursor-pointer text-white rounded font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Create Room"}
          </button>
        </div>

        {error && <p className="mt-4 text-red-400 text-center">{error}</p>}
      </div>
    </div>
  );
}
