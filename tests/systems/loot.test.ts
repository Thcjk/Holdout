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
import { ITEMS, itemIndex } from "../../src/config/items";
import { TICK_SECONDS } from "../../src/config/constants";
import { createEnemy } from "../../src/systems/enemies";
import { dropItem, stepLoot } from "../../src/systems/loot";
import { findFreeSpot, place, removeAt } from "../../src/systems/InventoryGridSystem";
import { killEnemy } from "../../src/systems/combat";
import { generateWorld } from "../../src/systems/WorldGenerator";
import { createWorld, stepWorld } from "../../src/systems/world";
import type { PlayerSetup } from "../../src/systems/world";
import {
  backpackForNextRun,
  finishRun,
  resetCarried,
  saveStash,
  stashItems,
} from "../../src/storage/carried";
import { makeInput, soloSetup } from "../helpers";
import type { PlacedItem, WorldState } from "../../src/systems/types";

const SEEDS = [1, 42, 4242, 20260918, 999999];

/** Stellt den Spieler an eine bestimmte Stelle. */
function place_player(state: WorldState, x: number, y: number, index = 0): void {
  const player = state.players[index];
  if (!player) throw new Error("Testaufbau");
  player.position.x = x;
  player.position.y = y;
}

/** Stellt den Spieler hin und legt einen Gegenstand direkt vor seine Fuesse. */
function place_ground(state: WorldState, x: number, y: number): void {
  place_player(state, x, y);
  dropItem(state, itemIndex("scrap"), { x: x + 10, y });
}

/**
 * Ein Spieler mit LEEREM Rucksack. `soloSetup()` bringt seit der
 * Waffen-Ausruestung eine Pistole mit - hier wird aber gezaehlt, was
 * hineinkommt.
 */
function bareSetup(): PlayerSetup[] {
  return [{ id: "p1", name: "Test", character: "scout" }];
}

/** Eine Welt ohne Bodenfunde aus der Karte - damit nur zaehlt, was der Test legt. */
function emptyWorld(setups = bareSetup()): WorldState {
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
    place_player(state, 10, 10);
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
      expect(def.rarity).toBeGreaterThanOrEqual(LOOT.finalBossMinRarity);
    }
  });

  it("gibt auch dem Mini-Boss garantiert keine unterste Stufe", () => {
    for (const seed of SEEDS) {
      const state = emptyWorld();
      state.rngState = seed;
      const boss = createEnemy(1, "boss", { x: 5000, y: 5000 }, 1, 1, false);
      state.enemies.push(boss);
      killEnemy(state, boss);
      for (const item of state.groundItems) {
        expect(ITEMS[item.def]?.rarity).toBeGreaterThanOrEqual(LOOT.bossMinRarity);
      }
    }
  });

  it("trifft die Dropquoten aus dem Arbeitsdokument (15/30/20 %)", () => {
    /*
     * Gemessen statt behauptet: 1000 Tode je Typ, die Quote muss bis auf
     * drei Prozentpunkte an der eingestellten liegen. Und die eingestellten
     * Werte selbst sind die des Dokuments - sonst misst der Test nur, dass
     * der Zufall funktioniert.
     */
    expect(LOOT.dropChance.runner).toBe(0.15);
    expect(LOOT.dropChance.brute).toBe(0.3);
    expect(LOOT.dropChance.shooter).toBe(0.2);

    // EINE Welt fuer alle 3000 Tode, zwischendurch nur aufgeraeumt. Eine
    // neue Welt je Tod (16000 px, Waende, Encounter) kostete fast 4 s und
    // lief auf dem CI-Rechner in die 5-Sekunden-Grenze.
    const state = emptyWorld();
    for (const type of ["runner", "brute", "shooter"] as const) {
      let drops = 0;
      const runs = 1000;
      for (let i = 0; i < runs; i += 1) {
        state.groundItems.length = 0;
        state.enemies.length = 0;
        state.events.length = 0;
        state.rngState = i * 7919 + 13;
        const enemy = createEnemy(1, type, { x: 5000, y: 5000 }, 1, 1, false);
        state.enemies.push(enemy);
        killEnemy(state, enemy);
        drops += state.groundItems.length;
      }
      const rate = drops / runs;
      const target = LOOT.dropChance[type] ?? 0;
      console.log(`   ${type}: Dropquote ${(rate * 100).toFixed(1)} % (eingestellt ${target * 100} %)`);
      expect(Math.abs(rate - target)).toBeLessThan(0.03);
    }
  });
});

describe("Aufsammeln", () => {
  it("hebt auf, was nah genug liegt", () => {
    const state = emptyWorld();
    place_player(state, 5000, 5000);
    dropItem(state, 0, { x: 5020, y: 5000 });

    stepLoot(state, TICK_SECONDS);

    expect(state.groundItems.length).toBe(0);
    expect(state.players[0]?.backpack.items.length).toBe(1);
    expect(state.events.some((event) => event.type === "itemPicked")).toBe(true);
  });

  it("laesst liegen, was zu weit weg ist", () => {
    const state = emptyWorld();
    place_player(state, 5000, 5000);
    dropItem(state, 0, { x: 5000 + LOOT.pickupRadius + 30, y: 5000 });

    stepLoot(state, TICK_SECONDS);

    expect(state.groundItems.length).toBe(1);
    expect(state.players[0]?.backpack.items.length).toBe(0);
  });

  it("laesst niemanden aufheben, der am Boden liegt", () => {
    // Sonst koennte man Beute einsammeln, waehrend man auf Wiederbelebung
    // wartet - und das Liegen haette keinen Preis mehr.
    const state = emptyWorld();
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");
    player.down = true;
    place_player(state, 5000, 5000);
    dropItem(state, 0, { x: 5005, y: 5000 });

    stepLoot(state, TICK_SECONDS);

    expect(state.groundItems.length).toBe(1);
    expect(player.backpack.items.length).toBe(0);
  });

  it("hebt MEHRERE Gegenstaende im selben Tick auf", () => {
    /*
     * Die Listen-Falle, die bei der Splittergranate schon einmal beinahe
     * durchgerutscht waere: Wird beim Entfernen vorwaerts gelaufen, ruecken
     * die folgenden Eintraege eine Stelle vor, und jeder zweite bliebe liegen.
     * Drei auf einmal deckt das auf, zwei nicht zuverlaessig.
     */
    const state = emptyWorld();
    place_player(state, 5000, 5000);
    dropItem(state, 0, { x: 4990, y: 5000 });
    dropItem(state, 1, { x: 5000, y: 5000 });
    dropItem(state, 2, { x: 5010, y: 5000 });

    stepLoot(state, TICK_SECONDS);

    expect(state.groundItems.length).toBe(0);
    expect(state.players[0]?.backpack.items.length).toBe(3);
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

    place_player(state, 4990, 5000, 0);
    place_player(state, 5010, 5000, 1);
    dropItem(state, 0, { x: 5000, y: 5000 });

    stepLoot(state, TICK_SECONDS);

    const total =
      (state.players[0]?.backpack.items.length ?? 0) + (state.players[1]?.backpack.items.length ?? 0);
    expect(total).toBe(1);
    expect(state.groundItems.length).toBe(0);
  });

  it("laesst einen Gegner-Drop nach einer Weile verschwinden", () => {
    const state = emptyWorld();
    place_player(state, 10, 10);
    dropItem(state, 0, { x: 5000, y: 5000 });

    for (let i = 0; i < LOOT.dropLifetime + 2; i += 1) {
      stepLoot(state, 1);
    }

    expect(state.groundItems.length).toBe(0);
  });
});

describe("Der gepackte Rucksack im Run", () => {
  it("kommt mit in die Runde, statt verworfen zu werden", () => {
    /*
     * GENAU DAS HAT GEFEHLT. Der Loadout-Bildschirm gab nur den Charakter
     * weiter; im Spiel stand danach "Beute 0", obwohl man gerade vier
     * Gegenstaende eingeraeumt hatte. Das Packen war damit folgenlos.
     */
    const state = createWorld(
      [
        {
          id: "p",
          name: "Du",
          character: "scout",
          backpack: [
            { def: itemIndex("pistol"), x: 0, y: 0, rotated: false },
            { def: itemIndex("medkit"), x: 3, y: 1, rotated: false },
          ],
        },
      ],
      4242,
    );

    const backpack = state.players[0]?.backpack;
    expect(backpack?.items.length).toBe(2);
  });

  it("behaelt die Anordnung, die von Hand gelegt wurde", () => {
    // Ein Rucksack, der sich beim Start selbst umsortiert, waere eine kleine
    // Unverschaemtheit - man hat gerade eingeraeumt.
    const state = createWorld(
      [
        {
          id: "p",
          name: "Du",
          character: "scout",
          backpack: [{ def: itemIndex("rifle"), x: 4, y: 2, rotated: false }],
        },
      ],
      4242,
    );

    const entry = state.players[0]?.backpack.items[0];
    expect(entry?.x).toBe(4);
    expect(entry?.y).toBe(2);
  });

  it("startet ohne Angabe mit leerem Rucksack", () => {
    // Kein Fehlerfall: Wer direkt ins Spiel springt, soll nicht daran
    // scheitern.
    const state = createWorld(bareSetup(), 4242);
    expect(state.players[0]?.backpack.items.length).toBe(0);
  });
});

describe("Rucksack im Run umraeumen (Etappe 9)", () => {
  function withPistol(): WorldState {
    const state = emptyWorld([
      { id: "p1", name: "A", character: "scout", backpack: [{ def: itemIndex("pistol"), x: 0, y: 0, rotated: false }] },
    ]);
    place_player(state, 5000, 5000);
    return state;
  }

  it("verschiebt und dreht ueber einen Befehl in der Eingabe", () => {
    const state = withPistol();
    stepWorld(
      state,
      new Map([["p1", makeInput({ x: 0, y: 0 }, { inventory: { op: "move", fromX: 0, fromY: 0, x: 3, y: 2, rotated: true } })]]),
      TICK_SECONDS,
    );
    const entry = state.players[0]?.backpack.items[0];
    expect(entry).toMatchObject({ x: 3, y: 2, rotated: true });
  });

  it("wirft weg: der Gegenstand liegt danach am Boden, nicht im Nichts", () => {
    const state = withPistol();
    stepWorld(
      state,
      new Map([["p1", makeInput({ x: 0, y: 0 }, { inventory: { op: "drop", fromX: 0, fromY: 0 } })]]),
      TICK_SECONDS,
    );
    expect(state.players[0]?.backpack.items).toHaveLength(0);
    expect(state.groundItems.map((item) => item.def)).toEqual([itemIndex("pistol")]);
  });

  it("tut nichts, wenn an der genannten Stelle nichts liegt", () => {
    // Der Befehl benennt den Gegenstand ueber seine Zelle - zeigt sie ins
    // Leere, darf nichts anderes bewegt werden.
    const state = withPistol();
    stepWorld(
      state,
      new Map([["p1", makeInput({ x: 0, y: 0 }, { inventory: { op: "drop", fromX: 5, fromY: 5 } })]]),
      TICK_SECONDS,
    );
    expect(state.players[0]?.backpack.items).toHaveLength(1);
  });
});

describe("Voller Rucksack", () => {
  it("laesst den Gegenstand liegen, statt ihn verschwinden zu lassen", () => {
    /*
     * Die Zusicherung, die das Gitter ueberhaupt erst zu einer Entscheidung
     * macht. Ihn trotzdem aufzunehmen hiesse, das Gitter waere Zierde; ihn
     * verschwinden zu lassen waere stiller Verlust. Man kann zurueckkommen,
     * nachdem man Platz gemacht hat.
     */
    const state = emptyWorld();
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    // Rucksack randvoll mit 1x1-Gegenstaenden.
    const cells = player.backpack.width * player.backpack.height;
    for (let i = 0; i < cells; i += 1) {
      const spot = findFreeSpot(player.backpack, itemIndex("scrap"));
      if (!spot) break;
      place(player.backpack, { id: 1000 + i, def: itemIndex("scrap") }, spot.x, spot.y, spot.rotated);
    }
    expect(findFreeSpot(player.backpack, itemIndex("scrap"))).toBeNull();

    place_ground(state, 5000, 5000);
    stepLoot(state, TICK_SECONDS);

    expect(state.groundItems.length).toBe(1);
    expect(state.events.some((event) => event.type === "backpackFull")).toBe(true);
  });

  it("meldet 'voll' nur EINMAL je Gegenstand", () => {
    // Sonst kaeme die Meldung dreissigmal je Sekunde, solange man daneben
    // steht - aus einem Hinweis wuerde ein Alarm.
    const state = emptyWorld();
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    const cells = player.backpack.width * player.backpack.height;
    for (let i = 0; i < cells; i += 1) {
      const spot = findFreeSpot(player.backpack, itemIndex("scrap"));
      if (!spot) break;
      place(player.backpack, { id: 2000 + i, def: itemIndex("scrap") }, spot.x, spot.y, spot.rotated);
    }

    place_ground(state, 5000, 5000);

    let warnings = 0;
    for (let i = 0; i < 30; i += 1) {
      state.events.length = 0;
      stepLoot(state, TICK_SECONDS);
      warnings += state.events.filter((event) => event.type === "backpackFull").length;
    }

    expect(warnings).toBe(1);
  });

  it("nimmt es wieder auf, sobald Platz gemacht wurde", () => {
    const state = emptyWorld();
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    const cells = player.backpack.width * player.backpack.height;
    for (let i = 0; i < cells; i += 1) {
      const spot = findFreeSpot(player.backpack, itemIndex("scrap"));
      if (!spot) break;
      place(player.backpack, { id: 3000 + i, def: itemIndex("scrap") }, spot.x, spot.y, spot.rotated);
    }

    place_ground(state, 5000, 5000);
    stepLoot(state, TICK_SECONDS);
    expect(state.groundItems.length).toBe(1);

    // Platz schaffen.
    removeAt(player.backpack, 0);
    stepLoot(state, TICK_SECONDS);

    expect(state.groundItems.length).toBe(0);
  });
});

/** Ein Gegenstand im Rucksack, wie ihn das Gittersystem ablegt. */
function placed(id: number, def: number, starter = false): PlacedItem {
  return { item: { id, def, starter }, x: id, y: 0, rotated: false };
}

describe("Run-Ende", () => {
  beforeEach(() => resetCarried());

  it("verliert bei einem Team-Wipe alles ausser dem Starter-Set", () => {
    const result = finishRun("wipe", [placed(1, 0), placed(2, 1), placed(3, 5, true)]);

    // Der Starter-Gegenstand zaehlt nicht: Er ist geschuetzt.
    expect(result.lost).toBe(2);
    expect(result.kept).toBe(0);
    expect(backpackForNextRun()).toHaveLength(0);
  });

  it("behaelt nach einem Erfolg den Rucksack samt Anordnung", () => {
    const result = finishRun("extracted", [placed(1, 0), placed(2, 1)]);
    expect(result.kept).toBe(2);
    expect(backpackForNextRun().map((entry) => entry.x)).toEqual([1, 2]);

    finishRun("bossDefeated", [placed(3, 2)]);
    expect(backpackForNextRun()).toHaveLength(1);
  });

  it("vermehrt das Starter-Set nicht", () => {
    /*
     * DER FEHLER, DEN ETAPPE 9 BEHEBT: Vorher wanderte nach einem Erfolg
     * alles in die gesicherte Beute - auch das Starter-Set, das beim
     * naechsten Packen ohnehin frisch dazukommt. Zwei Erfolge, drei
     * Pistolen.
     */
    const result = finishRun("extracted", [placed(1, 0, true), placed(2, 5, true)]);
    expect(result.kept).toBe(0);
    // Im Rucksack bleiben sie liegen - aber als Starter markiert, damit das
    // Packen sie nicht noch einmal dazulegt.
    expect(backpackForNextRun().every((entry) => entry.starter)).toBe(true);
  });

  it("laesst einen Wipe das Lager NICHT anfassen", () => {
    // Das Lager bleibt unberuehrt - so steht es im Briefing, und es ist der
    // Grund, warum man nach einem Wipe ueberhaupt weiterspielt.
    saveStash([{ def: 3, x: 0, y: 0, rotated: false }]);
    finishRun("wipe", [placed(2, 1)]);

    expect(stashItems()).toHaveLength(1);
  });

  it("verliert die Beute, wer bei der Extraktion am Boden zurueckbleibt", () => {
    // Das Team ist raus - dieser Spieler aber nicht wirklich.
    const result = finishRun("extracted", [placed(1, 0)], true);

    expect(result.lost).toBe(1);
    expect(backpackForNextRun()).toHaveLength(0);
  });
});
