import { setup, assign, and, fromPromise } from "xstate";
import type { Player, Article, Round, RoomConfig } from "@nofus/shared";
import { fetchArticlesForPlayer } from "../lib/wikipedia";

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
  articleFetchStatus: Record<string, boolean>; // Track which players have pending/completed fetches

  // Rounds
  currentRoundIndex: number;
  rounds: Round[];
  currentPresentingPlayerId: string | null;
  systemArticles: Article[]; // For "everyone lies" rounds
  expertReady: boolean; // Hide expert identity during guessing
  expertReadyTimer: number | null; // Delay expert "ready" status
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
  | { type: "MARK_TRUE"; senderId: string; playerId: string }
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
  actors: {
    fetchArticles: fromPromise(
      async ({ input }: { input: { playerId: string } }) => {
        const articles = await fetchArticlesForPlayer(6);
        return { playerId: input.playerId, articles };
      },
    ),
  },
  actions: {
    addPlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== "PLAYER_CONNECTED") return context.players;

        // reconnect, preserve existing properties
        const existingPlayer = context.players[event.playerId];
        if (existingPlayer) {
          return {
            ...context.players,
            [event.playerId]: { ...existingPlayer, isConnected: true },
          };
        }

        // new player, create from scratch
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
        if (event.type !== "PROVIDE_ARTICLES" || event.playerId === "SYSTEM")
          return context.articleOptions;
        return { ...context.articleOptions, [event.playerId]: event.articles };
      },
      systemArticles: ({ context, event }) => {
        if (event.type !== "PROVIDE_ARTICLES" || event.playerId !== "SYSTEM")
          return context.systemArticles;
        return [...context.systemArticles, ...event.articles];
      },
      articleFetchStatus: ({ context, event }) => {
        if (event.type !== "PROVIDE_ARTICLES")
          return context.articleFetchStatus;
        return { ...context.articleFetchStatus, [event.playerId]: false };
      },
    }),

    markArticleFetching: assign({
      articleFetchStatus: ({ context }, params: { playerId: string }) => {
        return { ...context.articleFetchStatus, [params.playerId]: true };
      },
    }),

    fetchArticlesForPlayers: ({ context, self }) => {
      // Fetch system articles for "everyone lies" rounds
      if (context.systemArticles.length < 3) {
        fetchArticlesForPlayer(3).then((articles) => {
          self.send({ type: "PROVIDE_ARTICLES", playerId: "SYSTEM", articles });
        });
      }

      // Find players who need articles (not already fetched/fetching)
      const playersNeedingArticles = Object.keys(context.players).filter(
        (playerId) =>
          !context.articleOptions[playerId] &&
          !context.articleFetchStatus[playerId],
      );

      // Fetch articles for each player concurrently
      playersNeedingArticles.forEach((playerId) => {
        fetchArticlesForPlayer(6)
          .then((articles) => {
            self.send({ type: "PROVIDE_ARTICLES", playerId, articles });
          })
          .catch((error) => {
            console.error(`Failed to fetch articles for ${playerId}:`, error);
          });
      });
    },

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
            : article,
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
          i === context.currentRoundIndex ? updatedRound : r,
        );
      },
      expertReadyTimer: ({ context, event }) => {
        if (event.type !== "SUBMIT_LIE") return context.expertReadyTimer;
        if (context.expertReady || context.expertReadyTimer !== null)
          return context.expertReadyTimer;

        const currentRound = context.rounds[context.currentRoundIndex];
        if (!currentRound) return null;

        const connectedPlayers = Object.values(context.players).filter(
          (p) => p.isConnected,
        );
        const liarsCount = connectedPlayers.filter(
          (p) => p.id !== currentRound.targetPlayerId,
        ).length;
        const submittedCount = Object.keys(currentRound.lies).length + 1; // +1 for the current submission

        // Auto-submit expert summary 2 seconds after half of non-experts submit
        if (submittedCount >= Math.ceil(liarsCount / 2)) {
          return 2;
        }
        return null;
      },
    }),

    markTrue: assign({
      rounds: ({ context, event }) => {
        if (event.type !== "MARK_TRUE") return context.rounds;
        const currentRound = context.rounds[context.currentRoundIndex];
        if (!currentRound) return context.rounds;

        const updatedRound: Round = {
          ...currentRound,
          markedTrue: [
            ...new Set([...currentRound.markedTrue, event.playerId]),
          ],
        };
        return context.rounds.map((r, i) =>
          i === context.currentRoundIndex ? updatedRound : r,
        );
      },
    }),

    shuffleAnswers: assign({
      rounds: ({ context }) => {
        const currentRound = context.rounds[context.currentRoundIndex];
        if (!currentRound) return context.rounds;

        const answerIds = [...Object.keys(currentRound.lies)];
        if (!currentRound.isEveryoneLies) {
          answerIds.push(currentRound.targetPlayerId);
        }

        // Shuffle answerIds
        for (let i = answerIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [answerIds[i], answerIds[j]] = [answerIds[j], answerIds[i]];
        }

        const updatedRound: Round = {
          ...currentRound,
          shuffledAnswerIds: answerIds,
        };
        return context.rounds.map((r, i) =>
          i === context.currentRoundIndex ? updatedRound : r,
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
          i === context.currentRoundIndex ? updatedRound : r,
        );
      },
      expertReadyTimer: ({ context, event }) => {
        if (event.type !== "SUBMIT_VOTE") return context.expertReadyTimer;
        if (context.expertReady || context.expertReadyTimer !== null)
          return context.expertReadyTimer;

        const currentRound = context.rounds[context.currentRoundIndex];
        if (!currentRound) return null;

        const connectedPlayers = Object.values(context.players).filter(
          (p) => p.isConnected,
        );
        const votersCount = connectedPlayers.filter(
          (p) => p.id !== currentRound.targetPlayerId,
        ).length;
        const submittedCount = Object.keys(currentRound.votes).length + 1;

        // Auto-submit expert status 2 seconds after half of voters submit
        if (submittedCount >= Math.ceil(votersCount / 2)) {
          return 2;
        }
        return null;
      },
    }),

    calculateScores: assign({
      players: ({ context }) => {
        const currentRound = context.rounds[context.currentRoundIndex];
        if (!currentRound) return context.players;

        const updatedPlayers = { ...context.players };
        const expertId = currentRound.targetPlayerId;

        // Process each vote
        for (const [voterId, answerId] of Object.entries(currentRound.votes)) {
          // Check if voter chose the correct answer (the expert's ID)
          // OR if they chose a lie that was marked as true
          const isCorrect =
            answerId === expertId || currentRound.markedTrue.includes(answerId);

          if (isCorrect) {
            // Voter gets points for correct vote
            const voter = updatedPlayers[voterId];
            if (voter) {
              updatedPlayers[voterId] = {
                ...voter,
                score: voter.score + POINTS_FOR_CORRECT_VOTE,
              };
            }
          } else {
            // The person whose lie was voted for gets points
            const liar = updatedPlayers[answerId];
            if (liar) {
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
      articleFetchStatus: () => ({}),
    }),

    setupRounds: assign({
      rounds: ({ context }) => {
        // Create one round per player per article they researched
        const rounds: Round[] = [];
        const playerIds = Object.keys(context.players);

        for (const playerId of playerIds) {
          const articles = context.selectedArticles[playerId] || [];
          for (let i = 0; i < articles.length; i++) {
            if (i !== 0 && Math.random() > (context.config.playerAdditionalArticleChance || 0)) break
            const article = articles[i];
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

        // Apply "everyone lies" chance
        let systemArticleIdx = 0;
        return rounds.map((round) => {
          if (
            Math.random() < (context.config.everyoneLiesChance || 0) &&
            systemArticleIdx < context.systemArticles.length
          ) {
            const systemArticle = context.systemArticles[systemArticleIdx++];
            return {
              ...round,
              article: systemArticle,
              isEveryoneLies: true,
              targetPlayerId: "NONE", // No expert
            };
          }
          return round;
        });
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
      expertReady: ({ context }) => {
        const currentRound = context.rounds[context.currentRoundIndex];
        // If it's "everyone lies", there is no expert to wait for
        return currentRound?.isEveryoneLies || false;
      },
      expertReadyTimer: () => null,
    }),

    setupVoting: assign({
      expertReady: ({ context }) => {
        const currentRound = context.rounds[context.currentRoundIndex];
        return currentRound?.isEveryoneLies || false;
      },
      expertReadyTimer: () => null,
      timer: ({ context }) => context.config.voteTimeSeconds,
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

    setRevealTimer: assign({
      timer: () => 15, // 15 seconds for reveal
    }),

    tickTimer: assign({
      timer: ({ context }) =>
        context.timer !== null ? Math.max(0, context.timer - 1) : null,
      expertReadyTimer: ({ context }) => {
        if (context.expertReadyTimer === null) return null;
        return Math.max(0, context.expertReadyTimer - 1);
      },
      expertReady: ({ context }) => {
        if (context.expertReady) return true;
        return context.expertReadyTimer === 0;
      },
    }),

    clearTimer: assign({
      timer: () => null,
    }),
  },
  guards: {
    enoughPlayers: ({ context }) => {
      const connectedPlayers = Object.values(context.players).filter(
        (p) => p.isConnected,
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
        (p) => p.isConnected,
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
        (p) => p.isConnected,
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
        (p) => p.isConnected,
      );

      // All players except the truth-teller should submit a lie
      const playersWhoShouldLie = connectedPlayers.filter(
        (p) => p.id !== currentRound.targetPlayerId,
      );

      const allLiesSubmitted = playersWhoShouldLie.every(
        (player) => currentRound.lies[player.id] !== undefined,
      );

      // Also wait for the fake expert "ready" status to hide their identity
      return allLiesSubmitted && context.expertReady;
    },

    allPlayersVoted: ({ context }) => {
      const currentRound = context.rounds[context.currentRoundIndex];
      if (!currentRound) return false;

      const connectedPlayers = Object.values(context.players).filter(
        (p) => p.isConnected,
      );

      // All players except the truth-teller should vote
      const playersWhoShouldVote = connectedPlayers.filter(
        (p) => p.id !== currentRound.targetPlayerId,
      );

      const allVotesSubmitted = playersWhoShouldVote.every(
        (player) => currentRound.votes[player.id] !== undefined,
      );

      return allVotesSubmitted && context.expertReady;
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
      articlesPerPlayer: 2,
      articleSelectionTimeSeconds: 60,
      researchTimeSeconds: 240,
      lieTimeSeconds: 60,
      presentationTimeSeconds: 600,
      voteTimeSeconds: 30,
      everyoneLiesChance: 0.10,
      playerAdditionalArticleChance: 0.5,
    },
    timer: null,
    researchRoundIndex: 0,
    articleOptions: {},
    selectedArticles: {},
    hasRerolled: {},
    articleFetchStatus: {},
    currentRoundIndex: 0,
    rounds: [],
    currentPresentingPlayerId: null,
    systemArticles: [],
    expertReady: false,
    expertReadyTimer: null,
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
      entry: ["setResearchTimer", "fetchArticlesForPlayers"],
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
        TIMER_END: {
          target: "presenting",
          actions: "shuffleAnswers",
        },
      },
      always: {
        target: "presenting",
        guard: "allPlayersSubmittedLie",
        actions: "shuffleAnswers",
      },
    },

    presenting: {
      entry: "setPresentationTimer",
      on: {
        TIMER_TICK: {
          actions: "tickTimer",
        },
        TIMER_END: "voting",
        NEXT_PHASE: "voting",
      },
    },

    voting: {
      entry: "setupVoting",
      on: {
        MARK_TRUE: {
          actions: "markTrue",
        },
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
      entry: ["setRevealTimer", "calculateScores"],
      on: {
        TIMER_TICK: {
          actions: "tickTimer",
        },
        TIMER_END: [
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
