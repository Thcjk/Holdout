/**
 * Der Rucksack als flache Zahlenreihe - mit Starter-Merkmal.
 */

import { describe, expect, it } from "vitest";
import { flattenPacked, unflattenPacked } from "../../src/systems/backpackCodec";
import type { PackedItem } from "../../src/systems/types";

describe("Rucksack-Codec", () => {
  it("bringt Lage, Drehung, Starter- und Ausgeruestet-Merkmal unversehrt zurueck", () => {
    const items: PackedItem[] = [
      { def: 8, x: 0, y: 0, rotated: false, starter: true, equipped: true },
      { def: 5, x: 2, y: 1, rotated: true, starter: true, equipped: false },
      { def: 10, x: 4, y: 3, rotated: true, starter: false, equipped: false },
      { def: 0, x: 7, y: 5, rotated: false, starter: false, equipped: false },
    ];
    expect(unflattenPacked(flattenPacked(items))).toEqual(items);
  });

  it("liest das alte Format: 1 heisst gedreht, kein Starter", () => {
    // Vor Etappe 9 war der vierte Wert nur 0 oder 1 - so muss er weiter
    // verstanden werden.
    expect(unflattenPacked([4, 1, 2, 1])).toEqual([
      { def: 4, x: 1, y: 2, rotated: true, starter: false, equipped: false },
    ]);
  });

  it("liest das Format vor der Waffen-Ausruestung: 3 heisst gedreht und Starter", () => {
    expect(unflattenPacked([8, 0, 0, 3])).toEqual([
      { def: 8, x: 0, y: 0, rotated: true, starter: true, equipped: false },
    ]);
  });

  it("verwirft einen halben Block statt einen Gegenstand ohne Lage zu erfinden", () => {
    expect(unflattenPacked([4, 1, 2, 0, 9, 9])).toHaveLength(1);
  });
});
