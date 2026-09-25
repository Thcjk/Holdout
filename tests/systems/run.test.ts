/**
 * Ein Run auf der Knoten-Karte: waehlen, Gebiet verlassen, Rast, Timer.
 */

import { describe, expect, it } from "vitest";
import { DIFFICULTY, ENCOUNTERS, INVENTORY } from "../../src/config/balance";
import { itemIndex } from "../../src/config/items";
import { nextSize, startSize } from "../../src/systems/InventoryGridSystem";
import { dropItem } from "../../src/systems/loot";
import { TICK_SECONDS } from "../../src/config/constants";
import { REGIONS, placeName, regionOfLayer } from "../../src/config/story";
import type { MapNode } from "../../src/systems/NodeMapGenerator";
import {
  canEnter,
  completeNode,
  createRun,
  currentNode,
  enterNode,
  reachableNodes,
} from "../../src/systems/run";
import { createWorld, stepWorld } from "../../src/systems/world";
import { armed, makeInput } from "../helpers";
import { toNetPlayers, toSetups } from "../../src/net/Lobby";

const SETUP = [{ id: "p1", name: "Test", character: "scout" as const, backpack: armed() }];

describe("Run auf der Karte", () => {
  it("startet am Start und bietet nur dessen Nachfolger an", () => {
    const run = createRun(4242, SETUP);
    expect(currentNode(run).type).toBe("start");
    const options = reachableNodes(run);
    expect(options.length).toBeGreaterThanOrEqual(2);
    for (const node of options) {
      expect(node.layer).toBe(1);
    }
    // Ein Knoten weiter hinten ist nicht waehlbar.
    const far = run.map.nodes.find((node) => node.layer === 3) as MapNode;
    expect(canEnter(run, far.id)).toBe(false);
    expect(() => enterNode(run, far.id)).toThrow();
  });

  it("geht nur vorwaerts und merkt sich den Weg", () => {
    const run = createRun(4242, SETUP);
    const first = reachableNodes(run)[0] as MapNode;
    expect(enterNode(run, first.id)).toBe("fight");
    expect(run.current).toBe(first.id);
    expect(run.visited).toEqual([run.map.startId, first.id]);
    for (const node of reachableNodes(run)) {
      expect(node.layer).toBe(first.layer + 1);
    }
  });

  it("uebernimmt Rucksack und Leben aus dem Gebiet", () => {
    const run = createRun(4242, SETUP);
    enterNode(run, (reachableNodes(run)[0] as MapNode).id);
    completeNode(
      run,
      [{ id: "p1", health: 700, down: false, backpack: [{ def: 0, x: 3, y: 1, rotated: false }] }],
      () => 2400,
    );
    expect(run.day).toBe(1);
    expect(run.players[0]?.health).toBe(700);
    expect(run.players[0]?.backpack).toEqual([{ def: 0, x: 3, y: 1, rotated: false }]);
  });

  it("nimmt einen am Boden Liegenden mit einem Viertel Leben mit", () => {
    const run = createRun(4242, SETUP);
    completeNode(run, [{ id: "p1", health: 0, down: true, backpack: [] }], () => 2400);
    expect(run.players[0]?.health).toBe(600);
  });

  it("heilt an einem Rastplatz alle voll, ohne Kampf", () => {
    // Einen Rastplatz suchen, der von einem Vorgaenger aus erreichbar ist.
    const run = createRun(4242, SETUP);
    const rest = run.map.nodes.find((node) => node.type === "rest") as MapNode;
    const parent = run.map.nodes.find((node) => node.next.includes(rest.id)) as MapNode;
    run.current = parent.id;
    run.players[0]!.health = 300;
    expect(enterNode(run, rest.id)).toBe("rest");
    expect(run.players[0]?.health).toBeUndefined();
  });
});

describe("Gebiet eines Knotens", () => {
  it("fuehrt ueber den Ausgang zurueck zur Karte (exited), nicht zum Run-Ende", () => {
    const run = createRun(4242, SETUP);
    const node = reachableNodes(run)[0] as MapNode;
    const state = createWorld(SETUP, run.seed, { nodeId: node.id });
    expect(state.exitOutcome).toBe("exited");
    const exit = state.extractions[0]!;
    state.enemies.length = 0;
    state.players[0]!.position = { ...exit.position };
    for (let t = 0; t < (ENCOUNTERS.extractionSeconds + 0.5) / TICK_SECONDS; t += 1) {
      state.players[0]!.position = { ...exit.position };
      stepWorld(state, new Map([["p1", makeInput({ x: 0, y: 0 })]]), TICK_SECONDS);
    }
    expect(state.outcome).toBe("exited");
  });

  it("beendet den Run im Extraktions-Knoten mit gesicherter Beute", () => {
    const run = createRun(4242, SETUP);
    const node = run.map.nodes.find((entry) => entry.type === "extraction") as MapNode;
    const state = createWorld(SETUP, run.seed, { nodeId: node.id });
    expect(state.exitOutcome).toBe("extracted");
  });

  it("bringt nach Ablauf des Timers die Horde, ohne den Run zu beenden", () => {
    const run = createRun(4242, SETUP);
    const node = reachableNodes(run)[0] as MapNode;
    const state = createWorld(SETUP, run.seed, { nodeId: node.id });
    expect(state.nodeTimer).toBe(DIFFICULTY.nodeTimerBase + DIFFICULTY.nodeTimerPerDanger * node.danger);
    state.nodeTimer = TICK_SECONDS;
    stepWorld(state, new Map([["p1", makeInput({ x: 0, y: 0 })]]), TICK_SECONDS);
    expect(state.horde).toBe(true);
    expect(state.phase).toBe("running");
  });

  it("uebernimmt das mitgebrachte Leben", () => {
    const state = createWorld([{ ...SETUP[0]!, health: 500 }], 4242, { nodeId: null });
    expect(state.players[0]?.health).toBe(500);
  });
});

describe("Koop: Stand der Spieler im move-Paket", () => {
  it("kommt verlustfrei an - Rucksack samt ausgeruesteter Waffe und Leben", () => {
    const run = createRun(4242, [
      { id: "h", name: "Host", character: "tank", backpack: armed("smg"), health: 1234 },
      { id: "c", name: "Client", character: "sniper", backpack: armed("rifle") },
    ]);
    const back = toSetups(toNetPlayers(run.players, "h"));
    // `starter: false` kommt nach der Rundreise ausdruecklich mit - gleicher Inhalt.
    expect(back).toMatchObject(run.players);
    expect(back[0]?.health).toBe(1234);
    expect(back[1]?.backpack?.[0]?.equipped).toBe(true);
  });
});

describe("Story", () => {
  it("teilt die Karte in vier Regionen von Stadtrand bis Kueste", () => {
    const run = createRun(4242, SETUP);
    const depth = run.map.depth;
    expect(regionOfLayer(0, depth).name).toBe(REGIONS[0]?.name);
    expect(regionOfLayer(depth - 1, depth).name).toBe(REGIONS[REGIONS.length - 1]?.name);
  });

  it("gibt jedem Knoten einen festen Namen - gleich auf jedem Geraet", () => {
    const run = createRun(4242, SETUP);
    for (const node of run.map.nodes) {
      const name = placeName(node, run.map.depth, run.seed);
      expect(name.length).toBeGreaterThan(0);
      expect(placeName(node, run.map.depth, run.seed)).toBe(name);
    }
  });
});

describe("Rucksack waechst im Run", () => {
  it("beginnt klein und waechst Stufe fuer Stufe bis zum vollen Rucksack", () => {
    const start = startSize();
    expect(start.width * start.height).toBeLessThan(INVENTORY.width * INVENTORY.height);
    let size: { width: number; height: number } | null = start;
    let steps = 0;
    while (size) {
      const next = nextSize(size);
      if (!next) break;
      expect(next.width * next.height).toBeGreaterThan(size.width * size.height);
      size = next;
      steps += 1;
    }
    expect(size).toEqual({ width: INVENTORY.width, height: INVENTORY.height });
    expect(steps).toBe(INVENTORY.growth.length - 1);
  });

  it("gibt jedem Spieler im Run den kleinen Rucksack", () => {
    const run = createRun(4242, SETUP);
    expect(run.players[0]?.backpackSize).toEqual(startSize());
    const state = createWorld(run.players, run.seed, { nodeId: null });
    expect(state.players[0]?.backpack.width).toBe(startSize().width);
  });

  it("vergroessert ihn mit einer aufgehobenen Tasche, statt sie einzupacken", () => {
    const state = createWorld([{ ...SETUP[0]!, backpackSize: startSize() }], 4242, { nodeId: null });
    state.groundItems.length = 0;
    const player = state.players[0]!;
    const before = player.backpack.items.length;
    dropItem(state, itemIndex("pouch"), player.position);
    stepWorld(state, new Map([["p1", makeInput({ x: 0, y: 0 })]]), TICK_SECONDS);
    expect(player.backpack.width * player.backpack.height).toBeGreaterThan(
      startSize().width * startSize().height,
    );
    expect(player.backpack.items.length).toBe(before);
    expect(state.groundItems).toHaveLength(0);
    expect(state.events.some((event) => event.type === "backpackGrown")).toBe(true);
  });

  it("laesst die Tasche liegen, wenn der Rucksack voll ausgebaut ist", () => {
    const state = createWorld(SETUP, 4242, { nodeId: null });
    state.groundItems.length = 0;
    dropItem(state, itemIndex("pouch"), state.players[0]!.position);
    stepWorld(state, new Map([["p1", makeInput({ x: 0, y: 0 })]]), TICK_SECONDS);
    expect(state.groundItems).toHaveLength(1);
  });

  it("waechst am Rastplatz und reist ins naechste Gebiet mit", () => {
    const run = createRun(4242, SETUP);
    const rest = run.map.nodes.find((node) => node.type === "rest") as MapNode;
    run.current = (run.map.nodes.find((node) => node.next.includes(rest.id)) as MapNode).id;
    enterNode(run, rest.id);
    expect(run.players[0]?.backpackSize).toEqual(nextSize(startSize()));
    completeNode(
      run,
      [{ id: "p1", health: 100, down: false, backpack: [], size: { width: 7, height: 5 } }],
      () => 2400,
    );
    expect(run.players[0]?.backpackSize).toEqual({ width: 7, height: 5 });
  });
});
