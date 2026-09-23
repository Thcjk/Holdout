/**
 * Das Rucksack-Gitter - reine Datenlogik, ohne ein einziges Pixel.
 *
 * ================================================================
 * WARUM DAS HIER STRIKT VON DER ANZEIGE GETRENNT IST
 * ================================================================
 *
 * Die Architektur-Grundregel gilt in dieser Phase besonders, und zwar aus
 * einem praktischen Grund: Dieselbe Logik wird an ZWEI ganz verschiedenen
 * Stellen gebraucht.
 *
 *   1. Im Loadout-Bildschirm vor dem Run, wo ein Mensch Gegenstaende mit dem
 *      Daumen herumschiebt und dreht.
 *   2. Beim Aufsammeln mitten im Gefecht, wo NIEMAND etwas schiebt und die
 *      Simulation selbst einen freien Platz finden muss - beim Host, fuer
 *      alle, ohne Bildschirm.
 *
 * Steckte die Pruefung "passt das hier hin?" in der Zeichenkomponente, gaebe
 * es sie zwangslaeufig zweimal. Und zwei Antworten auf dieselbe Frage laufen
 * auseinander: Der Loadout-Bildschirm liesse etwas zu, das die Simulation
 * ablehnt, oder umgekehrt - im Koop waere das ein Rucksack, der bei Host und
 * Client verschieden aussieht.
 *
 * ================================================================
 * WIE DAS GITTER GESPEICHERT IST
 * ================================================================
 *
 * NICHT als zweidimensionales Feld von Zellen, sondern als LISTE DER
 * PLATZIERTEN GEGENSTAENDE mit ihrer linken oberen Ecke. Die Belegung wird
 * daraus ausgerechnet, wenn sie gebraucht wird.
 *
 * Der Grund: Ein Zellenfeld muesste bei jeder Bewegung an zwei Stellen
 * gepflegt werden (alte Zellen freigeben, neue belegen), und ein vergessener
 * Schritt hinterlaesst Zellen, die belegt aussehen, obwohl nichts drinliegt -
 * ein Fehler, den man erst bemerkt, wenn der Rucksack unerklaerlich voll ist.
 * Bei hoechstens ein paar Dutzend Gegenstaenden kostet das Nachrechnen
 * nichts.
 */

import { INVENTORY } from "../config/balance";
import { itemAt } from "../config/items";
import type { InventoryGrid, ItemInstance } from "./types";

/*
 * Die Datentypen `InventoryGrid` und `PlacedItem` stehen in `types.ts`, bei
 * allen anderen Daten der Simulation - `PlayerState` traegt ein Gitter, und
 * andersherum gaebe es einen Import-Zyklus. Hier steht nur, was man damit
 * TUN kann.
 */

/** Ein leeres Gitter in der eingestellten Groesse. */
export function createGrid(
  // Ausdruecklich als `number` deklariert: `INVENTORY` ist `as const`, also
  // waere `width` sonst vom Typ `8` statt `number` - und ein Testgitter von
  // 2x2 liesse sich gar nicht anlegen.
  width: number = INVENTORY.width,
  height: number = INVENTORY.height,
): InventoryGrid {
  return { width, height, items: [] };
}

/** Platzbedarf eines Gegenstands, Drehung eingerechnet. */
export function footprint(
  def: number,
  rotated: boolean,
): { width: number; height: number } | null {
  const entry = itemAt(def);
  if (!entry) {
    return null;
  }
  const { width, height } = entry.size;
  return rotated ? { width: height, height: width } : { width, height };
}

/**
 * Passt dieser Gegenstand an diese Stelle?
 *
 * `ignore` ist der Index eines Gegenstands, der beim Pruefen ausgeklammert
 * wird - gebraucht beim Verschieben: Ein Gegenstand darf sich mit SICH SELBST
 * ueberlappen, sonst liesse er sich nie um eine Zelle verruecken.
 */
export function fits(
  grid: InventoryGrid,
  def: number,
  rotated: boolean,
  x: number,
  y: number,
  ignore = -1,
): boolean {
  const size = footprint(def, rotated);
  if (!size) {
    return false;
  }

  // Ganzzahlige Zellen. Ein halber Schritt waere ein Gitter, das keines ist.
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return false;
  }

  if (x < 0 || y < 0 || x + size.width > grid.width || y + size.height > grid.height) {
    return false;
  }

  for (let i = 0; i < grid.items.length; i += 1) {
    if (i === ignore) {
      continue;
    }
    const other = grid.items[i];
    if (!other) {
      continue;
    }
    const otherSize = footprint(other.item.def, other.rotated);
    if (!otherSize) {
      continue;
    }
    const overlaps =
      x < other.x + otherSize.width &&
      x + size.width > other.x &&
      y < other.y + otherSize.height &&
      y + size.height > other.y;
    if (overlaps) {
      return false;
    }
  }

  return true;
}

/** Legt einen Gegenstand ab. Gibt `false` zurueck, wenn es nicht passt. */
export function place(
  grid: InventoryGrid,
  item: ItemInstance,
  x: number,
  y: number,
  rotated = false,
): boolean {
  if (!fits(grid, item.def, rotated, x, y)) {
    return false;
  }
  grid.items.push({ item, x, y, rotated });
  return true;
}

/** Verschiebt einen bereits platzierten Gegenstand. */
export function move(
  grid: InventoryGrid,
  index: number,
  x: number,
  y: number,
  rotated: boolean,
): boolean {
  const entry = grid.items[index];
  if (!entry) {
    return false;
  }
  if (!fits(grid, entry.item.def, rotated, x, y, index)) {
    return false;
  }
  entry.x = x;
  entry.y = y;
  entry.rotated = rotated;
  return true;
}

/** Nimmt einen Gegenstand heraus und gibt ihn zurueck. */
export function removeAt(grid: InventoryGrid, index: number): ItemInstance | null {
  const entry = grid.items[index];
  if (!entry) {
    return null;
  }
  grid.items.splice(index, 1);
  return entry.item;
}

/** Welcher Gegenstand liegt auf dieser Zelle? Index, oder -1. */
export function itemIndexAt(grid: InventoryGrid, x: number, y: number): number {
  for (let i = 0; i < grid.items.length; i += 1) {
    const entry = grid.items[i];
    if (!entry) {
      continue;
    }
    const size = footprint(entry.item.def, entry.rotated);
    if (!size) {
      continue;
    }
    if (x >= entry.x && x < entry.x + size.width && y >= entry.y && y < entry.y + size.height) {
      return i;
    }
  }
  return -1;
}

/**
 * Sucht den ersten freien Platz - zuerst ungedreht, dann gedreht.
 *
 * ================================================================
 * DAS IST DIE FUNKTION, DIE MITTEN IM GEFECHT LAEUFT
 * ================================================================
 *
 * Beim Aufsammeln soll niemand etwas einsortieren muessen. Gesucht wird
 * zeilenweise von oben links - immer dieselbe Reihenfolge, damit dasselbe
 * Aufsammeln bei Host und Client dasselbe Ergebnis hat. Waere die Suche
 * zufaellig oder "der beste Platz", lieferte sie auf zwei Geraeten
 * verschiedene Rucksaecke.
 *
 * ERST UNGEDREHT: So bleibt die Lage vorhersagbar, und wer danach von Hand
 * sortiert, findet die Dinge so vor, wie sie im Katalog stehen.
 */
export function findFreeSpot(
  grid: InventoryGrid,
  def: number,
): { x: number; y: number; rotated: boolean } | null {
  const entry = itemAt(def);
  if (!entry) {
    return null;
  }

  // Quadratische Gegenstaende zweimal zu pruefen waere verschwendete Arbeit -
  // gedreht sehen sie genauso aus.
  const square = entry.size.width === entry.size.height;
  const orientations = square ? [false] : [false, true];

  for (const rotated of orientations) {
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        if (fits(grid, def, rotated, x, y)) {
          return { x, y, rotated };
        }
      }
    }
  }

  return null;
}

/** Wie viele Zellen belegt sind. */
export function usedCells(grid: InventoryGrid): number {
  let used = 0;
  for (const entry of grid.items) {
    const size = footprint(entry.item.def, entry.rotated);
    if (size) {
      used += size.width * size.height;
    }
  }
  return used;
}

/**
 * Die Belegung als Maske - `true` heisst belegt.
 *
 * Nur fuer Anzeige und Tests gedacht: Die Logik selbst rechnet ueber
 * `fits`, damit es keine zweite Buchfuehrung gibt, die veralten kann.
 */
export function occupancy(grid: InventoryGrid): boolean[][] {
  const mask: boolean[][] = [];
  for (let y = 0; y < grid.height; y += 1) {
    mask.push(new Array<boolean>(grid.width).fill(false));
  }

  for (const entry of grid.items) {
    const size = footprint(entry.item.def, entry.rotated);
    if (!size) {
      continue;
    }
    for (let dy = 0; dy < size.height; dy += 1) {
      for (let dx = 0; dx < size.width; dx += 1) {
        const row = mask[entry.y + dy];
        if (row) {
          row[entry.x + dx] = true;
        }
      }
    }
  }

  return mask;
}
