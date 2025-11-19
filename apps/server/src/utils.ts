import { nanoid } from 'nanoid';
import { ROOM_CODE_LENGTH } from '@nofus/shared';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars (0, O, I, 1)

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function generateToken(): string {
  return nanoid(32);
}

export function generatePlayerId(): string {
  return nanoid(12);
}
