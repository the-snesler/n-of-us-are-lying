import { setup, assign, and } from "xstate";
import type { Player, Article, Round, RoomConfig } from "@nofus/shared";

// Scoring constants
const POINTS_FOR_FOOLING = 700;
const POINTS_FOR_CORRECT_VOTE = 500;

// Context type for the game state machine
interface GameContext {
  roomCode: string;
  players: Record<string, Player>;
  config: RoomConfig;
  timer: number | null;

  // Research phase
  researchRoundIndex: number; // 0-2, tracks which of 3 research cycles
  articleOptions: Record<string, Article[]>; // playerId -> 6 articles (first 3 shown, reroll shows next 3)
  selectedArticles: Record<string, Article[]>; // playerId -> chosen articles (up to 3)
  hasRerolled: Record<string, boolean>; // Track who has rerolled in current research round

  // Rounds
  currentRoundIndex: number;
  rounds: Round[];
  currentPresentingPlayerId: string | null;
}

// Event types that the machine can receive
type GameEvent =
  | { type: "START_GAME"; senderId: string }
  | { type: "PLAYER_CONNECTED"; playerId: string; playerName: string }
  | { type: "PLAYER_DISCONNECTED"; playerId: string }
  | { type: "PROVIDE_ARTICLES"; playerId: string; articles: Article[] }
  | { type: "REROLL_ARTICLES"; senderId: string }
  | { type: "CHOOSE_ARTICLE"; senderId: string; articleId: string }
  | {
      type: "SUBMIT_SUMMARY";
      senderId: string;
      articleId: string;
      summary: string;
    }
  | { type: "SUBMIT_LIE"; senderId: string; text: string }
  | { type: "SUBMIT_VOTE"; senderId: string; answerId: string }
  | { type: "TIMER_TICK" }
  | { type: "TIMER_END" }
  | { type: "NEXT_PHASE" };

// Create the game state machine
export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actions: {
    addPlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== "PLAYER_CONNECTED") return context.players;
        const isFirst = Object.keys(context.players).length === 0;
        const newPlayer: Player = {
          id: event.playerId,
          name: event.playerName,
          score: 0,
          isVip: isFirst,
          isConnected: true,
          avatarId: Math.floor(Math.random() * 10),
        };
        return { ...context.players, [event.playerId]: newPlayer };
      },
    }),

    disconnectPlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== "PLAYER_DISCONNECTED") return context.players;
        const player = context.players[event.playerId];
        if (!player) return context.players;
        return {
          ...context.players,
          [event.playerId]: { ...player, isConnected: false },
        };
      },
    }),

    provideArticles: assign({
      articleOptions: ({ context, event }) => {
        if (event.type !== "PROVIDE_ARTICLES") return context.articleOptions;
        return { ...context.articleOptions, [event.playerId]: event.articles };
      },
    }),

    rerollArticles: assign({
      hasRerolled: ({ context, event }) => {
        if (event.type !== "REROLL_ARTICLES") return context.hasRerolled;
        return { ...context.hasRerolled, [event.senderId]: true };
      },
    }),

    chooseArticle: assign({
      selectedArticles: ({ context, event }) => {
        if (event.type !== "CHOOSE_ARTICLE") return context.selectedArticles;
        const playerId = event.senderId;
        const articles = context.articleOptions[playerId] || [];
        const chosen = articles.find((a) => a.id === event.articleId);
        if (!chosen) return context.selectedArticles;

        const existing = context.selectedArticles[playerId] || [];
        return {
          ...context.selectedArticles,
          [playerId]: [...existing, chosen],
        };
      },
      articleOptions: ({ context, event }) => {
        if (event.type !== "CHOOSE_ARTICLE") return context.articleOptions;
        // Clear article options for this player after choosing
        const { [event.senderId]: _, ...rest } = context.articleOptions;
        return rest;
      },
    }),

    submitSummary: assign({
      selectedArticles: ({ context, event }) => {
        if (event.type !== "SUBMIT_SUMMARY") return context.selectedArticles;
        const playerId = event.senderId;
        const playerArticles = context.selectedArticles[playerId] || [];
        const updatedArticles = playerArticles.map((article) =>
          article.id === event.articleId
            ? { ...article, summary: event.summary }
            : article
        );
        return { ...context.selectedArticles, [playerId]: updatedArticles };
      },
    }),

    submitLie: assign({
      rounds: ({ context, event }) => {
        if (event.type !== "SUBMIT_LIE") return context.rounds;
        const currentRound = context.rounds[context.currentRoundIndex];
        if (!currentRound) return context.rounds;

        const updatedRound: Round = {
          ...currentRound,
          lies: { ...currentRound.lies, [event.senderId]: event.text },
        };
        return context.rounds.map((r, i) =>
          i === context.currentRoundIndex ? updatedRound : r
        );
      },
    }),

    submitVote: assign({
      rounds: ({ context, event }) => {
        if (event.type !== "SUBMIT_VOTE") return context.rounds;
        const currentRound = context.rounds[context.currentRoundIndex];
        if (!currentRound) return context.rounds;

        const updatedRound: Round = {
          ...currentRound,
          votes: { ...currentRound.votes, [event.senderId]: event.answerId },
        };
        return context.rounds.map((r, i) =>
          i === context.currentRoundIndex ? updatedRound : r
        );
      },
    }),

    calculateScores: assign({
      players: ({ context }) => {
        const currentRound = context.rounds[context.currentRoundIndex];
        if (!currentRound) return context.players;

        const updatedPlayers = { ...context.players };
        const correctAnswerId = currentRound.targetPlayerId;

        // Process each vote
        for (const [voterId, answerId] of Object.entries(currentRound.votes)) {
          // Check if voter chose the correct answer (the truth-teller's ID)
          if (answerId === correctAnswerId) {
            // Voter gets points for correct vote
            const voter = updatedPlayers[voterId];
            if (voter) {
              updatedPlayers[voterId] = {
                ...voter,
                score: voter.score + POINTS_FOR_CORRECT_VOTE,
              };
            }
          } else {
            // The person whose lie was voted for gets points (if it's a lie, not marked true)
            const liar = updatedPlayers[answerId];
            if (liar && !currentRound.markedTrue.includes(answerId)) {
              updatedPlayers[answerId] = {
                ...liar,
                score: liar.score + POINTS_FOR_FOOLING,
              };
            }
          }
        }

        return updatedPlayers;
      },
    }),

    incrementResearchRound: assign({
      researchRoundIndex: ({ context }) => context.researchRoundIndex + 1,
      hasRerolled: () => ({}), // Reset reroll tracking for new research round
    }),

    setupRounds: assign({
      rounds: ({ context }) => {
        // Create one round per player per article they researched
        const rounds: Round[] = [];
        const playerIds = Object.keys(context.players);

        for (const playerId of playerIds) {
          const articles = context.selectedArticles[playerId] || [];
          for (const article of articles) {
            rounds.push({
              targetPlayerId: playerId,
              article,
              lies: {},
              votes: {},
              markedTrue: [],
              isEveryoneLies: false,
            });
          }
        }

        // Shuffle rounds so they're not all grouped by player
        for (let i = rounds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rounds[i], rounds[j]] = [rounds[j], rounds[i]];
        }

        return rounds;
      },
      currentRoundIndex: () => 0,
      currentPresentingPlayerId: ({ context }) => {
        // Will be set properly once rounds are created
        const playerIds = Object.keys(context.players);
        return playerIds[0] || null;
      },
    }),

    setupCurrentRound: assign({
      currentPresentingPlayerId: ({ context }) => {
        const currentRound = context.rounds[context.currentRoundIndex];
        return currentRound?.targetPlayerId || null;
      },
    }),

    nextRound: assign({
      currentRoundIndex: ({ context }) => context.currentRoundIndex + 1,
    }),

    setResearchTimer: assign({
      timer: ({ context }) => context.config.researchTimeSeconds,
    }),

    setLieTimer: assign({
      timer: ({ context }) => context.config.lieTimeSeconds,
    }),

    setPresentationTimer: assign({
      timer: ({ context }) => context.config.presentationTimeSeconds,
    }),

    setVoteTimer: assign({
      timer: ({ context }) => context.config.voteTimeSeconds,
    }),

    tickTimer: assign({
      timer: ({ context }) =>
        context.timer !== null ? Math.max(0, context.timer - 1) : null,
    }),

    clearTimer: assign({
      timer: () => null,
    }),
  },
  guards: {
    enoughPlayers: ({ context }) => {
      const connectedPlayers = Object.values(context.players).filter(
        (p) => p.isConnected
      );
      return connectedPlayers.length >= 3;
    },

    senderIsVIP: ({ context, event }) => {
      if (!("senderId" in event)) return false;
      const player = context.players[event.senderId];
      return player?.isVip || false;
    },

    hasMoreResearchRounds: ({ context }) => context.researchRoundIndex < 2,

    researchComplete: ({ context }) => context.researchRoundIndex >= 2,

    hasMoreGuessingRounds: ({ context }) =>
      context.currentRoundIndex < context.rounds.length - 1,

    allRoundsComplete: ({ context }) =>
      context.currentRoundIndex >= context.rounds.length - 1,

    canReroll: ({ context, event }) => {
      if (event.type !== "REROLL_ARTICLES") return false;
      return !context.hasRerolled[event.senderId];
    },

    allPlayersChoseArticle: ({ context }) => {
      const connectedPlayers = Object.values(context.players).filter(
        (p) => p.isConnected
      );

      return connectedPlayers.every((player) => {
        const selectedCount = (context.selectedArticles[player.id] || [])
          .length;
        const expectedCount = context.researchRoundIndex + 1; // Round 0 needs 1, round 1 needs 2, etc.
        return selectedCount >= expectedCount;
      });
    },

    allPlayersSubmittedSummary: ({ context }) => {
      const connectedPlayers = Object.values(context.players).filter(
        (p) => p.isConnected
      );
      const expectedCount = context.researchRoundIndex + 1; // Round 0 needs 1 summary, round 1 needs 2, etc.

      return connectedPlayers.every((player) => {
        const articles = context.selectedArticles[player.id] || [];
        const summariesCount = articles.filter((a) => a.summary).length;
        return summariesCount >= expectedCount;
      });
    },

    allPlayersSubmittedLie: ({ context }) => {
      const currentRound = context.rounds[context.currentRoundIndex];
      if (!currentRound) return false;

      const connectedPlayers = Object.values(context.players).filter(
        (p) => p.isConnected
      );

      // All players except the truth-teller should submit a lie
      const playersWhoShouldLie = connectedPlayers.filter(
        (p) => p.id !== currentRound.targetPlayerId
      );

      return playersWhoShouldLie.every(
        (player) => currentRound.lies[player.id] !== undefined
      );
    },

    allPlayersVoted: ({ context }) => {
      const currentRound = context.rounds[context.currentRoundIndex];
      if (!currentRound) return false;

      const connectedPlayers = Object.values(context.players).filter(
        (p) => p.isConnected
      );

      // All players except the truth-teller should vote
      const playersWhoShouldVote = connectedPlayers.filter(
        (p) => p.id !== currentRound.targetPlayerId
      );

      return playersWhoShouldVote.every(
        (player) => currentRound.votes[player.id] !== undefined
      );
    },
  },
}).createMachine({
  id: "game",
  initial: "lobby",
  context: {
    roomCode: "",
    players: {},
    config: {
      maxPlayers: 8,
      articlesPerPlayer: 3,
      articleSelectionTimeSeconds: 60,
      researchTimeSeconds: 180,
      lieTimeSeconds: 60,
      presentationTimeSeconds: 120,
      voteTimeSeconds: 30,
      everyoneLiesChance: 0.15,
    },
    timer: null,
    researchRoundIndex: 0,
    articleOptions: {},
    selectedArticles: {},
    hasRerolled: {},
    currentRoundIndex: 0,
    rounds: [],
    currentPresentingPlayerId: null,
  },
  states: {
    lobby: {
      on: {
        PLAYER_CONNECTED: {
          actions: "addPlayer",
        },
        PLAYER_DISCONNECTED: {
          actions: "disconnectPlayer",
        },
        START_GAME: {
          target: "tutorial",
          guard: and(["senderIsVIP", "enoughPlayers"]),
        },
      },
    },

    tutorial: {
      on: {
        NEXT_PHASE: "topicSelection",
      },
    },

    topicSelection: {
      entry: "setResearchTimer",
      on: {
        PROVIDE_ARTICLES: {
          actions: "provideArticles",
        },
        REROLL_ARTICLES: {
          guard: "canReroll",
          actions: "rerollArticles",
        },
        CHOOSE_ARTICLE: {
          actions: "chooseArticle",
        },
        TIMER_TICK: {
          actions: "tickTimer",
        },
        TIMER_END: "writing",
        NEXT_PHASE: "writing",
      },
      always: {
        target: "writing",
        guard: "allPlayersChoseArticle",
      },
    },

    writing: {
      on: {
        SUBMIT_SUMMARY: {
          actions: "submitSummary",
        },
        TIMER_TICK: {
          actions: "tickTimer",
        },
        TIMER_END: [
          {
            target: "topicSelection",
            guard: "hasMoreResearchRounds",
            actions: "incrementResearchRound",
          },
          {
            target: "guessing",
            guard: "researchComplete",
            actions: "setupRounds",
          },
        ],
      },
      always: [
        {
          target: "topicSelection",
          guard: and(["allPlayersSubmittedSummary", "hasMoreResearchRounds"]),
          actions: "incrementResearchRound",
        },
        {
          target: "guessing",
          guard: and(["allPlayersSubmittedSummary", "researchComplete"]),
          actions: "setupRounds",
        },
      ],
    },

    guessing: {
      entry: ["setLieTimer", "setupCurrentRound"],
      on: {
        SUBMIT_LIE: {
          actions: "submitLie",
        },
        TIMER_TICK: {
          actions: "tickTimer",
        },
        TIMER_END: "presenting",
      },
      always: {
        target: "presenting",
        guard: "allPlayersSubmittedLie",
      },
    },

    presenting: {
      entry: "setPresentationTimer",
      on: {
        TIMER_TICK: {
          actions: "tickTimer",
        },
        NEXT_PHASE: "voting",
      },
    },

    voting: {
      entry: "setVoteTimer",
      on: {
        SUBMIT_VOTE: {
          actions: "submitVote",
        },
        TIMER_TICK: {
          actions: "tickTimer",
        },
        TIMER_END: "reveal",
      },
      always: {
        target: "reveal",
        guard: "allPlayersVoted",
      },
    },

    reveal: {
      entry: ["clearTimer", "calculateScores"],
      on: {
        NEXT_PHASE: [
          {
            target: "guessing",
            guard: "hasMoreGuessingRounds",
            actions: "nextRound",
          },
          {
            target: "leaderboard",
            guard: "allRoundsComplete",
          },
        ],
      },
    },

    leaderboard: {
      type: "final",
    },
  },
});
