import { describe, expect, it } from "vitest";
import { SUPERS } from "../../src/config/balance";
import { TICK_SECONDS } from "../../src/config/constants";
import { createEnemy } from "../../src/systems/enemies";
import { stepProjectiles } from "../../src/systems/projectiles";
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

describe("Sniper: Aufklaerungsschuss (Etappe 10)", () => {
  function fire(targetDistance: number, others: { x: number; y: number }[]) {
    const { state, player } = world("sniper");
    player.superCharge = 100;
    const target = createEnemy(
      1,
      "brute",
      { x: player.position.x + targetDistance, y: player.position.y },
      1,
      1,
      false,
    );
    state.enemies.push(target);
    const extra = others.map((offset, index) =>
      createEnemy(
        2 + index,
        "runner",
        { x: target.position.x + offset.x, y: target.position.y + offset.y },
        1,
        1,
        false,
      ),
    );
    state.enemies.push(...extra);

    trySuper(state, player, superInput);
    for (let i = 0; i < Math.round(2 / TICK_SECONDS); i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }
    return { state, target, extra };
  }

  it("deckt beim Einschlag alle Gegner im Umkreis auf", () => {
    const radius = SUPERS.sniper.revealRadius;
    const { target, extra } = fire(400, [
      { x: 0, y: radius - 60 },
      { x: 0, y: radius + 120 },
    ]);
    const [inside, outside] = extra;

    expect(target.marked).toBeGreaterThan(SUPERS.sniper.revealDuration - 2);
    expect(inside?.marked).toBeGreaterThan(0);
    expect(outside?.marked).toBe(0);
  });

  it("wirkt auch, wenn das Geschoss ins Leere fliegt", () => {
    // Sonst waere ein knapp verfehlter Schuss wertlos, obwohl Gegner neben
    // dem Endpunkt stehen - dieselbe Regel wie bei der Granate.
    const { state, player } = world("sniper");
    player.superCharge = 100;
    const end = { x: player.position.x + SUPERS.sniper.range, y: player.position.y };
    const bystander = createEnemy(1, "runner", { x: end.x, y: end.y + 200 }, 1, 1, false);
    state.enemies.push(bystander);

    trySuper(state, player, superInput);
    for (let i = 0; i < Math.round(2 / TICK_SECONDS); i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }

    expect(bystander.marked).toBeGreaterThan(0);
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
