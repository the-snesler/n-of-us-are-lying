import {
  createRoom,
  getRoom,
  validateHostToken,
  type WebSocketData,
} from "./rooms";
import {
  handleOpen,
  handleMessage,
  handleClose,
  handlePlayerJoin,
  handlePlayerReconnect,
} from "./websocket";
import { MessageTypes } from "@nofus/shared";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const STATIC_DIR = process.env.STATIC_DIR; // Path to built frontend (e.g., /app/public)

const server = Bun.serve<WebSocketData>({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;
    console.log(path, req.method);

    // CORS headers for all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /api/v1/rooms - Create a new room
    if (path === "/api/v1/rooms" && req.method === "POST") {
      const { roomCode, hostToken } = createRoom();
      return Response.json({ roomCode, hostToken }, { headers: corsHeaders });
    }

    // GET /api/v1/rooms/:code/ws - WebSocket upgrade
    const wsMatch = path.match(/^\/api\/v1\/rooms\/([A-Z0-9]{6})\/ws$/i);
    if (wsMatch && req.method === "GET") {
      console.log("WebSocket connection attempt", req.url);
      const roomCode = wsMatch[1].toUpperCase();
      const room = getRoom(roomCode);

      if (!room) {
        return Response.json(
          { error: "Room not found" },
          { status: 404, headers: corsHeaders },
        );
      }

      const token = url.searchParams.get("token");
      const name = url.searchParams.get("name");
      const playerId = url.searchParams.get("playerId");

      // Host connection
      if (token && !name && !playerId) {
        if (!token || !validateHostToken(roomCode, token)) {
          return Response.json(
            { error: "Invalid host token" },
            { status: 401, headers: corsHeaders },
          );
        }

        const upgraded = server.upgrade(req, {
          data: { roomCode, role: "host" },
        });

        if (!upgraded) {
          return Response.json(
            { error: "WebSocket upgrade failed" },
            { status: 500, headers: corsHeaders },
          );
        }

        return undefined;
      }

      // Player reconnection
      if (name && playerId && token) {
        const result = handlePlayerReconnect(roomCode, playerId, token);
        if (!result.success) {
          return Response.json(
            { error: result.error },
            { status: 401, headers: corsHeaders },
          );
        }

        const upgraded = server.upgrade(req, {
          data: { roomCode, role: "player", playerId },
        });

        if (!upgraded) {
          return Response.json(
            { error: "WebSocket upgrade failed" },
            { status: 500, headers: corsHeaders },
          );
        }

        return undefined;
      }

      // New player connection
      if (name) {
        const result = handlePlayerJoin(roomCode, name);
        if (!result.success) {
          return Response.json(
            { error: result.error },
            { status: 400, headers: corsHeaders },
          );
        }

        const upgraded = server.upgrade(req, {
          data: { roomCode, role: "player", playerId: result.playerId },
        });

        if (!upgraded) {
          return Response.json(
            { error: "WebSocket upgrade failed" },
            { status: 500, headers: corsHeaders },
          );
        }

        // Send join confirmation after upgrade
        // Note: This is sent in handleOpen, but we need to return the token somehow
        // We'll send it as the first WebSocket message
        return undefined;
      }

      return Response.json(
        { error: "Invalid connection parameters" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Health check
    if (path === "/health") {
      return Response.json({ status: "ok" }, { headers: corsHeaders });
    }

    // Serve static files if STATIC_DIR is configured (production mode)
    if (STATIC_DIR) {
      try {
        // Try to serve the requested file
        const filePath = path === "/" ? "/index.html" : path;
        const file = Bun.file(STATIC_DIR + filePath);

        if (await file.exists()) {
          return new Response(file);
        }

        // If file doesn't exist and it's not an API route, serve index.html (SPA fallback)
        if (!path.startsWith("/api/")) {
          const indexFile = Bun.file(STATIC_DIR + "/index.html");
          if (await indexFile.exists()) {
            return new Response(indexFile);
          }
        }
      } catch (error) {
        console.error("Error serving static file:", error);
      }
    }

    return Response.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders },
    );
  },

  websocket: {
    open(ws) {
      handleOpen(ws);

      // If this is a new player, send them their join confirmation
      if (ws.data.role === "player" && ws.data.playerId) {
        const room = getRoom(ws.data.roomCode);
        const player = room?.players.get(ws.data.playerId);
        if (player) {
          ws.send(
            JSON.stringify({
              type: MessageTypes.ROOM_JOINED,
              payload: {
                playerId: player.id,
                reconnectToken: player.reconnectToken,
              },
            }),
          );
        }
      }
    },

    message(ws, message) {
      handleMessage(ws, message);
    },

    close(ws) {
      handleClose(ws);
    },
  },
});

console.log(`Server running on http://localhost:${server.port}`);
