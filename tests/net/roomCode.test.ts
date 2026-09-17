import { describe, expect, it } from "vitest";
import {
  createRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  peerIdForRoom,
} from "../../src/net/roomCode";

describe("Raumcode", () => {
  it("ist sechs Zeichen lang und gueltig", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = createRoomCode();
      expect(code).toHaveLength(6);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it("enthaelt keine verwechselbaren Zeichen", () => {
    const forbidden = ["0", "O", "1", "I", "L", "2", "Z", "5", "S", "8", "B"];
    for (let i = 0; i < 200; i += 1) {
      const code = createRoomCode();
      for (const character of forbidden) {
        expect(code).not.toContain(character);
      }
    }
  });

  it("raeumt getippte Eingaben auf", () => {
    expect(normalizeRoomCode(" a3-c9 f7 ")).toBe("A3C9F7");
    expect(normalizeRoomCode("abcdefghij")).toHaveLength(6);
  });

  it("weist unvollstaendige oder unmoegliche Codes ab", () => {
    expect(isValidRoomCode("A3C9F")).toBe(false);
    expect(isValidRoomCode("A3C9F0")).toBe(false);
  });

  it("baut aus dem Code eine eindeutige Peer-ID", () => {
    expect(peerIdForRoom("A3C9F7")).toContain("A3C9F7");
  });
});
