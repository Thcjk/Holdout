import { describe, expect, it } from "vitest";
import { SUPERS } from "../../src/config/balance";
import { TICK_SECONDS } from "../../src/config/constants";
import { createEnemy } from "../../src/systems/enemies";
import { stepDashDamage, trySuper } from "../../src/systems/supers";
import { createWorld } from "../../src/systems/world";
import { makeInput } from "../helpers";
import type { CharacterId } from "../../src/systems/types";

function world(character: CharacterId) {
  const state = createWorld([{ id: "p1", name: "Test", character }]);
  state.enemies.length = 0;
  const player = state.players[0];
  if (!player) throw new Error("Testaufbau");
  return { state, player };
}

const superInput = makeInput({ x: 0, y: 0 }, { aim: { x: 1, y: 0 }, useSuper: true });

describe("Super allgemein", () => {
  it("laesst sich ohne volle Aufladung nicht ausloesen", () => {
    const { state, player } = world("tank");
    player.superCharge = 99;

    expect(trySuper(state, player, superInput)).toBe(false);
  });

  it("verbraucht die ganze Ladung und meldet das Ereignis", () => {
    const { state, player } = world("tank");
    player.superCharge = 100;

    expect(trySuper(state, player, superInput)).toBe(true);
    expect(player.superCharge).toBe(0);
    expect(state.events.some((event) => event.type === "superUsed")).toBe(true);
  });

  it("bleibt am Boden wirkungslos", () => {
    const { state, player } = world("tank");
    player.superCharge = 100;
    player.down = true;

    expect(trySuper(state, player, superInput)).toBe(false);
  });
});

describe("Tank: Bodenstampfer", () => {
  it("trifft und betaeubt Gegner im Radius", () => {
    const { state, player } = world("tank");
    player.superCharge = 100;
    const near = createEnemy(
      1,
      "runner",
      { x: player.position.x + 100, y: player.position.y },
      1,
      1,
      false,
    );
    const far = createEnemy(
      2,
      "runner",
      { x: player.position.x + 400, y: player.position.y },
      1,
      1,
      false,
    );
    near.health = 5000;
    near.maxHealth = 5000;
    state.enemies.push(near, far);

    trySuper(state, player, superInput);

    expect(near.health).toBe(5000 - SUPERS.tank.damage);
    expect(near.stunned).toBeCloseTo(SUPERS.tank.stunDuration, 6);
    expect(far.health).toBe(far.maxHealth);
  });
});

describe("Sniper: Zielscheinwerfer", () => {
  it("markiert einen Gegner in Zielrichtung", () => {
    const { state, player } = world("sniper");
    player.superCharge = 100;
    const target = createEnemy(
      1,
      "runner",
      { x: player.position.x + 300, y: player.position.y },
      1,
      1,
      false,
    );
    state.enemies.push(target);

    trySuper(state, player, superInput);

    expect(target.marked).toBeCloseTo(SUPERS.sniper.duration, 6);
  });
});

describe("Scout: Dash", () => {
  it("startet den Dash in Zielrichtung", () => {
    const { state, player } = world("scout");
    player.superCharge = 100;

    trySuper(state, player, superInput);

    expect(player.dashTime).toBeCloseTo(SUPERS.scout.duration, 6);
    expect(player.dashDirection.x).toBeCloseTo(1, 6);
  });

  it("trifft jeden gestreiften Gegner genau einmal", () => {
    const { state, player } = world("scout");
    player.superCharge = 100;
    const enemy = createEnemy(
      1,
      "runner",
      { x: player.position.x + 20, y: player.position.y },
      1,
      1,
      false,
    );
    enemy.health = 5000;
    enemy.maxHealth = 5000;
    state.enemies.push(enemy);

    trySuper(state, player, superInput);
    stepDashDamage(state, player);
    stepDashDamage(state, player);
    player.dashTime -= TICK_SECONDS;
    stepDashDamage(state, player);

    expect(enemy.health).toBe(5000 - SUPERS.scout.damage);
  });
});
