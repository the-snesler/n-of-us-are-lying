import { z } from "zod";

// Game phases
export const GamePhaseSchema = z.enum([
  "LOBBY",
  "TUTORIAL",
  "TOPIC_SELECTION",
  "WRITING",
  "GUESSING",
  "PRESENTING",
  "VOTING",
  "REVEAL",
  "LEADERBOARD",
]);

export type GamePhase = z.infer<typeof GamePhaseSchema>;

// Player
export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number(),
  isVip: z.boolean(),
  isConnected: z.boolean(),
  avatarId: z.number().min(0).max(9),
});

export type Player = z.infer<typeof PlayerSchema>;

// Wikipedia Article
export const ArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(), // Player-generated summary
  url: z.string().url(),
  extract: z.string().optional(), // Wikipedia extract for reference
});

export type Article = z.infer<typeof ArticleSchema>;

// Round data
export const RoundSchema = z.object({
  targetPlayerId: z.string(),
  article: ArticleSchema,
  lies: z.record(z.string(), z.string()), // playerId -> lie text
  votes: z.record(z.string(), z.string()), // voterId -> answerId (playerId)
  markedTrue: z.array(z.string()), // playerIds whose lies were marked as "also true"
  isEveryoneLies: z.boolean(),
  shuffledAnswerIds: z.array(z.string()).optional(), // Shuffled list of playerIds (including expert)
});

export type Round = z.infer<typeof RoundSchema>;

// Room configuration
export const RoomConfigSchema = z.object({
  maxPlayers: z.number().min(3).max(8).default(8),
  articlesPerPlayer: z.number().default(3),
  articleSelectionTimeSeconds: z.number().default(60),
  researchTimeSeconds: z.number().default(240),
  lieTimeSeconds: z.number().default(60),
  presentationTimeSeconds: z.number().default(600),
  voteTimeSeconds: z.number().default(30),
  everyoneLiesChance: z.number().min(0).max(1).default(0.10),
  playerAdditionalArticleChance: z.number().min(0).max(1).default(0.5),
});

export type RoomConfig = z.infer<typeof RoomConfigSchema>;

// Complete game state (managed by Host)
export const GameStateSchema = z.object({
  roomCode: z.string(),
  phase: GamePhaseSchema,
  players: z.record(z.string(), PlayerSchema),
  config: RoomConfigSchema,
  timer: z.number().nullable(),

  // Research phase data
  articleOptions: z.record(z.string(), z.array(ArticleSchema)), // playerId -> available articles
  selectedArticles: z.record(z.string(), z.array(ArticleSchema)), // playerId -> chosen articles

  // Round data
  currentRoundIndex: z.number(),
  rounds: z.array(RoundSchema),
  currentPresentingPlayerId: z.string().nullable(),
});

export type GameState = z.infer<typeof GameStateSchema>;

// Player view state (subset sent to players)
export const PlayerViewStateSchema = z.object({
  roomCode: z.string(),
  phase: GamePhaseSchema,
  playerId: z.string(),
  players: z.record(
    z.string(),
    PlayerSchema.pick({
      id: true,
      name: true,
      score: true,
      isVip: true,
      isConnected: true,
      avatarId: true,
    }),
  ),
  timer: z.number().nullable(),

  // Phase-specific data
  articleOptions: z.array(ArticleSchema).optional(),
  currentArticle: ArticleSchema.optional(),
  articleTitle: z.string().optional(),
  isExpert: z.boolean().optional(),
  mySubmission: z.string().optional(),
  answers: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
      }),
    )
    .optional(),
  hasSubmittedChoice: z.boolean().optional(),
  hasSubmittedSummary: z.boolean().optional(),
  hasSubmittedLie: z.boolean().optional(),
  hasVoted: z.boolean().optional(),
  markedTrue: z.array(z.string()).optional(),
});

export type PlayerViewState = z.infer<typeof PlayerViewStateSchema>;
