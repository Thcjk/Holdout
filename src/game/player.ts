/**
 * Ein Spieler: anlegen, Werte aktualisieren, Erfahrung sammeln.
 */

import { ARENA, SHOP_SLOTS } from "./constants";
import { CHARACTERS } from "./data/characters";
import { ITEMS } from "./data/items";
import { computeStats } from "./data/stats";
import { UPGRADES } from "./data/upgrades";
import type { PlayerSetup, PlayerState } from "./types";

/** Erfahrung, die fuer den naechsten Stufenaufstieg gebraucht wird. */
export function xpNeeded(level: number): number {
  return 7 + 5 * level;
}

export function recomputeStats(player: PlayerState): void {
  player.stats = computeStats(player.character, player.items, player.upgrades);
}

/** Startpositionen nebeneinander in der Mitte, damit sich niemand im Koop stapelt. */
export function startPosition(index: number, total: number): { x: number; y: number } {
  const spacing = 60;
  const offset = (index - (total - 1) / 2) * spacing;
  return { x: ARENA.width / 2 + offset, y: ARENA.height / 2 };
}

export function createPlayer(setup: PlayerSetup, index: number, total: number): PlayerState {
  const start = startPosition(index, total);
  const player: PlayerState = {
    id: setup.id,
    name: setup.name,
    character: setup.character,
    x: start.x,
    y: start.y,
    hp: 1,
    alive: true,
    iframes: 0,
    facing: 0,
    weapons: [{ id: setup.startWeapon, tier: 1, cd: 0.3 }],
    items: ITEMS.map(() => 0),
    upgrades: UPGRADES.map(() => 0),
    gold: 0,
    xp: 0,
    level: 0,
    pendingLevels: 0,
    shop: {
      offers: Array.from({ length: SHOP_SLOTS }, () => null),
      locked: Array.from({ length: SHOP_SLOTS }, () => false),
      rerolls: 0,
      upgradeChoices: null,
    },
    ready: false,
    lastCmd: 0,
    kills: 0,
    stats: computeStats(setup.character, [], []),
    regenCarry: 0,
  };
  player.hp = player.stats.maxHp;
  return player;
}

/** Wie viele Waffen dieser Spieler tragen darf. */
export function weaponSlots(player: PlayerState): number {
  return CHARACTERS[player.character].slots;
}

/**
 * Erfahrung gutschreiben. Jede volle Stufe merkt ein Level-Up vor, das die
 * Pause zwischen den Wellen zur Auswahl anbietet.
 *
 * @returns wie viele Stufen dabei aufgestiegen sind
 */
export function grantXp(player: PlayerState, amount: number): number {
  player.xp += amount;
  let gained = 0;
  while (player.xp >= xpNeeded(player.level)) {
    player.xp -= xpNeeded(player.level);
    player.level += 1;
    player.pendingLevels += 1;
    gained += 1;
  }
  return gained;
}
