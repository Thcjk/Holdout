/**
 * Raumcodes, die man am Telefon vorlesen kann.
 *
 * Aus dem Alphabet fehlen absichtlich alle Zeichen, die sich leicht verwechseln
 * lassen: 0/O, 1/I/L, 2/Z, 5/S, 8/B. Ein Raumcode wird abgetippt, oft von einem
 * Handybildschirm abgelesen - jede Verwechslung kostet einen Versuch.
 */

const ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
export const ROOM_CODE_LENGTH = 6;

/** Praefix der Peer-ID, damit sich Raeume dieses Spiels nicht mit anderen beissen. */
const PEER_PREFIX = "koop-arena-";

export function createRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return code;
}

/** Vereinheitlicht Eingaben: Kleinbuchstaben, Leerzeichen und Bindestriche. */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) {
    return false;
  }
  return [...code].every((character) => ALPHABET.includes(character));
}

export function peerIdForRoom(code: string): string {
  return `${PEER_PREFIX}${code}`;
}
