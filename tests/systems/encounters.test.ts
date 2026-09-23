/**
 * Encounter und Extraktion.
 *
 * Zwei Aussagen stehen hier im Mittelpunkt, und beide sind Zusicherungen, die
 * man leicht kaputtmacht, ohne es zu merken:
 *
 *  1. EIN BOSS SCHLAEFT, BIS MAN IHN BETRITT - und er verschwindet danach nie
 *     wieder von selbst. Ginge das eine schief, wuerde man aus dem Nichts
 *     angegriffen; ginge das andere schief, liesse sich jeder Encounter durch
 *     Weglaufen erledigen, und der Ende-Boss waere gar nicht mehr zu besiegen.
 *
 *  2. EXTRAHIEREN GEHT NUR GEMEINSAM. Das ist der Kern des Koop-Versprechens:
 *     niemand wird zurueckgelassen.
 */

import { describe, expect, it } from "vitest";
import { ENCOUNTERS, WORLD } from "../../src/config/balance";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import { stepEncounters } from "../../src/systems/encounters";
import { stepRound } from "../../src/systems/spawning";
import { generateWorld } from "../../src/systems/WorldGenerator";
import { createPlayer, createWorld, stepWorld } from "../../src/systems/world";
import { makeInput, soloSetup } from "../helpers";
import type { WorldState } from "../../src/systems/types";

const SEEDS = [1, 42, 4242, 20260918, 999999];

/** Stellt den Spieler an eine bestimmte Stelle. */
function place(state: WorldState, x: number, y: number, index = 0): void {
  const player = state.players[index];
  if (!player) throw new Error("Testaufbau");
  player.position.x = x;
  player.position.y = y;
}

/** Laesst nur Encounter und Extraktion laufen - ohne Gegner, ohne Kampf. */
function tick(state: WorldState, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / TICK_SECONDS); i += 1) {
    state.events.length = 0;
    stepEncounters(state, TICK_SECONDS);
  }
}

describe("Encounter-Platzierung", () => {
  it("liegt bei gleichem Seed exakt gleich", () => {
    for (const seed of SEEDS) {
      const a = generateWorld(seed);
      const b = generateWorld(seed);
      expect(b.encounters).toEqual(a.encounters);
      expect(b.extractions).toEqual(a.extractions);
    }
  });

  it("stellt Mini-Bosse und genau einen Ende-Boss auf", () => {
    for (const seed of SEEDS) {
      const world = generateWorld(seed);
      const finals = world.encounters.filter((spot) => spot.isFinal);

      expect(finals.length).toBe(1);
      expect(world.encounters.length).toBeGreaterThan(3);
      expect(world.extractions.length).toBeGreaterThan(2);
    }
  });

  it("setzt den Ende-Boss weiter weg als jeden Mini-Boss", () => {
    for (const seed of SEEDS) {
      const world = generateWorld(seed);
      const center = world.spawnPoint;
      const radius = (spot: { position: { x: number; y: number } }) =>
        Math.hypot(spot.position.x - center.x, spot.position.y - center.y);

      const final = world.encounters.find((spot) => spot.isFinal);
      if (!final) throw new Error("kein Ende-Boss");

      const deepestMini = Math.max(
        ...world.encounters.filter((spot) => !spot.isFinal).map(radius),
      );
      expect(radius(final)).toBeGreaterThan(deepestMini);
    }
  });

  it("haelt die sichere Startzone frei von Encountern und Ausstiegen", () => {
    for (const seed of SEEDS) {
      const world = generateWorld(seed);
      const center = world.spawnPoint;

      for (const spot of [...world.encounters, ...world.extractions]) {
        const distance = Math.hypot(spot.position.x - center.x, spot.position.y - center.y);
        // Der Startpunkt ist bewusst KEIN Ausstieg - sonst waere die
        // Entscheidung "weiter oder raus" geschenkt.
        expect(distance).toBeGreaterThan(WORLD.safeRadius);
      }
    }
  });
});

describe("Encounter auslösen", () => {
  it("laesst den Boss schlafen, solange niemand nah genug ist", () => {
    const state = createWorld(soloSetup(), 4242);
    const spot = state.encounters[0];
    if (!spot) throw new Error("kein Encounter");

    place(state, spot.position.x + ENCOUNTERS.triggerRadius + 200, spot.position.y);
    tick(state, 1);

    expect(spot.status).toBe("sleeping");
    expect(state.enemies.length).toBe(0);
  });

  it("weckt genau den Boss, dessen Radius betreten wird", () => {
    const state = createWorld(soloSetup(), 4242);
    const spot = state.encounters[0];
    if (!spot) throw new Error("kein Encounter");

    place(state, spot.position.x, spot.position.y);
    tick(state, TICK_SECONDS);

    expect(spot.status).toBe("active");
    expect(state.enemies.length).toBe(1);
    expect(state.enemies[0]?.type).toBe("boss");
    // Die Staerke haengt an der Zone des Punktes, nicht an der des Teams.
    expect(state.enemies[0]?.maxHealth).toBeGreaterThan(0);
  });

  it("raeumt einen Boss nicht weg, wenn das Team weit weglaeuft", () => {
    /*
     * Die Falle: `despawnDistant` entfernt alles, was weit hinter dem Team
     * liegt. Ohne Ausnahme koennte man jeden Encounter durch Weglaufen
     * erledigen - der Punkt bliebe fuer immer "aktiv", und der Ende-Boss waere
     * nicht mehr zu besiegen.
     */
    const state = createWorld(soloSetup(), 4242);
    const spot = state.encounters[0];
    if (!spot) throw new Error("kein Encounter");

    place(state, spot.position.x, spot.position.y);
    stepEncounters(state, TICK_SECONDS);
    expect(state.enemies.length).toBe(1);

    place(state, state.bounds.width / 2, state.bounds.height / 2);
    for (let i = 0; i < TICK_RATE; i += 1) {
      stepRound(state, TICK_SECONDS);
    }

    expect(state.enemies.some((enemy) => enemy.type === "boss")).toBe(true);
  });

  it("gilt als geschafft, sobald der Boss nicht mehr da ist", () => {
    const state = createWorld(soloSetup(), 4242);
    const spot = state.encounters[0];
    if (!spot) throw new Error("kein Encounter");

    place(state, spot.position.x, spot.position.y);
    stepEncounters(state, TICK_SECONDS);
    expect(spot.status).toBe("active");

    state.enemies.length = 0;
    state.events.length = 0;
    stepEncounters(state, TICK_SECONDS);

    expect(spot.status).toBe("cleared");
    expect(state.events.some((event) => event.type === "encounterCleared")).toBe(true);
  });

  it("beendet den Run, wenn der Ende-Boss faellt", () => {
    const state = createWorld(soloSetup(), 4242);
    const final = state.encounters.find((spot) => spot.isFinal);
    if (!final) throw new Error("kein Ende-Boss");

    place(state, final.position.x, final.position.y);
    stepEncounters(state, TICK_SECONDS);
    expect(final.status).toBe("active");

    state.enemies.length = 0;
    stepEncounters(state, TICK_SECONDS);

    expect(state.phase).toBe("ended");
    expect(state.outcome).toBe("bossDefeated");
  });
});

describe("Ausstiege entdecken", () => {
  it("kennt am Anfang keinen einzigen", () => {
    const state = createWorld(soloSetup(), 4242);
    expect(state.extractions.every((zone) => !zone.discovered)).toBe(true);
  });

  it("merkt sich einen, an dem jemand nah genug vorbeikommt", () => {
    const state = createWorld(soloSetup(), 4242);
    const zone = state.extractions[0];
    if (!zone) throw new Error("keine Ausstiegszone");

    // Knapp innerhalb des Entdeckungsradius - also gesehen, aber nicht drin.
    place(state, zone.position.x + ENCOUNTERS.discoverRadius - 50, zone.position.y);
    tick(state, TICK_SECONDS);

    expect(zone.discovered).toBe(true);
    expect(state.phase).toBe("running");
  });

  it("vergisst einen entdeckten Ausstieg nicht wieder", () => {
    // Der Kompass haengt daran. Einer, der beim Weglaufen wieder vergisst,
    // waere schlimmer als gar keiner: Man liefe zurueck und faende nichts.
    const state = createWorld(soloSetup(), 4242);
    const zone = state.extractions[0];
    if (!zone) throw new Error("keine Ausstiegszone");

    place(state, zone.position.x, zone.position.y - ENCOUNTERS.discoverRadius + 50);
    tick(state, TICK_SECONDS);
    expect(zone.discovered).toBe(true);

    place(state, state.bounds.width / 2, state.bounds.height / 2);
    tick(state, 2);

    expect(zone.discovered).toBe(true);
  });

  it("entdeckt nur, was wirklich in Reichweite war", () => {
    const state = createWorld(soloSetup(), 4242);
    const zone = state.extractions[0];
    if (!zone) throw new Error("keine Ausstiegszone");

    place(state, zone.position.x + ENCOUNTERS.discoverRadius + 300, zone.position.y);
    tick(state, 1);

    expect(zone.discovered).toBe(false);
  });

  it("stellt sicher, dass jeder Seed Ausstiege hat", () => {
    /*
     * Zurueckgemeldet wurde "Extraktionspunkte sind gar nicht zu finden", und
     * der erste Verdacht war ein Fehler in der Erzeugung. Der Test haelt das
     * Gegenteil fest: Es lag an der Sichtbarkeit, nicht an den Daten.
     */
    for (const seed of SEEDS) {
      const world = generateWorld(seed);
      expect(world.extractions.length).toBe(ENCOUNTERS.extractionCount);
    }
  });
});

describe("Extraktion", () => {
  it("laeuft ab, wenn ein einzelner Spieler in der Zone bleibt", () => {
    const state = createWorld(soloSetup(), 4242);
    const zone = state.extractions[0];
    if (!zone) throw new Error("keine Ausstiegszone");

    place(state, zone.position.x, zone.position.y);
    tick(state, ENCOUNTERS.extractionSeconds + 0.2);

    expect(state.phase).toBe("ended");
    expect(state.outcome).toBe("extracted");
  });

  it("faengt von vorn an, wenn jemand die Zone verlaesst", () => {
    const state = createWorld(soloSetup(), 4242);
    const zone = state.extractions[0];
    if (!zone) throw new Error("keine Ausstiegszone");

    place(state, zone.position.x, zone.position.y);
    tick(state, ENCOUNTERS.extractionSeconds - 1);
    expect(state.extractionProgress).toBeGreaterThan(0);

    // Kurz heraus - und wieder hinein.
    place(state, zone.position.x + zone.radius + 200, zone.position.y);
    tick(state, TICK_SECONDS);
    expect(state.extractionProgress).toBe(0);

    place(state, zone.position.x, zone.position.y);
    tick(state, 1);

    // Wieder von vorn, also noch lange nicht fertig.
    expect(state.phase).toBe("running");
  });

  it("wartet im Koop auf ALLE - auch auf die am Boden liegenden", () => {
    /*
     * Das ist die Entscheidung hinter "niemand wird zurueckgelassen". Waere
     * die Regel "alle LEBENDEN", koennte man einen Gefallenen einfach liegen
     * lassen und gehen.
     */
    const state = createWorld(
      [
        { id: "a", name: "A", character: "scout" },
        { id: "b", name: "B", character: "tank" },
      ],
      4242,
    );
    const zone = state.extractions[0];
    if (!zone) throw new Error("keine Ausstiegszone");

    const second = state.players[1];
    if (!second) throw new Error("Testaufbau");
    second.down = true;

    // Einer drin, der Gefallene weit weg.
    place(state, zone.position.x, zone.position.y, 0);
    place(state, zone.position.x + 3000, zone.position.y, 1);
    tick(state, ENCOUNTERS.extractionSeconds + 1);
    expect(state.phase).toBe("running");

    // Aufgehoben und mitgenommen (hier: hingestellt) - jetzt geht es.
    place(state, zone.position.x + 40, zone.position.y, 1);
    tick(state, ENCOUNTERS.extractionSeconds + 0.2);

    expect(state.phase).toBe("ended");
    expect(state.outcome).toBe("extracted");
  });
});

describe("Rundenende", () => {
  it("meldet einen Team-Wipe als solchen", () => {
    const state = createWorld(soloSetup(), 4242);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    player.down = true;
    stepRound(state, TICK_SECONDS);

    expect(state.phase).toBe("ended");
    expect(state.outcome).toBe("wipe");
    expect(state.events.some((event) => event.type === "runEnded")).toBe(true);
  });

  it("laesst einen beendeten Run beendet", () => {
    // Zweimal enden waere ein zweiter Ergebnisbildschirm - und der erste
    // Ausgang ist der, der zaehlt.
    const state = createWorld(soloSetup(), 4242);
    const zone = state.extractions[0];
    if (!zone) throw new Error("keine Ausstiegszone");

    place(state, zone.position.x, zone.position.y);
    tick(state, ENCOUNTERS.extractionSeconds + 0.2);
    expect(state.outcome).toBe("extracted");

    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");
    player.down = true;
    stepWorld(state, new Map([[player.id, makeInput({ x: 0, y: 0 })]]), TICK_SECONDS);

    expect(state.outcome).toBe("extracted");
  });
});

describe("Aufbau", () => {
  it("gibt jedem neuen Spieler einen vollstaendigen Zustand", () => {
    // Stellvertretend dafuer, dass ein neues Feld nicht vergessen wurde:
    // `createPlayer` muss alles setzen, was `PlayerState` verlangt.
    const player = createPlayer({ id: "x", name: "X", character: "sniper" }, 0, 1, {
      x: 100,
      y: 100,
    });
    expect(player.position).toEqual({ x: 100, y: 100 });
  });
});
