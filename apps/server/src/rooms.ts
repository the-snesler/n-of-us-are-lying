import type { ServerWebSocket } from 'bun';
import { generateRoomCode, generateToken, generatePlayerId } from './utils';

export interface PlayerConnection {
  id: string;
  name: string;
  socket: ServerWebSocket<WebSocketData> | null;
  reconnectToken: string;
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  hostToken: string;
  hostSocket: ServerWebSocket<WebSocketData> | null;
  players: Map<string, PlayerConnection>;
  createdAt: number;
}

export interface WebSocketData {
  roomCode: string;
  role: 'host' | 'player';
  playerId?: string;
}

// In-memory room storage
const rooms = new Map<string, Room>();

// Reconnection window in milliseconds (30 seconds)
const RECONNECT_WINDOW_MS = 30_000;

// Room expiry time (1 hour of inactivity)
const ROOM_EXPIRY_MS = 60 * 60 * 1000;

export function createRoom(): { roomCode: string; hostToken: string } {
  let roomCode = generateRoomCode();

  // Ensure unique room code
  while (rooms.has(roomCode)) {
    roomCode = generateRoomCode();
  }

  const hostToken = generateToken();

  const room: Room = {
    code: roomCode,
    hostToken,
    hostSocket: null,
    players: new Map(),
    createdAt: Date.now(),
  };

  rooms.set(roomCode, room);

  return { roomCode, hostToken };
}

export function getRoom(roomCode: string): Room | undefined {
  return rooms.get(roomCode.toUpperCase());
}

export function deleteRoom(roomCode: string): void {
  rooms.delete(roomCode.toUpperCase());
}

export function validateHostToken(roomCode: string, token: string): boolean {
  const room = getRoom(roomCode);
  return room?.hostToken === token;
}

export function addPlayer(
  roomCode: string,
  name: string
): { playerId: string; reconnectToken: string } | null {
  const room = getRoom(roomCode);
  if (!room) return null;

  const playerId = generatePlayerId();
  const reconnectToken = generateToken();

  const player: PlayerConnection = {
    id: playerId,
    name,
    socket: null,
    reconnectToken,
    disconnectedAt: null,
  };

  room.players.set(playerId, player);

  return { playerId, reconnectToken };
}

export function reconnectPlayer(
  roomCode: string,
  playerId: string,
  token: string
): boolean {
  const room = getRoom(roomCode);
  if (!room) return false;

  const player = room.players.get(playerId);
  if (!player) return false;

  // Validate token
  if (player.reconnectToken !== token) return false;

  // Check if within reconnection window
  if (player.disconnectedAt) {
    const elapsed = Date.now() - player.disconnectedAt;
    if (elapsed > RECONNECT_WINDOW_MS) return false;
  }

  return true;
}

export function getPlayer(roomCode: string, playerId: string): PlayerConnection | undefined {
  const room = getRoom(roomCode);
  return room?.players.get(playerId);
}

export function removePlayer(roomCode: string, playerId: string): void {
  const room = getRoom(roomCode);
  if (room) {
    room.players.delete(playerId);
  }
}

export function setHostSocket(
  roomCode: string,
  socket: ServerWebSocket<WebSocketData>
): void {
  const room = getRoom(roomCode);
  if (room) {
    room.hostSocket = socket;
  }
}

export function setPlayerSocket(
  roomCode: string,
  playerId: string,
  socket: ServerWebSocket<WebSocketData> | null
): void {
  const room = getRoom(roomCode);
  if (!room) return;

  const player = room.players.get(playerId);
  if (player) {
    player.socket = socket;
    player.disconnectedAt = socket ? null : Date.now();
  }
}

export function getHostSocket(roomCode: string): ServerWebSocket<WebSocketData> | null {
  const room = getRoom(roomCode);
  return room?.hostSocket ?? null;
}

export function getAllPlayerSockets(
  roomCode: string
): ServerWebSocket<WebSocketData>[] {
  const room = getRoom(roomCode);
  if (!room) return [];

  const sockets: ServerWebSocket<WebSocketData>[] = [];
  for (const player of room.players.values()) {
    if (player.socket) {
      sockets.push(player.socket);
    }
  }
  return sockets;
}

export function getPlayerSocket(
  roomCode: string,
  playerId: string
): ServerWebSocket<WebSocketData> | null {
  const room = getRoom(roomCode);
  if (!room) return null;

  const player = room.players.get(playerId);
  return player?.socket ?? null;
}

// Cleanup expired rooms periodically
export function cleanupExpiredRooms(): void {
  const now = Date.now();
  for (const [code, room] of rooms) {
    // Remove rooms with no host connection after expiry time
    if (!room.hostSocket && now - room.createdAt > ROOM_EXPIRY_MS) {
      rooms.delete(code);
    }
  }
}

// Start cleanup interval
setInterval(cleanupExpiredRooms, 60_000); // Run every minute
