/**
 * Loot: Drops, Fundorte, Aufsammeln.
 *
 * Drei Zusicherungen stehen hier im Mittelpunkt, und alle drei sind Dinge,
 * die man kaputtmacht, ohne es zu merken:
 *
 *  1. ZWEI SPIELER KOENNEN DENSELBEN GEGENSTAND NICHT BEIDE BEKOMMEN.
 *     Im Koop entscheidet der Host - gaebe es ihn zweimal, waere jede Beute
 *     doppelt so viel wert, sobald man zu zweit spielt.
 *
 *  2. BEIM ENTFERNEN AUS EINER LISTE WIRD RUECKWAERTS GELAUFEN.
 *     Dieselbe Falle wie bei der Splittergranate: Vorwaerts ruecken die
 *     folgenden Eintraege beim Entfernen eine Stelle vor, und jeder zweite
 *     bliebe liegen. Das haette sich als "manchmal hebt er nicht alles auf"
 *     gezeigt und waere schwer zu finden gewesen.
 *
 *  3. WIPE LEERT, ERFOLG BEHAELT.
 *     Die eine Regel, um die sich das ganze Genre dreht.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { LOOT } from "../../src/config/balance";
import { ITEMS } from "../../src/config/items";
import { TICK_SECONDS } from "../../src/config/constants";
import { createEnemy } from "../../src/systems/enemies";
import { dropItem, stepLoot } from "../../src/systems/loot";
import { killEnemy } from "../../src/systems/combat";
import { generateWorld } from "../../src/systems/WorldGenerator";
import { createWorld } from "../../src/systems/world";
import { finishRun, carriedItems, resetCarried } from "../../src/storage/carried";
import { soloSetup } from "../helpers";
import type { WorldState } from "../../src/systems/types";

const SEEDS = [1, 42, 4242, 20260918, 999999];

/** Stellt den Spieler an eine bestimmte Stelle. */
function place(state: WorldState, x: number, y: number, index = 0): void {
  const player = state.players[index];
  if (!player) throw new Error("Testaufbau");
  player.position.x = x;
  player.position.y = y;
}

/** Eine Welt ohne Bodenfunde aus der Karte - damit nur zaehlt, was der Test legt. */
function emptyWorld(setups = soloSetup()): WorldState {
  const state = createWorld(setups, 4242);
  state.groundItems.length = 0;
  return state;
}

describe("Fundorte aus dem Seed", () => {
  it("liegen bei gleichem Seed exakt gleich", () => {
    for (const seed of SEEDS) {
      const a = generateWorld(seed);
      const b = generateWorld(seed);
      expect(b.lootSpots).toEqual(a.lootSpots);
    }
  });

  it("liegen in Gebaeuden, nicht irgendwo", () => {
    /*
     * Das ist der Grund, warum ein Haus mehr ist als Deckung. Laege das Loot
     * daneben, koennte man es im Vorbeilaufen mitnehmen - das Hineingehen
     * waere umsonst, und mit ihm die Entscheidung, sich einzuschliessen.
     */
    for (const seed of SEEDS) {
      const world = generateWorld(seed);
      expect(world.lootSpots.length).toBeGreaterThan(0);

      for (const spot of world.lootSpots) {
        const inside = world.buildings.some(
          (house) =>
            spot.position.x > house.x &&
            spot.position.x < house.x + house.width &&
            spot.position.y > house.y &&
            spot.position.y < house.y + house.height,
        );
        expect(inside).toBe(true);
      }
    }
  });

  it("verfallen nie, anders als was ein Gegner fallen laesst", () => {
    const state = createWorld(soloSetup(), 4242);
    const fromWorld = state.groundItems.filter((item) => item.fromWorld);
    expect(fromWorld.length).toBeGreaterThan(0);

    // Weit weg vom Team, damit nichts aufgehoben wird - nur die Zeit laeuft.
    place(state, 10, 10);
    for (let i = 0; i < 200; i += 1) {
      stepLoot(state, 1);
    }

    expect(state.groundItems.filter((item) => item.fromWorld).length).toBe(fromWorld.length);
  });

  it("vergibt keine Nummer zweimal", () => {
    /*
     * Die Falle: Der Generator nummeriert die Fundorte, und `createWorld`
     * uebernimmt die Liste. Finge der Weltzustand danach wieder bei 0 an,
     * haette der erste fallende Gegenstand dieselbe Id wie ein Fundort - und
     * beim Aufheben verschwaende der falsche.
     */
    const state = createWorld(soloSetup(), 4242);
    const dropped = dropItem(state, 0, { x: 100, y: 100 });
    const ids = state.groundItems.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(dropped.id).toBeGreaterThan(
      Math.max(...state.groundItems.filter((item) => item.fromWorld).map((item) => item.id)),
    );
  });
});

describe("Drops von Gegnern", () => {
  it("laesst einen Boss immer etwas fallen", () => {
    // Ein Encounter, der nach zwei Minuten Kampf nichts hergibt, waere die
    // Enttaeuschung, die einen davon abhaelt, es noch einmal zu versuchen.
    for (const seed of SEEDS) {
      const state = emptyWorld();
      state.rngState = seed;

      const boss = createEnemy(1, "boss", { x: 5000, y: 5000 }, 1, 1, false);
      state.enemies.push(boss);
      killEnemy(state, boss);

      expect(state.groundItems.length).toBe(LOOT.bossDrops);
    }
  });

  it("gibt dem Ende-Boss mehr und besseres", () => {
    const state = emptyWorld();
    const boss = createEnemy(1, "boss", { x: 5000, y: 5000 }, 1, 1, true);
    state.enemies.push(boss);
    killEnemy(state, boss);

    expect(state.groundItems.length).toBe(LOOT.finalBossDrops);
    for (const item of state.groundItems) {
      const def = ITEMS[item.def];
      if (!def) throw new Error("unbekannter Gegenstand");
      // Nach dem Ende-Boss waere Schrott eine Beleidigung.
      expect(def.rarity).toBeGreaterThanOrEqual(3);
    }
  });

  it("laesst einen Laeufer nur manchmal etwas fallen", () => {
    /*
     * Gemessen statt behauptet: Wuerde jeder Laeufer etwas fallen lassen,
     * laege der Boden nach einer Minute voll, und Aufheben waere kein Fund
     * mehr, sondern Hausarbeit.
     */
    let drops = 0;
    const runs = 400;

    for (let i = 0; i < runs; i += 1) {
      const state = emptyWorld();
      state.rngState = i * 7919;
      const runner = createEnemy(1, "runner", { x: 5000, y: 5000 }, 1, 1, false);
      state.enemies.push(runner);
      killEnemy(state, runner);
      drops += state.groundItems.length;
    }

    const rate = drops / runs;
    console.log(`   Laeufer-Dropquote: ${(rate * 100).toFixed(1)} % (eingestellt ${LOOT.dropChance.runner! * 100} %)`);
    expect(rate).toBeGreaterThan(0.02);
    expect(rate).toBeLessThan(0.2);
  });
});

describe("Aufsammeln", () => {
  it("hebt auf, was nah genug liegt", () => {
    const state = emptyWorld();
    place(state, 5000, 5000);
    dropItem(state, 0, { x: 5020, y: 5000 });

    stepLoot(state, TICK_SECONDS);

    expect(state.groundItems.length).toBe(0);
    expect(state.players[0]?.items.length).toBe(1);
    expect(state.events.some((event) => event.type === "itemPicked")).toBe(true);
  });

  it("laesst liegen, was zu weit weg ist", () => {
    const state = emptyWorld();
    place(state, 5000, 5000);
    dropItem(state, 0, { x: 5000 + LOOT.pickupRadius + 30, y: 5000 });

    stepLoot(state, TICK_SECONDS);

    expect(state.groundItems.length).toBe(1);
    expect(state.players[0]?.items.length).toBe(0);
  });

  it("laesst niemanden aufheben, der am Boden liegt", () => {
    // Sonst koennte man Beute einsammeln, waehrend man auf Wiederbelebung
    // wartet - und das Liegen haette keinen Preis mehr.
    const state = emptyWorld();
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");
    player.down = true;
    place(state, 5000, 5000);
    dropItem(state, 0, { x: 5005, y: 5000 });

    stepLoot(state, TICK_SECONDS);

    expect(state.groundItems.length).toBe(1);
    expect(player.items.length).toBe(0);
  });

  it("hebt MEHRERE Gegenstaende im selben Tick auf", () => {
    /*
     * Die Listen-Falle, die bei der Splittergranate schon einmal beinahe
     * durchgerutscht waere: Wird beim Entfernen vorwaerts gelaufen, ruecken
     * die folgenden Eintraege eine Stelle vor, und jeder zweite bliebe liegen.
     * Drei auf einmal deckt das auf, zwei nicht zuverlaessig.
     */
    const state = emptyWorld();
    place(state, 5000, 5000);
    dropItem(state, 0, { x: 4990, y: 5000 });
    dropItem(state, 1, { x: 5000, y: 5000 });
    dropItem(state, 2, { x: 5010, y: 5000 });

    stepLoot(state, TICK_SECONDS);

    expect(state.groundItems.length).toBe(0);
    expect(state.players[0]?.items.length).toBe(3);
  });

  it("gibt einen Gegenstand nur EINEM Spieler", () => {
    /*
     * Die Kernzusicherung fuer den Koop. Beide stehen gleich weit entfernt -
     * wer ihn bekommt, ist egal, aber es darf genau einer sein.
     */
    const state = emptyWorld([
      { id: "a", name: "A", character: "scout" },
      { id: "b", name: "B", character: "tank" },
    ]);

    place(state, 4990, 5000, 0);
    place(state, 5010, 5000, 1);
    dropItem(state, 0, { x: 5000, y: 5000 });

    stepLoot(state, TICK_SECONDS);

    const total =
      (state.players[0]?.items.length ?? 0) + (state.players[1]?.items.length ?? 0);
    expect(total).toBe(1);
    expect(state.groundItems.length).toBe(0);
  });

  it("laesst einen Gegner-Drop nach einer Weile verschwinden", () => {
    const state = emptyWorld();
    place(state, 10, 10);
    dropItem(state, 0, { x: 5000, y: 5000 });

    for (let i = 0; i < LOOT.dropLifetime + 2; i += 1) {
      stepLoot(state, 1);
    }

    expect(state.groundItems.length).toBe(0);
  });
});

describe("Run-Ende", () => {
  beforeEach(() => resetCarried());

  it("verliert bei einem Team-Wipe alles", () => {
    const result = finishRun("wipe", [
      { id: 1, def: 0 },
      { id: 2, def: 1 },
    ]);

    expect(result.lost).toBe(2);
    expect(result.kept).toBe(0);
    expect(carriedItems().length).toBe(0);
  });

  it("behaelt, was extrahiert wurde", () => {
    finishRun("extracted", [{ id: 1, def: 0 }]);
    expect(carriedItems().length).toBe(1);

    finishRun("bossDefeated", [{ id: 2, def: 1 }]);
    expect(carriedItems().length).toBe(2);
  });

  it("laesst einen Wipe das Gesicherte NICHT anfassen", () => {
    // Das Lager bleibt unberuehrt - so steht es im Briefing, und es ist der
    // Grund, warum man nach einem Wipe ueberhaupt weiterspielt.
    finishRun("extracted", [{ id: 1, def: 0 }]);
    finishRun("wipe", [{ id: 2, def: 1 }]);

    expect(carriedItems().length).toBe(1);
  });
});
