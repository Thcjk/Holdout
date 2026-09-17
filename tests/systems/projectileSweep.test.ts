/**
 * Trefferpruefung ueber die ganze Flugstrecke.
 *
 * Ein Projektil springt pro Tick 20 Pixel weit (600 Pixel/s bei 30 Ticks/s).
 * Wird nur der Endpunkt geprueft, rutschen Treffer am Rand des Gegners durch -
 * der Schuss sass, gezaehlt wurde er nicht. Diese Tests halten fest, dass die
 * ganze Strecke geprueft wird.
 */

import { describe, expect, it } from "vitest";
import { TICK_SECONDS } from "../../src/config/constants";
import { createEnemy } from "../../src/systems/enemies";
import { spawnProjectile, stepProjectiles } from "../../src/systems/projectiles";
import { createWorld } from "../../src/systems/world";
import { soloSetup } from "../helpers";

function emptyWorld() {
  const state = createWorld(soloSetup());
  state.enemies.length = 0;
  state.walls.length = 0;
  state.players.length = 0;
  return state;
}

function shootRightFrom(state: ReturnType<typeof emptyWorld>, x: number, y: number) {
  spawnProjectile(state, {
    owner: "player",
    ownerId: "local",
    position: { x, y },
    direction: { x: 1, y: 0 },
    speed: 600,
    damage: 100,
    range: 900,
    radius: 7,
    piercing: false,
  });
}

/** 3000 Pixel/s sind 100 Pixel je Tick - eine Strecke, auf der viel liegen kann. */
function shootFastRightFrom(state: ReturnType<typeof emptyWorld>, x: number, y: number) {
  spawnProjectile(state, {
    owner: "player",
    ownerId: "local",
    position: { x, y },
    direction: { x: 1, y: 0 },
    speed: 3000,
    damage: 100,
    range: 900,
    radius: 7,
    piercing: false,
  });
}

describe("Treffer auf der Flugstrecke", () => {
  it("trifft einen Gegner, der genau zwischen zwei Schritten liegt", () => {
    const state = emptyWorld();
    const enemy = createEnemy(1, "runner", { x: 90, y: 22 }, 1, 1, false);
    state.enemies.push(enemy);
    const before = enemy.health;

    // Start (80,0) und Ende (100,0) liegen beide 24,2 Pixel vom Gegner entfernt -
    // also ausserhalb der 23 Pixel Trefferradius. Die Strecke dazwischen kommt
    // ihm auf 22 Pixel nahe. Wer nur Punkte prueft, sieht hier keinen Treffer.
    shootRightFrom(state, 80, 0);
    stepProjectiles(state, TICK_SECONDS);

    expect(enemy.health).toBeLessThan(before);
  });

  it("laesst einen echten Fehlschuss weiterhin daneben gehen", () => {
    const state = emptyWorld();
    const enemy = createEnemy(1, "runner", { x: 90, y: 40 }, 1, 1, false);
    state.enemies.push(enemy);
    const before = enemy.health;

    shootRightFrom(state, 80, 0);
    stepProjectiles(state, TICK_SECONDS);

    expect(enemy.health).toBe(before);
  });

  it("trifft den vorderen von zwei Gegnern auf derselben Strecke", () => {
    const state = emptyWorld();
    // Absichtlich in der falschen Reihenfolge eingetragen: Der hintere steht
    // zuerst in der Liste. Beide liegen auf der Strecke eines einzigen Ticks.
    const back = createEnemy(1, "runner", { x: 100, y: 0 }, 1, 1, false);
    const front = createEnemy(2, "runner", { x: 60, y: 0 }, 1, 1, false);
    state.enemies.push(back, front);

    shootFastRightFrom(state, 0, 0);
    stepProjectiles(state, TICK_SECONDS);

    expect(front.health).toBeLessThan(front.maxHealth);
    expect(back.health).toBe(back.maxHealth);
  });

  it("stoppt an einer Wand, statt durch sie hindurch zu treffen", () => {
    const state = emptyWorld();
    state.walls.push({ x: 40, y: -60, width: 10, height: 120 });
    const enemy = createEnemy(1, "runner", { x: 90, y: 0 }, 1, 1, false);
    state.enemies.push(enemy);

    // Wand und Gegner liegen beide auf der Strecke dieses einen Ticks - die
    // Wand kommt zuerst.
    shootFastRightFrom(state, 0, 0);
    stepProjectiles(state, TICK_SECONDS);

    expect(enemy.health).toBe(enemy.maxHealth);
  });

  it("trifft auch bei sehr hoher Geschwindigkeit", () => {
    const state = emptyWorld();
    const enemy = createEnemy(1, "runner", { x: 300, y: 0 }, 1, 1, false);
    state.enemies.push(enemy);

    // 100 Pixel je Tick - mehr als der Gegner breit ist.
    shootFastRightFrom(state, 250, 0);
    stepProjectiles(state, TICK_SECONDS);

    expect(enemy.health).toBeLessThan(enemy.maxHealth);
  });
});
