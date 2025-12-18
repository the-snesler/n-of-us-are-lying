# AGENTS.md

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the backend server (port 3001)
pnpm --filter @nofus/server dev

# Build shared types package
pnpm --filter @nofus/shared build

# Type check specific package
pnpm --filter @nofus/server typecheck
pnpm --filter @nofus/shared typecheck
```

## Documentation

Read the `/docs` folder before implementing features:
- **SPEC.md** - Game mechanics, lifecycle, scoring rules, and phase descriptions
- **NETWORK_PROTOCOL.md** - WebSocket message envelope format and routing examples
- **CRITIQUE_AND_PROPOSAL.md** - Architecture decisions, trade-offs, and recommended data structures

## Architecture Overview

This is a Jackbox-style party game ("N Of Us Are Lying") using a **host-authoritative architecture**.

### Monorepo Structure

- **apps/server** - Bun-based WebSocket relay server
- **apps/web** - React client (Host + Player views) - not yet implemented
- **packages/shared** - Zod schemas, TypeScript types, game constants

### Key Architectural Decisions

**Host-Authoritative State**: The Host client (desktop browser) manages all game state and rules. The backend is a "dumb pipe" that only routes messages between Host and Players. This allows game rules to change without backend modifications.

**Message Routing**: All WebSocket messages follow the `NetworkMessage` envelope with a `target` field:
- `target: "HOST"` - Route to host socket
- `target: "ALL"` - Broadcast to all players
- `target: "player_123"` - Route to specific player

The server injects `senderId` before forwarding messages.

### Server Endpoints

- `POST /api/v1/rooms` - Create room, returns `{ roomCode, hostToken }`
- `GET /api/v1/rooms/:code/ws` - WebSocket upgrade (query params: `role`, `token`, `name`, `playerId`)

### Type Sharing

Import shared types from `@nofus/shared`:
```typescript
import { GameState, Player, MessageTypes, NetworkMessage } from '@nofus/shared';
```

All types have corresponding Zod schemas for runtime validation (e.g., `PlayerSchema`, `GameStateSchema`).

# Network Protocol Specification

The backend acts as a **transparent relay** (dumb pipe). It does not validate game rules; it only routes messages between the **Host** (Game Authority) and **Players**.

## Message Envelope

All WebSocket messages follow this JSON structure:

```typescript
interface NetworkMessage {
  type: string;      // Event name (e.g., "SUBMIT_LIE", "SYNC_STATE")
  payload: any;      // The actual data
  target?: string;   // "HOST", "ALL", or specific "PLAYER_ID" (Routing instruction)
  senderId?: string; // Injected by the server so the recipient knows who sent it
}
```

## Communication Flows

### 1. Player -> Host (e.g., Submitting a Lie)

The Player client sends a message intended for the Host. The Server sees `target: "HOST"` and forwards it to the Host's socket.

1.  **Player Client** sends:
    ```json
    {
      "type": "SUBMIT_LIE",
      "payload": { "text": "I am a banana" },
      "target": "HOST"
    }
    ```
2.  **Server** receives, looks up the Host socket for this room, and forwards:
    ```json
    {
      "type": "SUBMIT_LIE",
      "payload": { "text": "I am a banana" },
      "senderId": "player_123" // Server injects this!
    }
    ```
3.  **Host Client** receives, updates its local `GameState`, and re-renders.

### 2. Host -> All Players (e.g., State Sync)

The Host updates the game state (e.g., moving from "Writing" to "Voting" phase) and needs to tell everyone what to show.

1.  **Host Client** sends:
    ```json
    {
      "type": "SYNC_STATE",
      "payload": { "phase": "VOTING", "timer": 30 },
      "target": "ALL"
    }
    ```
2.  **Server** broadcasts to all connected Player sockets in the room:
    ```json
    {
      "type": "SYNC_STATE",
      "payload": { "phase": "VOTING", "timer": 30 },
      "senderId": "HOST"
    }
    ```

### 3. Host -> Single Player (e.g., "You are the VIP")

1.  **Host Client** sends:
    ```json
    {
      "type": "SET_VIP",
      "payload": { "isVip": true },
      "target": "player_123"
    }
    ```
2.  **Server** forwards only to `player_123`:
    ```json
    {
      "type": "SET_VIP",
      "payload": { "isVip": true },
      "senderId": "HOST"
    }
    ```

## Server Responsibilities

The Server is minimal. It only handles:
1.  **Room Management**: Creating rooms, mapping `roomCode` to a set of sockets.
2.  **Connection Lifecycle**: Handling `ws.on('close')` to notify the Host that a player disconnected.
3.  **Routing**: Reading the `target` field and forwarding the message.

It does **NOT** know what a "Lie" is, or what the "Voting" phase is. This allows us to change game rules in the React Host without touching the backend.


# Prior Art

- Tom Scott’s “one of us is lying”
- heavily inspired by Jackbox, mechanically similar to Fibbage but without pregenerated ‘correct’ answers and with a more presentational element.
- Kahoot works in a remarkably similar way, but I think their state is handled on the “real” backend, not the “host” client browser.

## How Jackbox does it

1. **Room Creation**:
- Client POSTs to `/api/v2/rooms` with app_id, max_players, audience_enabled
- Server generates room code, creates Room with empty entities
- Returns room config with host token and room code

2. **Player Connection**:
- Each player connects to `/api/v2/rooms/:code/play`
- Query params include user_id, role (host/player/audience), name
- Reconnection handled via secret token

3. **Game State Management**:
- Host creates entities via `text/create`, `number/create`, `doodle/create`
- Each entity gets ACL (who can read/write)
- Players update entities based on permissions
- Server broadcasts ALL changes to ALL connected clients
- Clients maintain local cache of entities

Client connection lifecycle:
```
1. Client connects to /api/v2/rooms/:code/play (ecast) or /socket.io/1/websocket/:id
2. WebSocket established
3. Server sends client/welcome with current entities, room config, and player list
4. Client sends operations (text/create, number/set, doodle/stroke, etc.)
5. Server applies operation, updates entities
6. Server broadcasts changes to other clients via WebSocket
7. Client sends ping, server responds pong (keep-alive)
8. Client closes connection or room exits
```

# Components

- Backend server maintains WS connections to all clients, handles connecting all the clients in a “room” together
    - Also handles reconnection logic should a client become disconnected- prove that the client is allowed to join a closed room as a given role
- “Host” client = desktop web browser: shows game state, player responses, timer countdowns
    - Ideally this single client should be responsible for all game state and rules, so that additional games can be built on the same backend later
- “Player” client = mobile/desktop browser: represents a single player, receive game state, submit responses to the “host”

# Game lifecycle

The "host" is a desktop browser displaying on a TV. It displays global game information like timers, current phase, player scores, and the main game UI. The "players" are mobile or desktop browsers connecting to the host via room code. For example, during the lying phase all players' summaries (and a speaking order) are displayed on the TV, while the player phones see their own submitted summary, the article title, and a list of player summaries to vote for. The host should be interesting, the player UIs are mostly functional.

- Host client requests a room by sending some information to the backend, receives room code
- Player clients enter room code to join up to some player cap
- First player client to join has a “start” button that is used to initialize the game
- Game starts
- Tutorial phase:
    - Host displays tutorial/rules
- Research phase:
    - Host chooses 6 random wikipedia articles per player (using mediawiki random API + some criteria to filter out low-quality pages)
    - Player clients display first 3 articles with option to “reroll” to display second 3. Players select one article each.
    - Players get 3 minutes (configurable) to read up on their topic and submit a single-sentence summary.
    - This happens three times, so each player has read 3 articles and has written 3 summaries in a total of 9 minutes (can happen in parallel, so Player 1 could summarize all three articles while Player 2 is still reading the first article)
- Guessing rounds (happens 1-3 times per player. after everyone has gone once, players with lower scores are more likely to get selected for additional truth rounds)
    - 1 player’s article is selected, all other players get the article title and have 1 minute to submit their single-sentence summary.
        - During this time, the player whose article was selected gets a chance to refresh their memory on their topic
    - All players’ summaries are displayed on screen. Each player gets 2 minutes to justify/expand their summary verbally
    - All players besides the player whose article was selected get a chance to vote on which answer they think is true.
        - during this time, the truth-teller can mark any of the ‘lies’ as actually being true, if the other player already knew the random article’s topic.
    - Votes for a given player’s answer give the answer’s writer 700 points. The voter gets 500 points for selecting the correct answer, and 0 points for an incorrect answer.
- Occasionally the guessing round is replaced with an “everyone lies” round, where there is no correct answer and a new random article is drawn as the topic. The players are not told this.
- A final points leaderboard is shown and the game ends
