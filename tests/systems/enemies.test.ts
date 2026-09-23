import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../src/config/balance";
import { TICK_SECONDS } from "../../src/config/constants";
import { hasLineOfSight } from "../../src/systems/collision";
import { createEnemy, stepEnemies } from "../../src/systems/enemies";
import { createWorld } from "../../src/systems/world";
import { soloSetup } from "../helpers";
import type { Rect } from "../../src/systems/types";

function world() {
  const state = createWorld(soloSetup());
  state.enemies.length = 0;
  return state;
}

describe("Laeufer", () => {
  it("laeuft auf den Spieler zu", () => {
    const state = world();
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");
    const enemy = createEnemy(
      1,
      "runner",
      { x: player.position.x + 400, y: player.position.y },
      1,
      1,
      false,
    );
    state.enemies.push(enemy);

    const before = enemy.position.x;
    for (let i = 0; i < 30; i += 1) {
      stepEnemies(state, TICK_SECONDS);
    }

    expect(enemy.position.x).toBeLessThan(before - 100);
  });

  it("sieht einen Spieler im Busch nicht und bleibt stehen", () => {
    const state = world();
    const player = state.players[0];
    const bush = state.bushes[0];
    if (!player || !bush) throw new Error("Testaufbau");

    player.position = { x: bush.x + bush.width / 2, y: bush.y + bush.height / 2 };
    player.inBush = true;
    player.down = true; // kein anderer Spieler als Rueckfallziel

    // Freie Stelle: der Deckungsblock oben reicht nur bis y 220.
    const enemy = createEnemy(1, "runner", { x: 800, y: 320 }, 1, 1, false);
    state.enemies.push(enemy);

    const before = { ...enemy.position };
    for (let i = 0; i < 30; i += 1) {
      stepEnemies(state, TICK_SECONDS);
    }

    expect(Math.hypot(enemy.position.x - before.x, enemy.position.y - before.y)).toBeLessThan(1);
  });

  it("macht bei Beruehrung Schaden, aber nicht in jedem Tick", () => {
    const state = world();
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    const enemy = createEnemy(
      1,
      "runner",
      { x: player.position.x + 10, y: player.position.y },
      1,
      1,
      false,
    );
    state.enemies.push(enemy);

    stepEnemies(state, TICK_SECONDS);
    const afterFirst = player.health;
    stepEnemies(state, TICK_SECONDS);

    expect(afterFirst).toBe(player.maxHealth - ENEMIES.runner.contactDamage);
    expect(player.health).toBe(afterFirst);
  });

  it("bleibt betaeubt stehen", () => {
    const state = world();
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");
    const enemy = createEnemy(
      1,
      "runner",
      { x: player.position.x + 400, y: player.position.y },
      1,
      1,
      false,
    );
    enemy.stunned = 1;
    state.enemies.push(enemy);

    const before = enemy.position.x;
    for (let i = 0; i < 10; i += 1) {
      stepEnemies(state, TICK_SECONDS);
    }

    expect(enemy.position.x).toBeCloseTo(before, 3);
  });
});

describe("Sichtlinie", () => {
  /*
   * Eigene Waende statt der Karte.
   *
   * Hier stand frueher "quer durch den linken Deckungsblock bei x 220..280" -
   * eine feste Stelle der alten Arena. Seit Phase 8 wird die Karte generiert,
   * und dort steht an dieser Stelle nichts mehr; der Test fiel durch, obwohl an
   * der Sichtlinie nichts kaputt war. Geprueft werden soll die Rechnung, nicht
   * ein Kartenlayout - also bringt der Test seine Wand selbst mit.
   */
  const wall: Rect = { x: 220, y: 500, width: 60, height: 200 };

  it("erkennt eine Wand zwischen zwei Punkten", () => {
    expect(hasLineOfSight([wall], { x: 150, y: 600 }, { x: 400, y: 600 })).toBe(false);
  });

  it("meldet freie Sicht, wo nichts im Weg steht", () => {
    expect(hasLineOfSight([wall], { x: 760, y: 600 }, { x: 860, y: 600 })).toBe(true);
  });
});

describe("Schuetze", () => {
  it("haelt Abstand und schiesst auf den Spieler", () => {
    const state = world();
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    const enemy = createEnemy(
      1,
      "shooter",
      { x: player.position.x + ENEMIES.shooter.preferredRange, y: player.position.y },
      1,
      1,
      false,
    );
    state.enemies.push(enemy);

    stepEnemies(state, TICK_SECONDS);

    expect(state.projectiles.some((entry) => entry.active && entry.owner === "enemy")).toBe(true);
  });
});
