import { describe, expect, it } from "vitest";
import { ENEMY_TYPE_ORDER, encodeState } from "../../src/net/protocol";
import { createEnemy } from "../../src/systems/enemies";
import { spawnProjectile } from "../../src/systems/projectiles";
import { createWorld } from "../../src/systems/world";
import { soloSetup } from "../helpers";

describe("Zustandspaket", () => {
  it("rundet Positionen auf eine Nachkommastelle", () => {
    const state = createWorld(soloSetup());
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");
    player.position.x = 123.456789;

    const encoded = encodeState(state);

    expect(encoded.players[0]?.x).toBe(123.5);
  });

  it("schickt nur fliegende Projektile mit", () => {
    const state = createWorld(soloSetup());
    spawnProjectile(state, {
      owner: "player",
      ownerId: "p1",
      position: { x: 800, y: 600 },
      direction: { x: 1, y: 0 },
      speed: 600,
      damage: 10,
      range: 400,
      radius: 7,
      piercing: false,
    });
    const first = state.projectiles[0];
    if (!first) throw new Error("Testaufbau");
    first.active = false;

    expect(encodeState(state).projectiles).toHaveLength(0);
  });

  it("kodiert den Gegnertyp als Zahl und behaelt die Zuordnung", () => {
    const state = createWorld(soloSetup());
    state.enemies.push(createEnemy(1, "shooter", { x: 400, y: 400 }, 1, 1, false));

    const encoded = encodeState(state);
    const type = encoded.enemies[0]?.type ?? -1;

    expect(ENEMY_TYPE_ORDER[type]).toBe("shooter");
  });

  it("uebertraegt Welle, Score und Phase", () => {
    const state = createWorld(soloSetup());
    state.wave = 7;
    state.score = 1234;
    state.phase = "break";

    const encoded = encodeState(state);

    expect(encoded.wave).toBe(7);
    expect(encoded.score).toBe(1234);
    expect(encoded.phase).toBe("break");
  });
});
