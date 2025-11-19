import { setup } from 'xstate';
import type { Player, Article, Round, RoomConfig } from '@nofus/shared';

// Context type for the game state machine
interface GameContext {
  roomCode: string;
  players: Record<string, Player>;
  config: RoomConfig;
  timer: number | null;

  // Research phase
  articleOptions: Record<string, Article[]>;
  selectedArticles: Record<string, Article[]>;

  // Rounds
  currentRoundIndex: number;
  rounds: Round[];
  currentPresentingPlayerId: string | null;
}

// Event types that the machine can receive
type GameEvent =
  | { type: 'START_GAME'; senderId: string }
  | { type: 'PLAYER_CONNECTED'; playerId: string; playerName: string }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string }
  | { type: 'CHOOSE_ARTICLE'; senderId: string; articleId: string }
  | { type: 'SUBMIT_SUMMARY'; senderId: string; articleId: string; summary: string }
  | { type: 'SUBMIT_LIE'; senderId: string; text: string }
  | { type: 'SUBMIT_VOTE'; senderId: string; answerId: string }
  | { type: 'TIMER_TICK' }
  | { type: 'TIMER_END' }
  | { type: 'NEXT_PHASE' };

// Create the game state machine
export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
}).createMachine({
  id: 'game',
  initial: 'lobby',
  context: {
    roomCode: '',
    players: {},
    config: {
      maxPlayers: 8,
      articlesPerPlayer: 3,
      researchTimeSeconds: 180,
      lieTimeSeconds: 60,
      presentationTimeSeconds: 120,
      voteTimeSeconds: 30,
      everyoneLiesChance: 0.15,
    },
    timer: null,
    articleOptions: {},
    selectedArticles: {},
    currentRoundIndex: 0,
    rounds: [],
    currentPresentingPlayerId: null,
  },
  states: {
    lobby: {
      on: {
        PLAYER_CONNECTED: {
          actions: () => {
            // TODO: Add player to context
          },
        },
        PLAYER_DISCONNECTED: {
          actions: () => {
            // TODO: Mark player as disconnected
          },
        },
        START_GAME: {
          target: 'tutorial',
          guard: ({ context }) => Object.keys(context.players).length >= 3,
        },
      },
    },
    tutorial: {
      on: {
        NEXT_PHASE: 'topicSelection',
      },
    },
    topicSelection: {
      on: {
        CHOOSE_ARTICLE: {
          actions: () => {
            // TODO: Record player's article choice
          },
        },
        NEXT_PHASE: 'writing',
      },
    },
    writing: {
      on: {
        SUBMIT_SUMMARY: {
          actions: () => {
            // TODO: Record player's summary
          },
        },
        TIMER_END: 'guessing',
      },
    },
    guessing: {
      on: {
        SUBMIT_LIE: {
          actions: () => {
            // TODO: Record player's lie
          },
        },
        TIMER_END: 'presenting',
      },
    },
    presenting: {
      on: {
        NEXT_PHASE: 'voting',
      },
    },
    voting: {
      on: {
        SUBMIT_VOTE: {
          actions: () => {
            // TODO: Record player's vote
          },
        },
        TIMER_END: 'reveal',
      },
    },
    reveal: {
      on: {
        NEXT_PHASE: [
          { target: 'guessing', guard: ({ context }) => context.currentRoundIndex < context.rounds.length - 1 },
          { target: 'leaderboard' },
        ],
      },
    },
    leaderboard: {
      type: 'final',
    },
  },
});
