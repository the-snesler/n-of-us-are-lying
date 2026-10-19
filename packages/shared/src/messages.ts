import { z } from 'zod';
import { ArticleSchema, PlayerViewStateSchema, RoomConfigSchema } from './types';
import { ROOM_CODE_LENGTH } from ".";

// Base message envelope
export const NetworkMessageSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
  target: z.string().optional(), // "HOST", "ALL", or specific playerId
  senderId: z.string().optional(), // Injected by server
});

export type NetworkMessage = z.infer<typeof NetworkMessageSchema>;

// === Client -> Server Messages ===

export const JoinRoomPayloadSchema = z.object({
  roomCode: z.string().length(ROOM_CODE_LENGTH),
  playerName: z.string().min(1).max(20),
  avatarId: z.number().min(0).max(9),
});

export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;

export const ReconnectPayloadSchema = z.object({
  roomCode: z.string().length(ROOM_CODE_LENGTH),
  playerId: z.string(),
  token: z.string(),
});

export type ReconnectPayload = z.infer<typeof ReconnectPayloadSchema>;

export const CreateRoomPayloadSchema = z.object({
  config: RoomConfigSchema.partial(),
});

export type CreateRoomPayload = z.infer<typeof CreateRoomPayloadSchema>;

// === Server -> Client Messages ===

export const RoomCreatedPayloadSchema = z.object({
  roomCode: z.string(),
  hostToken: z.string(),
});

export type RoomCreatedPayload = z.infer<typeof RoomCreatedPayloadSchema>;

export const RoomJoinedPayloadSchema = z.object({
  playerId: z.string(),
  reconnectToken: z.string(),
  state: PlayerViewStateSchema,
});

export type RoomJoinedPayload = z.infer<typeof RoomJoinedPayloadSchema>;

export const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

export const PlayerConnectedPayloadSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  avatarId: z.number(),
});

export type PlayerConnectedPayload = z.infer<typeof PlayerConnectedPayloadSchema>;

export const HostConnectedPayloadSchema = z.object({
  players: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
});

export type HostConnectedPayload = z.infer<typeof HostConnectedPayloadSchema>;

export const PlayerDisconnectedPayloadSchema = z.object({
  playerId: z.string(),
});

export type PlayerDisconnectedPayload = z.infer<typeof PlayerDisconnectedPayloadSchema>;

// === Player -> Host Messages (Relayed) ===

export const StartGamePayloadSchema = z.object({});

export type StartGamePayload = z.infer<typeof StartGamePayloadSchema>;

export const ChooseArticlePayloadSchema = z.object({
  articleId: z.string(),
});

export type ChooseArticlePayload = z.infer<typeof ChooseArticlePayloadSchema>;

export const ChooseCustomArticlePayloadSchema = z.object({
  article: ArticleSchema,
});

export type ChooseCustomArticlePayload = z.infer<typeof ChooseCustomArticlePayloadSchema>;

export const SubmitSummaryPayloadSchema = z.object({
  articleId: z.string(),
  summary: z.string().min(1).max(500),
});

export type SubmitSummaryPayload = z.infer<typeof SubmitSummaryPayloadSchema>;

export const SubmitLiePayloadSchema = z.object({
  text: z.string().min(1).max(500),
});

export type SubmitLiePayload = z.infer<typeof SubmitLiePayloadSchema>;

export const SubmitVotePayloadSchema = z.object({
  answerId: z.string(),
});

export type SubmitVotePayload = z.infer<typeof SubmitVotePayloadSchema>;

export const MarkAlsoTruePayloadSchema = z.object({
  playerId: z.string(),
});

export type MarkAlsoTruePayload = z.infer<typeof MarkAlsoTruePayloadSchema>;

export const RerollArticlesPayloadSchema = z.object({});

export type RerollArticlesPayload = z.infer<typeof RerollArticlesPayloadSchema>;

// === Host -> Player Messages (Relayed) ===

export const SyncStatePayloadSchema = PlayerViewStateSchema.extend({
  encryptedHostState: z.string().optional(), // Full host state encrypted with hostToken
});

export type SyncStatePayload = z.infer<typeof SyncStatePayloadSchema>;

export const SetVipPayloadSchema = z.object({
  isVip: z.boolean(),
});

export type SetVipPayload = z.infer<typeof SetVipPayloadSchema>;

// === Host Recovery Messages ===

export const RequestStateRecoveryPayloadSchema = z.object({});

export type RequestStateRecoveryPayload = z.infer<typeof RequestStateRecoveryPayloadSchema>;

export const ProvideStateRecoveryPayloadSchema = z.object({
  encryptedHostState: z.string(),
});

export type ProvideStateRecoveryPayload = z.infer<typeof ProvideStateRecoveryPayloadSchema>;

// === Message Type Constants ===

export const MessageTypes = {
  // Client -> Server
  CREATE_ROOM: 'CREATE_ROOM',
  JOIN_ROOM: 'JOIN_ROOM',
  RECONNECT: 'RECONNECT',

  // Server -> Client
  ROOM_CREATED: 'ROOM_CREATED',
  ROOM_JOINED: 'ROOM_JOINED',
  ERROR: 'ERROR',
  PLAYER_CONNECTED: 'PLAYER_CONNECTED',
  HOST_CONNECTED: 'HOST_CONNECTED',
  PLAYER_DISCONNECTED: 'PLAYER_DISCONNECTED',

  // Player -> Host (Relayed)
  START_GAME: 'START_GAME',
  CHOOSE_ARTICLE: 'CHOOSE_ARTICLE',
  CHOOSE_CUSTOM_ARTICLE: 'CHOOSE_CUSTOM_ARTICLE',
  SUBMIT_SUMMARY: 'SUBMIT_SUMMARY',
  SUBMIT_LIE: 'SUBMIT_LIE',
  SUBMIT_VOTE: 'SUBMIT_VOTE',
  MARK_ALSO_TRUE: 'MARK_ALSO_TRUE',
  REROLL_ARTICLES: 'REROLL_ARTICLES',

  // Host -> Player (Relayed)
  SYNC_STATE: 'SYNC_STATE',
  SET_VIP: 'SET_VIP',

  // State Recovery
  REQUEST_STATE_RECOVERY: 'REQUEST_STATE_RECOVERY',
  PROVIDE_STATE_RECOVERY: 'PROVIDE_STATE_RECOVERY',

  // Internal/Other
  NEXT_PHASE: 'NEXT_PHASE',
  MARK_TRUE: 'MARK_TRUE',
} as const;

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];
