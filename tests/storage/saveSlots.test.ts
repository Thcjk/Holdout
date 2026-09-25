/**
 * Spielstaende: schreiben, lesen, drei Plaetze, kaputte Eintraege.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { itemIndex } from "../../src/config/items";
import { backpackForNextRun, resetCarried, saveStash, stashItems } from "../../src/storage/carried";
import {
  SLOT_COUNT,
  deleteSlot,
  listSlots,
  loadSlot,
  readSlot,
  resetActiveSlot,
  saveActive,
  setActiveCharacter,
  startNewSlot,
} from "../../src/storage/saveSlots";
import type { KeyValueStore } from "../../src/storage/saveSlots";
import { createRun, enterNode, reachableNodes } from "../../src/systems/run";
import { armed } from "../helpers";

/** Ein Speicher wie `localStorage`, nur im Arbeitsspeicher. */
function fakeStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

beforeEach(() => {
  resetCarried();
  resetActiveSlot();
});

describe("Spielstaende", () => {
  it("legt einen neuen Stand leer an", () => {
    const store = fakeStore();
    startNewSlot(1, "tank", store);
    const save = readSlot(1, store);
    expect(save?.character).toBe("tank");
    expect(save?.stash).toEqual([]);
    expect(save?.run).toBeNull();
    expect(listSlots(store).map((slot) => slot !== null)).toEqual([false, true, false]);
    expect(SLOT_COUNT).toBe(3);
  });

  it("sichert Lager und laufenden Run und stellt beides wieder her", () => {
    const store = fakeStore();
    startNewSlot(0, "scout", store);
    saveStash([{ def: itemIndex("rifle"), x: 0, y: 0, rotated: false }]);
    const run = createRun(4242, [{ id: "p", name: "Solo", character: "scout", backpack: armed() }]);
    enterNode(run, (reachableNodes(run)[0] as { id: number }).id);
    run.players[0]!.health = 900;
    saveActive(run, store);

    // Neustart der App: Arbeitsspeicher leer, dann laden.
    resetCarried();
    resetActiveSlot();
    const loaded = loadSlot(0, store);
    expect(stashItems()).toHaveLength(1);
    expect(loaded?.run?.current).toBe(run.current);
    expect(loaded?.run?.visited).toEqual(run.visited);
    expect(loaded?.run?.players[0]?.health).toBe(900);
    // Die Karte kommt aus dem Seed, nicht aus dem Speicher - und ist dieselbe.
    expect(loaded?.run?.map).toEqual(run.map);
  });

  it("haelt die drei Plaetze auseinander", () => {
    const store = fakeStore();
    startNewSlot(0, "scout", store);
    saveStash([{ def: itemIndex("smg"), x: 0, y: 0, rotated: false }]);
    saveActive(null, store);
    startNewSlot(2, "sniper", store);
    expect(stashItems()).toHaveLength(0);
    setActiveCharacter("tank");
    saveActive(null, store);
    expect(readSlot(0, store)?.stash).toHaveLength(1);
    expect(readSlot(2, store)?.character).toBe("tank");
    expect(readSlot(2, store)?.stash).toHaveLength(0);
  });

  it("behandelt einen kaputten Eintrag wie einen leeren Platz", () => {
    const store = fakeStore();
    store.setItem("holdout.save.1", "{kaputt");
    expect(readSlot(1, store)).toBeNull();
    store.setItem("holdout.save.1", JSON.stringify({ version: 99, character: "scout" }));
    expect(readSlot(1, store)).toBeNull();
  });

  it("loescht einen Platz und schreibt ohne aktiven Platz nichts", () => {
    const store = fakeStore();
    startNewSlot(0, "scout", store);
    deleteSlot(0, store);
    expect(readSlot(0, store)).toBeNull();
    saveActive(null, store);
    expect(store.data.size).toBe(0);
  });

  it("bringt den Rucksack nach einem Erfolg mit", () => {
    const store = fakeStore();
    startNewSlot(0, "scout", store);
    const pistol = { def: itemIndex("pistol"), x: 1, y: 0, rotated: false, equipped: true };
    // Wie nach `finishRun` mit Erfolg: Rucksack fuer den naechsten Run.
    loadSlot(0, store);
    store.setItem(
      "holdout.save.0",
      JSON.stringify({ ...readSlot(0, store), backpack: [pistol] }),
    );
    loadSlot(0, store);
    expect(backpackForNextRun()).toEqual([pistol]);
  });
});
