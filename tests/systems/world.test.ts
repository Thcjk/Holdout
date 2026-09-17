import { describe, expect, it } from "vitest";
import { TICK_SECONDS } from "../../src/config/constants";
import { createWorld, isInBush, stepWorld } from "../../src/systems/world";
import { makeInput, soloSetup } from "../helpers";

function step(world: ReturnType<typeof createWorld>, input = makeInput({ x: 0, y: 0 })) {
  stepWorld(world, new Map([["p1", input]]), TICK_SECONDS);
}

describe("Blickrichtung", () => {
  it("zeigt in Laufrichtung, solange nicht gezielt wird", () => {
    const world = createWorld(soloSetup());

    step(world, makeInput({ x: 1, y: 0 }));

    expect(world.players[0]?.facing.x).toBeCloseTo(1, 6);
    expect(world.players[0]?.facing.y).toBeCloseTo(0, 6);
  });

  it("folgt dem Ziel, auch wenn in eine andere Richtung gelaufen wird", () => {
    const world = createWorld(soloSetup());

    step(world, makeInput({ x: 1, y: 0 }, { aim: { x: 0, y: -1 } }));

    expect(world.players[0]?.facing.y).toBeCloseTo(-1, 6);
  });

  it("behaelt die letzte Richtung, wenn die Figur steht", () => {
    const world = createWorld(soloSetup());
    step(world, makeInput({ x: -1, y: 0 }));

    step(world, makeInput({ x: 0, y: 0 }));

    expect(world.players[0]?.facing.x).toBeCloseTo(-1, 6);
  });
});

describe("Buesche", () => {
  it("erkennt einen Punkt innerhalb eines Buschfelds", () => {
    const world = createWorld(soloSetup());
    const bush = world.bushes[0];
    expect(bush).toBeDefined();

    const middle = {
      x: (bush?.x ?? 0) + (bush?.width ?? 0) / 2,
      y: (bush?.y ?? 0) + (bush?.height ?? 0) / 2,
    };

    expect(isInBush(world, middle)).toBe(true);
    expect(isInBush(world, { x: 60, y: 60 })).toBe(false);
  });

  it("merkt am Spieler, ob er im Busch steht", () => {
    const world = createWorld(soloSetup());
    const bush = world.bushes[0];
    const player = world.players[0];
    expect(bush).toBeDefined();
    expect(player).toBeDefined();

    if (player && bush) {
      player.position.x = bush.x + bush.width / 2;
      player.position.y = bush.y + bush.height / 2;
    }
    step(world);

    expect(world.players[0]?.inBush).toBe(true);
  });
});
