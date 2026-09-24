/**
 * Das Spawning nach Distanz - Nachfolger von `waves.test.ts`.
 *
 * Geprueft wird die eine Aussage, auf der der ganze Umbau steht: WEITER DRAUSSEN
 * IST ES GEFAEHRLICHER. Mehr Gegner, staerkere Gegner. Stimmt das nicht, ist die
 * Entscheidung "aussteigen oder weiter" keine Entscheidung mehr, sondern
 * Geschmackssache.
 */

import { describe, expect, it } from "vitest";
import { DIFFICULTY, LIMITS, WORLD } from "../../src/config/balance";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import { stepRound } from "../../src/systems/spawning";
import {
  distanceFromStart,
  targetPopulation,
  zoneAt,
  zoneScaling,
} from "../../src/systems/zones";
import { createWorld, stepWorld } from "../../src/systems/world";
import { makeInput, soloSetup } from "../helpers";
import type { WorldState } from "../../src/systems/types";

/** Setzt den Spieler auf eine bestimmte Entfernung vom Start, nach rechts. */
function placeAt(state: WorldState, distance: number): void {
  const player = state.players[0];
  if (!player) throw new Error("Testaufbau");
  player.position.x = state.bounds.width / 2 + distance;
  player.position.y = state.bounds.height / 2;
}

/**
 * Laesst die Welt ohne Eingaben weiterlaufen.
 *
 * Der Spieler wird dabei am Leben gehalten. Ohne das ging der Testaufbau
 * schief, und zwar auf eine Art, die man leicht uebersieht: Ein stillstehender
 * Spieler geht in zwanzig Sekunden zu Boden, der Run endet - und `stepRound`
 * steigt danach sofort aus, raeumt also auch nicht mehr auf. Der Test mass dann
 * nicht das Aufraeumen, sondern das Rundenende.
 */
function idle(state: WorldState, seconds: number): void {
  const inputs = new Map([[state.players[0]?.id ?? "p1", makeInput({ x: 0, y: 0 })]]);
  for (let i = 0; i < TICK_RATE * seconds; i += 1) {
    const player = state.players[0];
    if (player) {
      player.health = player.maxHealth;
    }
    stepWorld(state, inputs, TICK_SECONDS);
  }
}

describe("Distanzzonen", () => {
  it("rechnet Entfernung in Zonen um", () => {
    expect(zoneAt(0)).toBe(0);
    expect(zoneAt(DIFFICULTY.zoneSize - 1)).toBe(0);
    expect(zoneAt(DIFFICULTY.zoneSize)).toBe(1);
    expect(zoneAt(DIFFICULTY.zoneSize * 3.5)).toBe(3);
  });

  it("misst die Entfernung vom Startpunkt, nicht von der Kartenecke", () => {
    const state = createWorld(soloSetup(), 1);
    placeAt(state, 1500);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    expect(distanceFromStart(state, player.position)).toBeCloseTo(1500, 0);
  });
});

describe("Schwierigkeit nach Distanz", () => {
  it("stellt weiter draussen mehr Gegner auf", () => {
    const nah = targetPopulation(0, 1);
    const mittel = targetPopulation(5, 1);
    const weit = targetPopulation(10, 1);

    expect(mittel).toBeGreaterThan(nah);
    expect(weit).toBeGreaterThan(mittel);
  });

  it("macht Gegner weiter draussen staerker", () => {
    expect(zoneScaling(5).health).toBeGreaterThan(zoneScaling(0).health);
    expect(zoneScaling(10).damage).toBeGreaterThan(zoneScaling(5).damage);
    // Zone 0 ist der Grundwert, nicht etwas Abgeschwaechtes.
    expect(zoneScaling(0).health).toBe(1);
    expect(zoneScaling(0).damage).toBe(1);
  });

  it("bleibt auch tief draussen unter der Gegner-Obergrenze", () => {
    // Die Grenze aus dem Briefing (Abschnitt 7) ist eine Zusage an die
    // Handy-Leistung. Eine Formel, die sie irgendwann reisst, waere ein
    // Zeitzuender - deshalb wird das hier bis weit jenseits des Spielbaren
    // geprueft.
    expect(targetPopulation(100, 4)).toBeLessThanOrEqual(LIMITS.maxEnemies);
  });

  it("gibt vier Spielern mehr Gegner als einem, aber nicht das Vierfache", () => {
    const allein = targetPopulation(3, 1);
    const zuViert = targetPopulation(3, 4);

    expect(zuViert).toBeGreaterThan(allein);
    expect(zuViert).toBeLessThan(allein * 4);
  });
});

describe("Gegner erscheinen rund um die Spieler", () => {
  it("stellt niemanden mitten in eine Wand", () => {
    const state = createWorld(soloSetup(), 777);
    placeAt(state, 3000);
    idle(state, 30);

    expect(state.enemies.length).toBeGreaterThan(0);

    for (const enemy of state.enemies) {
      for (const wall of state.walls) {
        const inside =
          enemy.position.x > wall.x &&
          enemy.position.x < wall.x + wall.width &&
          enemy.position.y > wall.y &&
          enemy.position.y < wall.y + wall.height;
        expect(inside).toBe(false);
      }
    }
  });

  it("laesst Gegner zurueck, die weit hinter dem Team liegen", () => {
    const state = createWorld(soloSetup(), 4242);
    placeAt(state, 3000);
    idle(state, 20);

    const before = state.enemies.length;
    expect(before).toBeGreaterThan(0);

    // Der Spieler verschwindet auf die andere Seite der Karte. Ohne Aufraeumen
    // bliebe die alte Meute fuer immer bestehen und wuerde die Obergrenze
    // belegen - vorne erschiene dann nichts mehr.
    placeAt(state, -3000);
    stepRound(state, TICK_SECONDS);

    expect(state.enemies.length).toBe(0);
  });
});

describe("Fortschritt", () => {
  it("meldet jede neu erreichte Zone einzeln - auch wenn mehrere auf einmal kommen", () => {
    /*
     * Frueher hing hier ein Skillpunkt je Zone dran. Das System ist entfernt
     * (Etappe 1), die Zusicherung darunter bleibt wichtig: Ein Dash ueber eine
     * Zonengrenze darf keinen Fortschritt verschlucken.
     */
    const state = createWorld(soloSetup(), 5);
    state.events.length = 0;

    placeAt(state, DIFFICULTY.zoneSize * 3 + 10);
    stepRound(state, TICK_SECONDS);

    expect(state.deepestZone).toBe(3);
    expect(state.events.filter((event) => event.type === "zoneReached").length).toBe(3);
  });

  it("meldet dieselbe Zone nicht zweimal", () => {
    const state = createWorld(soloSetup(), 6);

    placeAt(state, DIFFICULTY.zoneSize * 2 + 10);
    stepRound(state, TICK_SECONDS);
    state.events.length = 0;

    // Zurueck in die sichere Zone und wieder hinaus - das ist kein neuer
    // Fortschritt, sondern derselbe Weg.
    placeAt(state, 0);
    stepRound(state, TICK_SECONDS);
    placeAt(state, DIFFICULTY.zoneSize * 2 + 10);
    stepRound(state, TICK_SECONDS);

    expect(state.events.filter((event) => event.type === "zoneReached").length).toBe(0);
  });

  it("heilt in der sicheren Zone und sonst nicht", () => {
    const state = createWorld(soloSetup(), 7);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    player.health = 100;

    // Weit draussen passiert nichts.
    placeAt(state, WORLD.safeRadius + 500);
    for (let i = 0; i < TICK_RATE; i += 1) {
      stepRound(state, TICK_SECONDS);
    }
    expect(player.health).toBe(100);

    // Am Start kommt Leben zurueck.
    placeAt(state, 0);
    for (let i = 0; i < TICK_RATE; i += 1) {
      stepRound(state, TICK_SECONDS);
    }
    expect(player.health).toBeGreaterThan(100);
  });
});

describe("Sichere Startzone", () => {
  it("laesst dort nie einen Gegner erscheinen", () => {
    /*
     * Bis zur Ueberarbeitung fehlte diese Pruefung ganz. Ein Spieler am
     * Rand der Startzone bekam Gegner auf einem Ring von 700 bis 1200 Pixeln
     * um sich herum - und ein Teil dieses Rings liegt mitten in der Zone.
     *
     * Hier steht der Spieler genau auf der Grenze, der ungueenstigste Fall,
     * und es wird ueber viele Ticks gesammelt.
     */
    const state = createWorld(soloSetup(), 11);
    placeAt(state, WORLD.safeRadius + 10);

    const center = { x: state.bounds.width / 2, y: state.bounds.height / 2 };
    let spawned = 0;

    for (let i = 0; i < TICK_RATE * 60; i += 1) {
      state.events.length = 0;
      stepRound(state, TICK_SECONDS);
      for (const order of state.pendingSpawns) {
        const distance = Math.hypot(order.position.x - center.x, order.position.y - center.y);
        expect(distance).toBeGreaterThan(WORLD.safeRadius);
      }
      spawned += state.events.filter((event) => event.type === "spawnWarning").length;
    }

    // Gegenprobe: Es muss ueberhaupt etwas erschienen sein, sonst bestuende
    // der Test auch dann, wenn gar nichts mehr spawnt.
    expect(spawned).toBeGreaterThan(3);
  });
});
