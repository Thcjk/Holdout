/**
 * Rucksack als flache Zahlenreihe - fuer Netz und Lobby.
 *
 * Je Gegenstand vier Zahlen: Gegenstandsnummer, x, y und ein MERKMALSFELD.
 * Bis Etappe 9 war die vierte Zahl nur "gedreht" (0 oder 1). Seitdem traegt
 * sie zwei Merkmale als Bits:
 *
 *   Bit 0 (Wert 1)  gedreht
 *   Bit 1 (Wert 2)  gehoert zum Starter-Set
 *   Bit 2 (Wert 4)  ausgeruestete Waffe (seit der Waffen-Ausruestung)
 *
 * Warum kein fuenfter Wert: Alte Pakete bleiben so lesbar (ein "1" ist
 * weiterhin "gedreht, kein Starter"), und die Reihe waechst nicht.
 *
 * Warum das Starter-Merkmal ueberhaupt reisen muss: Das Starter-Set ist
 * geschuetzt - es geht bei einem Wipe nicht verloren und darf sich bei einem
 * Erfolg auch nicht vermehren (`storage/carried.ts`). Das kann nur, wer am
 * Run-Ende noch weiss, welcher Gegenstand dazugehoert. Im Koop baut der
 * Rucksack aber auf dem Host auf und kommt im Zustandspaket zurueck.
 */

import type { InventoryGrid, PackedItem } from "./types";

const ROTATED = 1;
const STARTER = 2;
const EQUIPPED = 4;
/** Liegt im Guertel (seit 2026-09-26); dann ist x der Guertelplatz. */
const BELT = 8;
/** Aufsaetze als vier Bits ab hier (Visier, Lauf, Magazin, Griff). */
const MODS_SHIFT = 4;
const MODS_MASK = 0b1111;

export function flagsOf(
  rotated: boolean,
  starter: boolean | undefined,
  equipped?: boolean,
  belt?: boolean,
  mods?: number,
): number {
  return (
    (rotated ? ROTATED : 0) |
    (starter ? STARTER : 0) |
    (equipped ? EQUIPPED : 0) |
    (belt ? BELT : 0) |
    (((mods ?? 0) & MODS_MASK) << MODS_SHIFT)
  );
}

export function readFlags(flags: number): {
  rotated: boolean;
  starter: boolean;
  equipped: boolean;
  belt: boolean;
  mods: number;
} {
  return {
    rotated: (flags & ROTATED) !== 0,
    starter: (flags & STARTER) !== 0,
    equipped: (flags & EQUIPPED) !== 0,
    belt: (flags & BELT) !== 0,
    mods: (flags >> MODS_SHIFT) & MODS_MASK,
  };
}

/** Gepackte Gegenstaende als flache Reihe. */
export function flattenPacked(items: readonly PackedItem[]): number[] {
  return items.flatMap((entry) => [
    entry.def,
    entry.x,
    entry.y,
    flagsOf(entry.rotated, entry.starter, entry.equipped, entry.belt, entry.mods),
  ]);
}

/**
 * Macht aus der flachen Reihe wieder gepackte Gegenstaende.
 *
 * Unvollstaendige Viererbloecke werden stillschweigend verworfen (`i + 3 <
 * length`). Das ist kein Schlampen: Die Reihe kommt vom Netz, und ein halber
 * Block waere ein Gegenstand ohne Position - besser einer weniger als ein
 * Rucksack, der bei Host und Client verschieden aussieht.
 */
export function unflattenPacked(flat: readonly number[] | undefined): PackedItem[] {
  const items: PackedItem[] = [];
  if (!flat) {
    return items;
  }
  for (let i = 0; i + 3 < flat.length; i += 4) {
    const { rotated, starter, equipped, belt, mods } = readFlags(flat[i + 3] as number);
    items.push({
      def: flat[i] as number,
      x: flat[i + 1] as number,
      y: flat[i + 2] as number,
      rotated,
      starter,
      equipped,
      // Nur setzen, was da ist - aeltere Tests vergleichen Objekte genau.
      ...(belt ? { belt: true } : {}),
      ...(mods ? { mods } : {}),
    });
  }
  return items;
}

/** Der Inhalt eines Gitters als gepackte Liste - mit Lage und Merkmalen. */
export function packGrid(grid: InventoryGrid): PackedItem[] {
  return grid.items.map((entry) => ({
    def: entry.item.def,
    x: entry.x,
    y: entry.y,
    rotated: entry.rotated,
    starter: entry.item.starter === true,
    equipped: entry.item.equipped === true,
    ...(entry.item.mods ? { mods: entry.item.mods } : {}),
  }));
}

/**
 * Rucksack UND Guertel eines Spielers als eine Liste - Guertelstuecke mit
 * `belt: true`. So reisen beide durch alle Wege, die es fuer den Rucksack
 * schon gibt (Karte, Lobby, Spielstand, Abrechnung), ohne ein zweites Feld.
 */
export function packCarried(backpack: InventoryGrid, belt: InventoryGrid): PackedItem[] {
  return [...packGrid(backpack), ...packGrid(belt).map((entry) => ({ ...entry, y: 0, belt: true }))];
}
