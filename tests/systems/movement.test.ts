import { describe, expect, it } from "vitest";
import { CHARACTERS, PLAYER } from "../../src/config/balance";
import { TICK_SECONDS } from "../../src/config/constants";
import { normalizeInput, stepPlayerMovement } from "../../src/systems/movement";
import { createPlayer } from "../../src/systems/world";
import type { PlayerState, Rect } from "../../src/systems/types";
import { makeInput } from "../helpers";

const SPEED = CHARACTERS.scout.speed;

function makePlayer(x = 800, y = 600): PlayerState {
  return {
    ...createPlayer({ id: "test", name: "Test", character: "scout" }, 0, 1, { x, y }),
    position: { x, y },
  };
}

function run(player: PlayerState, move: { x: number; y: number }, walls: Rect[], ticks: number) {
  for (let i = 0; i < ticks; i += 1) {
    stepPlayerMovement(player, makeInput(move), walls, TICK_SECONDS);
  }
}

describe("normalizeInput", () => {
  it("laesst Teilausschlaege unveraendert (wichtig fuer den Touch-Joystick)", () => {
    expect(normalizeInput({ x: 0.5, y: 0 })).toEqual({ x: 0.5, y: 0 });
  });

  it("kuerzt diagonale Vollausschlaege auf Laenge 1", () => {
    const result = normalizeInput({ x: 1, y: 1 });
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1, 6);
  });

  it("gibt bei keiner Eingabe den Nullvektor zurueck", () => {
    expect(normalizeInput({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("stepPlayerMovement", () => {
  it("erreicht Vollgeschwindigkeit nach der eingestellten Beschleunigungszeit", () => {
    const player = makePlayer();
    const ticks = Math.ceil(PLAYER.accelerationTime / TICK_SECONDS);

    run(player, { x: 1, y: 0 }, [], ticks);

    expect(player.velocity.x).toBeCloseTo(SPEED, 6);
  });

  it("ist nach der Haelfte der Beschleunigungszeit noch nicht auf Vollgeschwindigkeit", () => {
    const player = makePlayer();

    run(player, { x: 1, y: 0 }, [], 1);

    expect(player.velocity.x).toBeGreaterThan(0);
    expect(player.velocity.x).toBeLessThan(SPEED);
  });

  it("kommt ohne Eingabe wieder zum Stillstand", () => {
    const player = makePlayer();
    run(player, { x: 1, y: 0 }, [], 30);

    run(player, { x: 0, y: 0 }, [], Math.ceil(PLAYER.accelerationTime / TICK_SECONDS) + 1);

    expect(player.velocity.x).toBe(0);
    expect(player.velocity.y).toBe(0);
  });

  it("laeuft diagonal nicht schneller als gerade", () => {
    const straight = makePlayer();
    const diagonal = makePlayer();

    run(straight, { x: 1, y: 0 }, [], 30);
    run(diagonal, { x: 1, y: 1 }, [], 30);

    const straightSpeed = Math.hypot(straight.velocity.x, straight.velocity.y);
    const diagonalSpeed = Math.hypot(diagonal.velocity.x, diagonal.velocity.y);
    expect(diagonalSpeed).toBeCloseTo(straightSpeed, 6);
  });

  it("bleibt an einer Wand stehen, statt hindurchzulaufen", () => {
    const walls: Rect[] = [{ x: 0, y: 0, width: 40, height: 1200 }];
    const player = makePlayer(200, 600);

    run(player, { x: -1, y: 0 }, walls, 120);

    expect(player.position.x).toBeCloseTo(40 + PLAYER.radius, 6);
    expect(player.velocity.x).toBe(0);
  });

  it("gleitet an einer Wand entlang, statt haengen zu bleiben", () => {
    const walls: Rect[] = [{ x: 0, y: 0, width: 40, height: 1200 }];
    const player = makePlayer(200, 600);
    const startY = player.position.y;

    // Diagonal in die Wand hinein: nach links blockiert, nach unten frei.
    run(player, { x: -1, y: 1 }, walls, 60);

    expect(player.position.x).toBeCloseTo(40 + PLAYER.radius, 6);
    expect(player.position.y).toBeGreaterThan(startY + 100);
  });
});
