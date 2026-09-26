/**
 * Aufsaetze, Guertel, Verbrauchsgueter, Werkbank, Schutz im Rucksack.
 */

import { describe, expect, it } from "vitest";
import { ATTACHMENTS, CONSUMABLES, PLAYER, RECIPES, WEAPONS } from "../../src/config/balance";
import { itemIndex } from "../../src/config/items";
import { TICK_SECONDS } from "../../src/config/constants";
import { flattenPacked, packCarried, unflattenPacked } from "../../src/systems/backpackCodec";
import { damagePlayer } from "../../src/systems/combat";
import { attachInGrid, craft, craftAcross, detachInGrid, hasIngredients } from "../../src/systems/gear";
import { createWorld, stepWorld } from "../../src/systems/world";
import { Simulation } from "../../src/systems/Simulation";
import type { PackedItem, WorldState } from "../../src/systems/types";
import { activeWeapon, ammoCapacity } from "../../src/systems/weapons";
import { makeInput } from "../helpers";

const at = (id: string, x: number, y: number, extra: Partial<PackedItem> = {}): PackedItem => ({
  def: itemIndex(id),
  x,
  y,
  rotated: false,
  ...extra,
});

function world(backpack: PackedItem[]): WorldState {
  // Knoten-Gebiet: dort gibt es keine heilende Startzone, die das Leben
  // nebenbei auffuellt (die offene Welt hat eine).
  const state = createWorld([{ id: "p", name: "T", character: "scout", backpack }], 4242, { nodeId: null });
  state.enemies.length = 0;
  state.pendingSpawns.length = 0;
  return state;
}

function tick(state: WorldState, extra: Parameters<typeof makeInput>[1] = {}): void {
  stepWorld(state, new Map([["p", makeInput({ x: 0, y: 0 }, extra)]]), TICK_SECONDS);
}

describe("Aufsaetze", () => {
  it("setzt ein Visier auf das Gewehr und verlaengert die Reichweite", () => {
    const state = world([at("rifle", 0, 0, { equipped: true }), at("scope", 5, 0)]);
    const player = state.players[0]!;
    tick(state, { inventory: { op: "attach", fromX: 5, fromY: 0, toX: 0, toY: 0 } });
    expect(player.backpack.items).toHaveLength(1); // Das Visier sitzt jetzt auf der Waffe.
    expect(activeWeapon(player)?.range).toBeCloseTo(WEAPONS.rifle!.range * ATTACHMENTS.scope.range);
  });

  it("nimmt nur Aufsaetze an, fuer die die Waffe einen freien Platz hat", () => {
    const state = world([at("pistol", 0, 0, { equipped: true }), at("scope", 4, 0), at("barrel", 5, 0), at("barrel", 6, 0)]);
    const grid = state.players[0]!.backpack;
    expect(attachInGrid(grid, { x: 4, y: 0 }, { x: 0, y: 0 })).toBe(false); // Pistole hat kein Visier
    expect(attachInGrid(grid, { x: 5, y: 0 }, { x: 0, y: 0 })).toBe(true);
    expect(attachInGrid(grid, { x: 6, y: 0 }, { x: 0, y: 0 })).toBe(false); // Platz schon belegt
    expect(activeWeapon(state.players[0]!)?.damage).toBe(Math.round(WEAPONS.pistol!.damage * ATTACHMENTS.barrel.damage));
  });

  it("gibt mit dem Magazin zwei Ladungen mehr", () => {
    const state = world([at("smg", 0, 0, { equipped: true, mods: 0b0100 })]);
    const player = state.players[0]!;
    expect(ammoCapacity(player)).toBe(PLAYER.ammoCharges + ATTACHMENTS.mag.extraCharges);
    tick(state);
    expect(player.reloadTimers).toHaveLength(PLAYER.ammoCharges + ATTACHMENTS.mag.extraCharges);
  });

  it("nimmt einen Aufsatz wieder ab, wenn im Rucksack Platz ist", () => {
    const state = world([at("rifle", 0, 0, { equipped: true, mods: 0b0001 })]);
    const grid = state.players[0]!.backpack;
    expect(detachInGrid(grid, { x: 0, y: 0 }, 0)).toBe(true);
    expect(grid.items.some((entry) => entry.item.def === itemIndex("scope"))).toBe(true);
    expect(grid.items[0]?.item.mods ?? 0).toBe(0);
  });

  it("laesst Aufsaetze mitfallen, wenn die Waffe weggeworfen wird", () => {
    const state = world([at("rifle", 0, 0, { equipped: true, mods: 0b0101 })]);
    state.groundItems.length = 0;
    tick(state, { inventory: { op: "drop", fromX: 0, fromY: 0 } });
    const defs = state.groundItems.map((item) => item.def).sort();
    expect(defs).toEqual([itemIndex("rifle"), itemIndex("scope"), itemIndex("mag")].sort());
  });
});

describe("Guertel und Verbrauchsgueter", () => {
  it("wirkt nur aus dem Guertel, und der Verband heilt ueber drei Sekunden", () => {
    const state = world([at("bandage", 0, 0)]);
    const player = state.players[0]!;
    player.health = 100;
    // Im Rucksack: Benutzen geht ins Leere.
    tick(state, { inventory: { op: "use", slot: 0 } });
    expect(player.health).toBe(100);

    tick(state, { inventory: { op: "toBelt", fromX: 0, fromY: 0, slot: 0 } });
    expect(player.belt.items).toHaveLength(1);
    tick(state, { inventory: { op: "use", slot: 0 } });
    expect(player.belt.items).toHaveLength(0);
    for (let i = 0; i < (CONSUMABLES.bandage.seconds + 0.2) / TICK_SECONDS; i += 1) tick(state);
    expect(player.health).toBeCloseTo(100 + player.maxHealth * CONSUMABLES.bandage.healShare, 0);
  });

  it("heilt mit dem Medipack sofort und verschwendet ihn nicht bei vollem Leben", () => {
    const state = world([at("medkit", 0, 0, { belt: true })]);
    const player = state.players[0]!;
    tick(state, { inventory: { op: "use", slot: 0 } });
    expect(player.belt.items).toHaveLength(1); // volles Leben: bleibt im Guertel
    player.health = 200;
    tick(state, { inventory: { op: "use", slot: 0 } });
    expect(player.health).toBeCloseTo(200 + player.maxHealth * CONSUMABLES.medkit.healShare, 0);
  });

  it("laedt mit der Munitionskiste doppelt so schnell nach", () => {
    const state = world([at("pistol", 0, 0, { equipped: true }), at("ammoBox", 0, 0, { belt: true })]);
    const player = state.players[0]!;
    tick(state, { inventory: { op: "use", slot: 0 } });
    expect(player.fastReload).toBeGreaterThan(0);
    player.reloadTimers[0] = 1;
    tick(state);
    expect(player.reloadTimers[0]).toBeCloseTo(1 - 2 * TICK_SECONDS, 5);
  });

  it("reist mit Guertel und Aufsaetzen durch den Rucksack-Code", () => {
    const state = world([at("rifle", 0, 0, { equipped: true, mods: 0b1011 }), at("medkit", 2, 0, { belt: true })]);
    const player = state.players[0]!;
    const packed = packCarried(player.backpack, player.belt);
    const back = unflattenPacked(flattenPacked(packed));
    expect(back.find((entry) => entry.def === itemIndex("rifle"))?.mods).toBe(0b1011);
    expect(back.find((entry) => entry.def === itemIndex("medkit"))).toMatchObject({ belt: true, x: 2 });
  });
});

describe("Schutz im Rucksack", () => {
  it("nimmt keinen Schaden, solange der Rucksack offen ist", () => {
    const state = world([]);
    const player = state.players[0]!;
    tick(state, { shielded: true });
    const before = player.health;
    damagePlayer(state, player, 500);
    expect(player.health).toBe(before);
    tick(state, { shielded: false });
    damagePlayer(state, player, 500);
    expect(player.health).toBe(before - 500);
  });
});

describe("Rucksack in der Pause (solo)", () => {
  it("fuehrt Befehle sofort aus, ohne dass Zeit vergeht", () => {
    const simulation = new Simulation([{ id: "p", name: "T", character: "scout", backpack: [at("bandage", 0, 0)] }], 4242, {
      nodeId: null,
    });
    const before = simulation.state.tick;
    simulation.applyInventoryNow("p", { op: "toBelt", fromX: 0, fromY: 0, slot: 1 });
    expect(simulation.state.players[0]!.belt.items).toHaveLength(1);
    expect(simulation.state.tick).toBe(before);
  });
});

describe("Werkbank", () => {
  it("baut aus Material einen Verband und verbraucht die Zutaten", () => {
    const recipe = RECIPES.find((entry) => entry.result === "bandage")!;
    const items = [at("scrap", 0, 0), at("scrap", 1, 0), at("wire", 2, 0)];
    const result = craft(items, { width: 5, height: 3 }, recipe);
    expect(result?.map((entry) => entry.def).sort()).toEqual([itemIndex("wire"), itemIndex("bandage")].sort());
  });

  it("baut zuhause aus Lager und Rucksack zusammen, Ergebnis ins Lager", () => {
    const recipe = RECIPES.find((entry) => entry.result === "bandage")!;
    const stash = [at("scrap", 0, 0)];
    const backpack = [at("pistol", 0, 0, { equipped: true, starter: true }), at("scrap", 3, 0)];
    const result = craftAcross(
      [
        { items: stash, size: { width: 5, height: 6 } },
        { items: backpack, size: { width: 5, height: 3 } },
      ],
      recipe,
    );
    expect(result?.[0]?.map((entry) => entry.def)).toEqual([itemIndex("bandage")]);
    expect(result?.[1]?.map((entry) => entry.def)).toEqual([itemIndex("pistol")]);
  });

  it("baut nichts ohne Zutaten, und Starter-Stuecke zaehlen nicht", () => {
    const recipe = RECIPES.find((entry) => entry.result === "medkit")!;
    expect(hasIngredients([at("cell", 0, 0)], recipe)).toBe(false);
    expect(hasIngredients([at("cell", 0, 0), at("wire", 1, 0, { starter: true })], recipe)).toBe(false);
    expect(craft([at("cell", 0, 0)], { width: 5, height: 3 }, recipe)).toBeNull();
  });
});
