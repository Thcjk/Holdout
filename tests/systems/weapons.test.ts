/**
 * Die ausgeruestete Waffe bestimmt den Basisangriff - ohne Waffe die Faust.
 */

import { describe, expect, it } from "vitest";
import { FIST, INVENTORY, WEAPONS } from "../../src/config/balance";
import { ITEMS, itemIndex } from "../../src/config/items";
import { TICK_SECONDS } from "../../src/config/constants";
import { ammoCount, tryShoot } from "../../src/systems/combat";
import { createEnemy } from "../../src/systems/enemies";
import { dropItem } from "../../src/systems/loot";
import { activeProjectileCount } from "../../src/systems/projectiles";
import { createWorld, stepWorld } from "../../src/systems/world";
import type { PlayerSetup } from "../../src/systems/world";
import {
  activeWeapon,
  attackLabel,
  equippedEntry,
  settleEquipped,
} from "../../src/systems/weapons";
import type { InputState, PackedItem, PlayerState, WorldState } from "../../src/systems/types";
import { armed, makeInput } from "../helpers";

function world(backpack?: PackedItem[]): { state: WorldState; player: PlayerState } {
  const setups: PlayerSetup[] = [{ id: "p1", name: "Test", character: "scout", backpack }];
  const state = createWorld(setups, 4242);
  state.enemies.length = 0;
  state.groundItems.length = 0;
  state.walls.length = 0;
  const player = state.players[0]!;
  player.facing = { x: 1, y: 0 };
  return { state, player };
}

const FIRE_RIGHT = makeInput({ x: 0, y: 0 }, { aim: { x: 1, y: 0 }, fire: true });

function step(state: WorldState, input: InputState): void {
  stepWorld(state, new Map([["p1", input]]), TICK_SECONDS);
}

describe("Waffenwerte", () => {
  it("hat fuer jede Waffe im Katalog Kampfwerte", () => {
    for (const item of ITEMS.filter((entry) => entry.type === "weapon")) {
      expect(WEAPONS[item.id], item.id).toBeDefined();
    }
  });

  it("gibt dem Starter-Set eine Waffe mit", () => {
    const weapons = INVENTORY.starterSet.filter((id) => WEAPONS[id] !== undefined);
    expect(weapons.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Schiessen mit der ausgeruesteten Waffe", () => {
  it("nimmt Schaden, Reichweite und Kugelzahl aus der Waffe", () => {
    for (const id of ["pistol", "smg", "rifle", "railgun"]) {
      const { state, player } = world(armed(id));
      expect(tryShoot(state, player, FIRE_RIGHT)).toBe(true);
      const stats = WEAPONS[id]!;
      const shots = state.projectiles.filter((entry) => entry.active);
      expect(shots, id).toHaveLength(stats.bullets);
      expect(shots[0]?.damage, id).toBe(stats.damage);
      expect(shots[0]?.piercing, id).toBe(stats.piercing);
      expect(player.shootCooldown, id).toBe(stats.cooldown);
    }
  });

  it("laedt mit der Nachladezeit der Waffe nach", () => {
    const { state, player } = world(armed("rifle"));
    tryShoot(state, player, FIRE_RIGHT);
    expect(Math.max(...player.reloadTimers)).toBe(WEAPONS.rifle!.reloadTime);
  });

  it("wechselt die Werte mit dem Ausruesten-Befehl", () => {
    const { state, player } = world([
      { def: itemIndex("pistol"), x: 0, y: 0, rotated: false, equipped: true },
      { def: itemIndex("railgun"), x: 0, y: 2, rotated: false },
    ]);
    expect(activeWeapon(player)).toBe(WEAPONS.pistol);

    step(state, makeInput({ x: 0, y: 0 }, { inventory: { op: "equip", fromX: 0, fromY: 2 } }));

    expect(activeWeapon(player)).toBe(WEAPONS.railgun);
    expect(player.backpack.items.filter((entry) => entry.item.equipped)).toHaveLength(1);
    expect(attackLabel(player)).toBe("RAILGUN");
  });

  it("ignoriert Ausruesten auf etwas, das keine Waffe ist", () => {
    const { state, player } = world([
      { def: itemIndex("pistol"), x: 0, y: 0, rotated: false, equipped: true },
      { def: itemIndex("bandage"), x: 0, y: 2, rotated: false },
    ]);
    step(state, makeInput({ x: 0, y: 0 }, { inventory: { op: "equip", fromX: 0, fromY: 2 } }));
    expect(activeWeapon(player)).toBe(WEAPONS.pistol);
  });
});

describe("Ohne Waffe: der Faustschlag", () => {
  function unarmedWith(enemyAt: { dx: number; dy: number }) {
    const { state, player } = world([]);
    const enemy = createEnemy(
      1,
      "brute",
      { x: player.position.x + enemyAt.dx, y: player.position.y + enemyAt.dy },
      1,
      1,
      false,
    );
    state.enemies.push(enemy);
    return { state, player, enemy };
  }

  it("trifft einen Gegner vor der Figur, ohne Geschoss und ohne Munition", () => {
    const { state, player, enemy } = unarmedWith({ dx: 18 + 30 + FIST.reach - 5, dy: 0 });
    expect(attackLabel(player)).toBe("FAUST");

    expect(tryShoot(state, player, FIRE_RIGHT)).toBe(true);

    expect(activeProjectileCount(state)).toBe(0);
    expect(enemy.maxHealth - enemy.health).toBe(FIST.damage);
    expect(ammoCount(player)).toBe(player.reloadTimers.length);
    expect(player.shootCooldown).toBe(FIST.cooldown);
    expect(state.events.some((event) => event.type === "punch" && event.hit)).toBe(true);
  });

  it("schlaegt ins Leere, wenn der Gegner zu weit weg ist", () => {
    const { state, player, enemy } = unarmedWith({ dx: 18 + 30 + FIST.reach + 20, dy: 0 });
    tryShoot(state, player, FIRE_RIGHT);
    expect(enemy.health).toBe(enemy.maxHealth);
    expect(state.events.some((event) => event.type === "punch" && !event.hit)).toBe(true);
  });

  it("trifft nicht, was hinter der Figur steht", () => {
    const { state, enemy, player } = unarmedWith({ dx: -(18 + 30 + 20), dy: 0 });
    tryShoot(state, player, FIRE_RIGHT);
    expect(enemy.health).toBe(enemy.maxHealth);
  });

  it("findet ohne Zielangabe den Gegner direkt daneben", () => {
    const { state, player, enemy } = unarmedWith({ dx: 0, dy: -(18 + 30 + 30) });
    tryShoot(state, player, makeInput({ x: 0, y: 0 }, { fire: true }));
    expect(enemy.health).toBeLessThan(enemy.maxHealth);
  });
});

describe("Automatik beim Ausruesten", () => {
  it("haelt hoechstens eine Waffe ausgeruestet", () => {
    const { player } = world([
      { def: itemIndex("pistol"), x: 0, y: 0, rotated: false, equipped: true },
      { def: itemIndex("smg"), x: 0, y: 2, rotated: false, equipped: true },
    ]);
    expect(player.backpack.items.filter((entry) => entry.item.equipped)).toHaveLength(1);
  });

  it("ruestet eine eingepackte Waffe ohne Haken von selbst aus", () => {
    const { player } = world([{ def: itemIndex("smg"), x: 0, y: 0, rotated: false }]);
    expect(activeWeapon(player)).toBe(WEAPONS.smg);
  });

  it("ruestet eine aufgehobene Waffe aus, wenn man keine hat", () => {
    const { state, player } = world([]);
    dropItem(state, itemIndex("rifle"), player.position);
    step(state, makeInput({ x: 0, y: 0 }));
    expect(activeWeapon(player)).toBe(WEAPONS.rifle);
  });

  it("tauscht beim Aufheben NICHT die Waffe, die man in der Hand hat", () => {
    const { state, player } = world(armed("pistol"));
    dropItem(state, itemIndex("railgun"), player.position);
    step(state, makeInput({ x: 0, y: 0 }));
    expect(player.backpack.items).toHaveLength(2);
    expect(activeWeapon(player)).toBe(WEAPONS.pistol);
  });

  it("laesst die naechste Waffe einspringen, wenn man die aktive wegwirft", () => {
    const { state, player } = world([
      { def: itemIndex("pistol"), x: 0, y: 0, rotated: false, equipped: true },
      { def: itemIndex("smg"), x: 0, y: 2, rotated: false },
    ]);
    step(state, makeInput({ x: 0, y: 0 }, { inventory: { op: "drop", fromX: 0, fromY: 0 } }));
    expect(activeWeapon(player)).toBe(WEAPONS.smg);

    step(state, makeInput({ x: 0, y: 0 }, { inventory: { op: "drop", fromX: 0, fromY: 2 } }));
    expect(activeWeapon(player)).toBeNull();
    expect(attackLabel(player)).toBe("FAUST");
  });

  it("nimmt einem Nicht-Waffen-Gegenstand das Merkmal", () => {
    const { player } = world([]);
    player.backpack.items.push({
      item: { id: 99, def: itemIndex("bandage"), equipped: true },
      x: 0,
      y: 0,
      rotated: false,
    });
    settleEquipped(player.backpack);
    expect(equippedEntry(player.backpack)).toBeNull();
  });
});
