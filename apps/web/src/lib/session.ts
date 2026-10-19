/**
 * Persistent session storage (localStorage) so players and hosts can leave
 * the page (e.g. to read a Wikipedia article) and rejoin with the same identity.
 */

import type { GameLength } from "../machines/gameMachine";

export interface PlayerSession {
  name: string;
  playerId?: string;
  token?: string;
}

const playerKey = (roomCode: string) => `nofus_player_${roomCode.toUpperCase()}`;
const hostKey = (roomCode: string) => `nofus_host_${roomCode.toUpperCase()}`;
const hostGameLengthKey = (roomCode: string) =>
  `nofus_host_length_${roomCode.toUpperCase()}`;
const LAST_ROOM_KEY = "nofus_last_room";
const draftKey = (roomCode: string, articleId: string) =>
  `nofus_draft_${roomCode.toUpperCase()}_${articleId}`;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function getPlayerSession(roomCode: string): PlayerSession | null {
  return readJson<PlayerSession>(playerKey(roomCode));
}

export function setPlayerSession(roomCode: string, session: PlayerSession): void {
  localStorage.setItem(playerKey(roomCode), JSON.stringify(session));
  localStorage.setItem(LAST_ROOM_KEY, roomCode.toUpperCase());
}

export function updatePlayerSession(
  roomCode: string,
  update: Partial<PlayerSession>,
): void {
  const existing = getPlayerSession(roomCode);
  if (!existing) return;
  setPlayerSession(roomCode, { ...existing, ...update });
}

export function clearPlayerSession(roomCode: string): void {
  localStorage.removeItem(playerKey(roomCode));
  if (localStorage.getItem(LAST_ROOM_KEY) === roomCode.toUpperCase()) {
    localStorage.removeItem(LAST_ROOM_KEY);
  }
}

export function getLastRoom(): { roomCode: string; session: PlayerSession } | null {
  const roomCode = localStorage.getItem(LAST_ROOM_KEY);
  if (!roomCode) return null;
  const session = getPlayerSession(roomCode);
  return session ? { roomCode, session } : null;
}

export function getHostToken(roomCode: string): string | null {
  return localStorage.getItem(hostKey(roomCode));
}

export function setHostToken(roomCode: string, token: string): void {
  localStorage.setItem(hostKey(roomCode), token);
}

export function getHostGameLength(roomCode: string): GameLength | null {
  const value = localStorage.getItem(hostGameLengthKey(roomCode));
  return value === "short" || value === "long" ? value : null;
}

export function setHostGameLength(roomCode: string, length: GameLength): void {
  localStorage.setItem(hostGameLengthKey(roomCode), length);
}

export function getDraft(roomCode: string, articleId: string): string {
  return localStorage.getItem(draftKey(roomCode, articleId)) ?? "";
}

export function setDraft(roomCode: string, articleId: string, text: string): void {
  if (text) {
    localStorage.setItem(draftKey(roomCode, articleId), text);
  } else {
    localStorage.removeItem(draftKey(roomCode, articleId));
  }
}
