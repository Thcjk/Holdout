/**
 * Das Rucksack-Gitter.
 *
 * Diese Tests laufen ohne jedes Pixel - genau darum geht es. Die
 * Platzierungslogik wird an zwei ganz verschiedenen Stellen gebraucht (der
 * Loadout-Bildschirm mit dem Daumen, das Aufsammeln mitten im Gefecht beim
 * Host), und beide muessen dieselbe Antwort bekommen. Was sich nur im Browser
 * pruefen laesst, laesst sich nicht gegen zwei Verwender absichern.
 *
 * Vier Zusicherungen stehen im Mittelpunkt:
 *
 *  1. NICHTS UEBERLAPPT, und nichts ragt ueber den Rand.
 *  2. DREHEN VERTAUSCHT WIRKLICH BREITE UND HOEHE - sonst waere die Drehung
 *     eine Animation ohne Wirkung.
 *  3. EIN GEGENSTAND DARF SICH MIT SICH SELBST UEBERLAPPEN. Ohne diese
 *     Ausnahme liesse er sich nie um eine Zelle verruecken.
 *  4. DIE AUTOMATISCHE SUCHE IST VORHERSAGBAR. Im Koop muss dasselbe
 *     Aufsammeln bei Host und Client denselben Rucksack ergeben.
 */

import { describe, expect, it } from "vitest";
import { INVENTORY } from "../../src/config/balance";
import { ITEMS, itemIndex } from "../../src/config/items";
import {
  createGrid,
  findFreeSpot,
  fits,
  footprint,
  itemIndexAt,
  move,
  occupancy,
  place,
  removeAt,
  usedCells,
} from "../../src/systems/InventoryGridSystem";
import type { ItemInstance } from "../../src/systems/types";

let nextId = 1;

/** Ein Gegenstand aus dem Katalog, per Schluessel. */
function item(id: string): ItemInstance {
  const def = itemIndex(id);
  if (def < 0) throw new Error(`unbekannter Gegenstand: ${id}`);
  return { id: nextId++, def };
}

describe("Gittergroesse", () => {
  it("nimmt den groessten Gegenstand in BEIDEN Lagen auf", () => {
    /*
     * Die harte Grenze hinter der Wahl 8x4. Das Gewehr ist 4x2, gedreht 2x4 -
     * ein Gitter von nur 3 Zellen Hoehe machte die Drehung genau fuer die
     * Gegenstaende unmoeglich, bei denen sie am meisten braechte.
     */
    const biggest = ITEMS.reduce((a, b) =>
      a.size.width * a.size.height >= b.size.width * b.size.height ? a : b,
    );
    const longest = Math.max(biggest.size.width, biggest.size.height);

    expect(INVENTORY.width).toBeGreaterThanOrEqual(longest);
    expect(INVENTORY.height).toBeGreaterThanOrEqual(longest);
  });

  it("ist nicht so gross, dass es nichts zu entscheiden gaebe", () => {
    // Gemessen wurden im Schnitt 6,2 belegte Zellen je Run (Bot, ohne
    // Gebaeude). 32 Zellen sind Luft, aber keine Einladung, alles
    // mitzunehmen - genau das soll das Gitter ja verhindern.
    const cells = INVENTORY.width * INVENTORY.height;
    expect(cells).toBeGreaterThanOrEqual(24);
    expect(cells).toBeLessThanOrEqual(48);
  });
});

describe("Platzieren", () => {
  it("legt einen Gegenstand ab und merkt sich, wo er liegt", () => {
    const grid = createGrid();
    expect(place(grid, item("pistol"), 0, 0)).toBe(true);

    expect(grid.items.length).toBe(1);
    // Die Pistole ist 2x1: Beide Zellen gehoeren ihr, die dritte nicht.
    expect(itemIndexAt(grid, 0, 0)).toBe(0);
    expect(itemIndexAt(grid, 1, 0)).toBe(0);
    expect(itemIndexAt(grid, 2, 0)).toBe(-1);
  });

  it("laesst nichts ueber den Rand ragen", () => {
    const grid = createGrid();
    // Ein Gewehr (4x2) an die rechte Kante: Da ist kein Platz mehr.
    expect(place(grid, item("rifle"), INVENTORY.width - 2, 0)).toBe(false);
    expect(place(grid, item("scrap"), INVENTORY.width, 0)).toBe(false);
    expect(place(grid, item("scrap"), 0, INVENTORY.height)).toBe(false);
    expect(place(grid, item("scrap"), -1, 0)).toBe(false);
    expect(grid.items.length).toBe(0);
  });

  it("laesst zwei Gegenstaende nicht uebereinander liegen", () => {
    const grid = createGrid();
    place(grid, item("rifle"), 0, 0); // belegt 0..3 x 0..1

    expect(place(grid, item("scrap"), 0, 0)).toBe(false);
    expect(place(grid, item("scrap"), 3, 1)).toBe(false);
    // Genau daneben geht.
    expect(place(grid, item("scrap"), 4, 0)).toBe(true);
    expect(place(grid, item("scrap"), 0, 2)).toBe(true);
  });

  it("nimmt nur ganze Zellen an", () => {
    // Ein halber Schritt waere ein Gitter, das keines ist - und ab da
    // stimmte keine Ueberlappungspruefung mehr.
    const grid = createGrid();
    expect(fits(grid, itemIndex("scrap"), false, 1.5, 0)).toBe(false);
    expect(fits(grid, itemIndex("scrap"), false, 0, 0.5)).toBe(false);
  });
});

describe("Drehen", () => {
  it("vertauscht Breite und Hoehe", () => {
    const rifle = itemIndex("rifle");
    expect(footprint(rifle, false)).toEqual({ width: 4, height: 2 });
    expect(footprint(rifle, true)).toEqual({ width: 2, height: 4 });
  });

  it("macht moeglich, was ungedreht nicht passt", () => {
    /*
     * Der eigentliche Sinn der Drehung, an einem Fall, den man nachrechnen
     * kann: In einer Spalte von 2 Zellen Breite liegt ein 4x2-Gewehr nur
     * gedreht.
     */
    const grid = createGrid();
    // Die linken sechs Spalten zustellen, damit nur zwei uebrig bleiben.
    place(grid, item("rifle"), 0, 0);
    place(grid, item("rifle"), 0, 2);
    place(grid, item("cell"), 4, 0);
    place(grid, item("cell"), 5, 0);
    place(grid, item("cell"), 4, 2);
    place(grid, item("cell"), 5, 2);

    const rifle = itemIndex("rifle");
    expect(fits(grid, rifle, false, 6, 0)).toBe(false);
    expect(fits(grid, rifle, true, 6, 0)).toBe(true);
  });
});

describe("Verschieben", () => {
  it("darf sich mit sich selbst ueberlappen", () => {
    /*
     * Ohne diese Ausnahme liesse sich ein Gegenstand nie um EINE Zelle
     * verruecken - er staende sich selbst im Weg. Beim Ziehen mit dem Daumen
     * ist genau das die haeufigste Bewegung.
     */
    const grid = createGrid();
    place(grid, item("rifle"), 0, 0);

    expect(move(grid, 0, 1, 0, false)).toBe(true);
    expect(grid.items[0]?.x).toBe(1);
  });

  it("verschiebt nicht auf einen belegten Platz", () => {
    const grid = createGrid();
    place(grid, item("scrap"), 0, 0);
    place(grid, item("scrap"), 1, 0);

    expect(move(grid, 0, 1, 0, false)).toBe(false);
    expect(grid.items[0]?.x).toBe(0);
  });

  it("dreht beim Verschieben mit", () => {
    const grid = createGrid();
    place(grid, item("rifle"), 0, 0);

    expect(move(grid, 0, 0, 0, true)).toBe(true);
    expect(grid.items[0]?.rotated).toBe(true);
    expect(itemIndexAt(grid, 1, 3)).toBe(0);
    expect(itemIndexAt(grid, 2, 0)).toBe(-1);
  });
});

describe("Herausnehmen", () => {
  it("gibt den Platz wieder frei", () => {
    const grid = createGrid();
    place(grid, item("rifle"), 0, 0);
    expect(usedCells(grid)).toBe(8);

    const taken = removeAt(grid, 0);
    expect(taken).not.toBeNull();
    expect(usedCells(grid)).toBe(0);
    expect(place(grid, item("rifle"), 0, 0)).toBe(true);
  });
});

describe("Automatisch einsortieren", () => {
  it("findet den ersten freien Platz von oben links", () => {
    /*
     * IMMER DIESELBE REIHENFOLGE, und das ist keine Kosmetik: Im Koop muss
     * dasselbe Aufsammeln bei Host und Client denselben Rucksack ergeben.
     * Waere die Suche zufaellig oder "die beste Stelle", lieferte sie auf
     * zwei Geraeten verschiedene Ergebnisse.
     */
    const grid = createGrid();
    const spot = findFreeSpot(grid, itemIndex("scrap"));
    expect(spot).toEqual({ x: 0, y: 0, rotated: false });

    place(grid, item("scrap"), 0, 0);
    expect(findFreeSpot(grid, itemIndex("scrap"))).toEqual({ x: 1, y: 0, rotated: false });
  });

  it("dreht erst, wenn es ungedreht nicht mehr passt", () => {
    // Ausdruecklich 8 x 4: Der Aufbau unten stellt genau vier Zeilen zu. Seit
    // der Rucksack 8 x 6 ist (Etappe 9), passte das Gewehr sonst unten
    // ungedreht hin - der Test hing an der Standardgroesse, nicht an der
    // Drehlogik, die er pruefen soll.
    const grid = createGrid(8, 4);
    // Alles bis auf eine Spalte von 2 Breite zustellen.
    place(grid, item("rifle"), 0, 0);
    place(grid, item("rifle"), 0, 2);
    place(grid, item("cell"), 4, 0);
    place(grid, item("cell"), 5, 0);
    place(grid, item("cell"), 4, 2);
    place(grid, item("cell"), 5, 2);

    const spot = findFreeSpot(grid, itemIndex("rifle"));
    expect(spot?.rotated).toBe(true);
  });

  it("meldet ehrlich, wenn nichts mehr passt", () => {
    // "Rucksack voll" muss sich sauber feststellen lassen - sonst
    // verschwindet ein aufgehobener Gegenstand still.
    const grid = createGrid(2, 2);
    place(grid, item("core"), 0, 0); // 2x2, also randvoll

    expect(findFreeSpot(grid, itemIndex("scrap"))).toBeNull();
    expect(usedCells(grid)).toBe(4);
  });

  it("fuellt ein Gitter vollstaendig, ohne etwas zu ueberlappen", () => {
    /*
     * Der Rundumschlag: 32 Einzelzellen in ein 8x4-Gitter. Danach muss jede
     * Zelle genau einmal belegt sein - das deckt sowohl Lecks (freie Zellen,
     * die als belegt gelten) als auch Ueberlappungen auf.
     */
    const grid = createGrid();
    const cells = INVENTORY.width * INVENTORY.height;

    for (let i = 0; i < cells; i += 1) {
      const spot = findFreeSpot(grid, itemIndex("scrap"));
      expect(spot).not.toBeNull();
      if (!spot) break;
      expect(place(grid, item("scrap"), spot.x, spot.y, spot.rotated)).toBe(true);
    }

    expect(usedCells(grid)).toBe(cells);
    expect(findFreeSpot(grid, itemIndex("scrap"))).toBeNull();

    const mask = occupancy(grid);
    for (const row of mask) {
      for (const cell of row) {
        expect(cell).toBe(true);
      }
    }
  });
});

describe("Starter-Set", () => {
  it("passt vollstaendig in den Rucksack", () => {
    // Waere es zu gross, staende ein Spieler schon vor dem ersten Run vor
    // einem Rucksack, in den seine Grundausruestung nicht hineinpasst.
    const grid = createGrid();

    for (const id of INVENTORY.starterSet) {
      const spot = findFreeSpot(grid, itemIndex(id));
      expect(spot, `kein Platz fuer ${id}`).not.toBeNull();
      if (!spot) continue;
      place(grid, item(id), spot.x, spot.y, spot.rotated);
    }

    expect(grid.items.length).toBe(INVENTORY.starterSet.length);
    const cells = INVENTORY.width * INVENTORY.height;
    console.log(
      `   Starter-Set: ${grid.items.length} Gegenstaende, ${usedCells(grid)} von ${cells} Zellen`,
    );
    // Es soll Grundausruestung sein, nicht ein voller Rucksack.
    expect(usedCells(grid)).toBeLessThan(cells / 2);
  });

  it("nennt nur Gegenstaende, die es wirklich gibt", () => {
    // Ein Tippfehler im Schluessel waere sonst ein Gegenstand, der beim
    // Start still fehlt.
    for (const id of INVENTORY.starterSet) {
      expect(itemIndex(id), `unbekannt: ${id}`).toBeGreaterThanOrEqual(0);
    }
  });
});
