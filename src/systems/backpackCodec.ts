/**
 * Rucksack als flache Zahlenreihe - fuer Netz und Lobby.
 *
 * Je Gegenstand vier Zahlen: Gegenstandsnummer, x, y und ein MERKMALSFELD.
 * Bis Etappe 9 war die vierte Zahl nur "gedreht" (0 oder 1). Seitdem traegt
 * sie zwei Merkmale als Bits:
 *
 *   Bit 0 (Wert 1)  gedreht
 *   Bit 1 (Wert 2)  gehoert zum Starter-Set
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

export function flagsOf(rotated: boolean, starter: boolean | undefined): number {
  return (rotated ? ROTATED : 0) | (starter ? STARTER : 0);
}

export function readFlags(flags: number): { rotated: boolean; starter: boolean } {
  return { rotated: (flags & ROTATED) !== 0, starter: (flags & STARTER) !== 0 };
}

/** Gepackte Gegenstaende als flache Reihe. */
export function flattenPacked(items: readonly PackedItem[]): number[] {
  return items.flatMap((entry) => [
    entry.def,
    entry.x,
    entry.y,
    flagsOf(entry.rotated, entry.starter),
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
    const { rotated, starter } = readFlags(flat[i + 3] as number);
    items.push({
      def: flat[i] as number,
      x: flat[i + 1] as number,
      y: flat[i + 2] as number,
      rotated,
      starter,
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
  }));
}
