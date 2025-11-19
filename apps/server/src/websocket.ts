import type { ServerWebSocket } from 'bun';
import {
  type WebSocketData,
  getRoom,
  getHostSocket,
  getAllPlayerSockets,
  getPlayerSocket,
  setHostSocket,
  setPlayerSocket,
  getPlayer,
  addPlayer,
  reconnectPlayer,
} from './rooms';
import { MessageTypes, type NetworkMessage } from '@nofus/shared';

export function handleOpen(ws: ServerWebSocket<WebSocketData>): void {
  const { roomCode, role, playerId } = ws.data;
  const room = getRoom(roomCode);

  if (!room) {
    ws.send(JSON.stringify({
      type: MessageTypes.ERROR,
      payload: { code: 'ROOM_NOT_FOUND', message: 'Room does not exist' },
    }));
    ws.close();
    return;
  }

  if (role === 'host') {
    setHostSocket(roomCode, ws);
    console.log(`Host connected to room ${roomCode}`);
  } else if (role === 'player' && playerId) {
    const player = getPlayer(roomCode, playerId);
    if (player) {
      setPlayerSocket(roomCode, playerId, ws);
      console.log(`Player ${player.name} (${playerId}) connected to room ${roomCode}`);

      // Notify host of player connection
      const hostSocket = getHostSocket(roomCode);
      if (hostSocket) {
        hostSocket.send(JSON.stringify({
          type: MessageTypes.PLAYER_CONNECTED,
          payload: {
            playerId,
            playerName: player.name,
          },
          senderId: playerId,
        }));
      }
    }
  }
}

export function handleMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: string | Buffer
): void {
  const { roomCode, role, playerId } = ws.data;

  let parsed: NetworkMessage;
  try {
    const text = typeof message === 'string' ? message : message.toString();
    parsed = JSON.parse(text);
  } catch {
    ws.send(JSON.stringify({
      type: MessageTypes.ERROR,
      payload: { code: 'INVALID_JSON', message: 'Failed to parse message' },
    }));
    return;
  }

  const { type, payload, target } = parsed;

  // Determine sender ID
  const senderId = role === 'host' ? 'HOST' : playerId;

  // Create the message to forward (with senderId injected)
  const forwardMessage = JSON.stringify({
    type,
    payload,
    senderId,
  });

  // Route based on target
  if (target === 'HOST') {
    // Forward to host
    const hostSocket = getHostSocket(roomCode);
    if (hostSocket && hostSocket !== ws) {
      hostSocket.send(forwardMessage);
    }
  } else if (target === 'ALL') {
    // Broadcast to all players
    const playerSockets = getAllPlayerSockets(roomCode);
    for (const socket of playerSockets) {
      if (socket !== ws) {
        socket.send(forwardMessage);
      }
    }
  } else if (target) {
    // Forward to specific player
    const targetSocket = getPlayerSocket(roomCode, target);
    if (targetSocket) {
      targetSocket.send(forwardMessage);
    }
  }
}

export function handleClose(ws: ServerWebSocket<WebSocketData>): void {
  const { roomCode, role, playerId } = ws.data;
  const room = getRoom(roomCode);

  if (!room) return;

  if (role === 'host') {
    // Clear host socket but keep room alive for potential reconnection
    setHostSocket(roomCode, null as unknown as ServerWebSocket<WebSocketData>);
    console.log(`Host disconnected from room ${roomCode}`);
  } else if (role === 'player' && playerId) {
    const player = getPlayer(roomCode, playerId);
    if (player) {
      setPlayerSocket(roomCode, playerId, null);
      console.log(`Player ${player.name} (${playerId}) disconnected from room ${roomCode}`);

      // Notify host of player disconnection
      const hostSocket = getHostSocket(roomCode);
      if (hostSocket) {
        hostSocket.send(JSON.stringify({
          type: MessageTypes.PLAYER_DISCONNECTED,
          payload: { playerId },
          senderId: playerId,
        }));
      }
    }
  }
}

export interface JoinResult {
  success: boolean;
  playerId?: string;
  reconnectToken?: string;
  error?: string;
}

export function handlePlayerJoin(
  roomCode: string,
  name: string
): JoinResult {
  const room = getRoom(roomCode);
  if (!room) {
    return { success: false, error: 'Room not found' };
  }

  if (!room.hostSocket) {
    return { success: false, error: 'Host not connected' };
  }

  const result = addPlayer(roomCode, name);
  if (!result) {
    return { success: false, error: 'Failed to add player' };
  }

  return {
    success: true,
    playerId: result.playerId,
    reconnectToken: result.reconnectToken,
  };
}

export function handlePlayerReconnect(
  roomCode: string,
  playerId: string,
  token: string
): JoinResult {
  const valid = reconnectPlayer(roomCode, playerId, token);
  if (!valid) {
    return { success: false, error: 'Invalid reconnection' };
  }

  const player = getPlayer(roomCode, playerId);
  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  return {
    success: true,
    playerId,
    reconnectToken: player.reconnectToken,
  };
}
