/**
 * Ausruestung jenseits der Waffe selbst (2026-09-26): Aufsaetze auf Waffen,
 * der Guertel mit Verbrauchsguetern, und die Werkbank am Rastplatz.
 *
 * Phaserfrei wie alles unter `systems/`: Der Host fuehrt die Befehle aus
 * (`loot.ts` -> `applyInventoryCommand`), der Packbildschirm und die Werkbank
 * benutzen dieselben Funktionen auf ihren eigenen Gittern.
 *
 * ================================================================
 * AUFSAETZE
 * ================================================================
 *
 * Jede Waffe hat feste Plaetze (`WEAPON_SLOTS`), je Art hoechstens einen. Ein
 * aufgesetzter Aufsatz verschwindet aus dem Gitter und steht als Bit an der
 * Waffe (`ItemInstance.mods`). Er braucht dann keinen Platz mehr und wandert
 * mit, wenn die Waffe umgeraeumt, weggeworfen oder gesichert wird. Abnehmen
 * legt ihn wieder als eigenen Gegenstand in den Rucksack.
 *
 * ================================================================
 * GUERTEL
 * ================================================================
 *
 * Ein eigenes 3x1-Gitter am Spieler, nur fuer Verbrauchsgueter. Nur was hier
 * steckt, laesst sich im Kampf per Knopf benutzen - der Verband tief im
 * Rucksack bleibt ein Verband im Rucksack.
 */

import { ATTACHMENTS, CONSUMABLES, INVENTORY, RECIPES, WEAPON_SLOTS } from "../config/balance";
import type { WeaponStats } from "../config/balance";
import { ATTACHMENT_KINDS, itemAt, itemIndex } from "../config/items";
import type { AttachmentKind } from "../config/items";
import { createGrid, findFreeSpot, place, removeAt } from "./InventoryGridSystem";
import type { InventoryGrid, ItemInstance, PackedItem, PlayerState, WorldState } from "./types";

// ---------------------------------------------------------------------------
// Aufsaetze
// ---------------------------------------------------------------------------

/** Das Bit einer Aufsatzart in `ItemInstance.mods`. */
export function kindBit(kind: AttachmentKind): number {
  return 1 << ATTACHMENT_KINDS.indexOf(kind);
}

/** Die Aufsatzart eines Gegenstands, oder `null`, wenn er keiner ist. */
export function attachmentKindOf(def: number): AttachmentKind | null {
  return itemAt(def)?.attachment ?? null;
}

/** Die festen Aufsatzplaetze einer Waffe (leer fuer alles andere). */
export function weaponSlots(def: number): readonly AttachmentKind[] {
  const id = itemAt(def)?.id;
  return (id && WEAPON_SLOTS[id]) || [];
}

export function hasMod(item: ItemInstance, kind: AttachmentKind): boolean {
  return ((item.mods ?? 0) & kindBit(kind)) !== 0;
}

/** Passt dieser Aufsatz auf diese Waffe - Platz vorhanden und frei? */
export function canAttach(weapon: ItemInstance, attachmentDef: number): boolean {
  const kind = attachmentKindOf(attachmentDef);
  return kind !== null && weaponSlots(weapon.def).includes(kind) && !hasMod(weapon, kind);
}

/**
 * Setzt den Aufsatz bei `from` auf die Waffe bei `to` (beides linke obere
 * Zellen im selben Gitter). Gibt zurueck, ob es geklappt hat.
 */
export function attachInGrid(
  grid: InventoryGrid,
  from: { x: number; y: number },
  to: { x: number; y: number },
): boolean {
  const attachmentIndex = grid.items.findIndex((entry) => entry.x === from.x && entry.y === from.y);
  const weapon = grid.items.find((entry) => entry.x === to.x && entry.y === to.y);
  const attachment = grid.items[attachmentIndex];
  if (!attachment || !weapon || !canAttach(weapon.item, attachment.item.def)) {
    return false;
  }
  const kind = attachmentKindOf(attachment.item.def) as AttachmentKind;
  weapon.item.mods = (weapon.item.mods ?? 0) | kindBit(kind);
  removeAt(grid, attachmentIndex);
  return true;
}

/**
 * Nimmt den Aufsatz der Art mit Nummer `kindIndex` von der Waffe bei `at`
 * und legt ihn an die erste freie Stelle. Kein Platz -> nichts passiert
 * (der Aufsatz bleibt auf der Waffe, statt zu verschwinden).
 */
export function detachInGrid(grid: InventoryGrid, at: { x: number; y: number }, kindIndex: number): boolean {
  const weapon = grid.items.find((entry) => entry.x === at.x && entry.y === at.y);
  const kind = ATTACHMENT_KINDS[kindIndex];
  if (!weapon || !kind || !hasMod(weapon.item, kind)) {
    return false;
  }
  const def = itemIndex(kind);
  const spot = findFreeSpot(grid, def);
  if (!spot) {
    return false;
  }
  weapon.item.mods = (weapon.item.mods ?? 0) & ~kindBit(kind);
  place(grid, { id: nextLocalId(grid), def }, spot.x, spot.y, spot.rotated);
  return true;
}

/** Eine Nummer, die in diesem Gitter noch frei ist. */
function nextLocalId(grid: InventoryGrid): number {
  return grid.items.reduce((max, entry) => Math.max(max, entry.item.id), 0) + 1;
}

/** Die Waffenwerte samt Aufsaetzen. */
export function modifiedStats(base: WeaponStats, mods: number | undefined): WeaponStats {
  // Ohne Aufsatz dieselben Werte (kein neues Objekt je Schuss).
  if (!mods) return base;
  const has = (kind: AttachmentKind): boolean => ((mods ?? 0) & kindBit(kind)) !== 0;
  return {
    ...base,
    range: has("scope") ? base.range * ATTACHMENTS.scope.range : base.range,
    damage: has("barrel") ? Math.round(base.damage * ATTACHMENTS.barrel.damage) : base.damage,
    spread: has("grip") ? base.spread * ATTACHMENTS.grip.spread : base.spread,
    reloadTime: has("grip") ? base.reloadTime * ATTACHMENTS.grip.reload : base.reloadTime,
  };
}

/** Zusaetzliche Munitionsladungen durch ein Magazin. */
export function extraCharges(mods: number | undefined): number {
  return ((mods ?? 0) & kindBit("mag")) !== 0 ? ATTACHMENTS.mag.extraCharges : 0;
}

// ---------------------------------------------------------------------------
// Guertel
// ---------------------------------------------------------------------------

export function createBelt(): InventoryGrid {
  return createGrid(INVENTORY.beltSize, 1);
}

export function isConsumable(def: number): boolean {
  return itemAt(def)?.type === "consumable";
}

/** Der Gegenstand im Guertelplatz `slot`, oder `undefined`. */
export function beltItem(belt: InventoryGrid, slot: number): ItemInstance | undefined {
  return belt.items.find((entry) => entry.x === slot)?.item;
}

/**
 * Legt einen Gegenstand in den Guertelplatz `slot`. Im Guertel belegt JEDER
 * Gegenstand genau einen Platz, egal wie gross er im Rucksack ist (ein
 * Medipack ist dort 2x2) - er haengt ja am Guertel, er liegt nicht darin.
 */
export function putInBelt(belt: InventoryGrid, item: ItemInstance, slot: number): boolean {
  if (slot < 0 || slot >= belt.width || beltItem(belt, slot) || !isConsumable(item.def)) {
    return false;
  }
  belt.items.push({ item, x: slot, y: 0, rotated: false });
  return true;
}

/** Verbrauchsgut aus dem Rucksack in einen freien Guertelplatz. */
export function moveToBelt(
  backpack: InventoryGrid,
  belt: InventoryGrid,
  from: { x: number; y: number },
  slot: number,
): boolean {
  const index = backpack.items.findIndex((entry) => entry.x === from.x && entry.y === from.y);
  const entry = backpack.items[index];
  if (!entry || !putInBelt(belt, entry.item, slot)) {
    return false;
  }
  removeAt(backpack, index);
  return true;
}

/** Aus dem Guertel an eine Stelle im Rucksack (dort muss Platz sein). */
export function moveFromBelt(
  belt: InventoryGrid,
  backpack: InventoryGrid,
  slot: number,
  at: { x: number; y: number; rotated: boolean },
): boolean {
  const index = belt.items.findIndex((entry) => entry.x === slot);
  const entry = belt.items[index];
  if (!entry || !place(backpack, entry.item, at.x, at.y, at.rotated)) {
    return false;
  }
  removeAt(belt, index);
  return true;
}

/**
 * Benutzt den Gegenstand im Guertelplatz `slot`. Am Boden liegend geht es
 * nicht (dafuer gibt es die Wiederbelebung). Gibt zurueck, ob etwas
 * verbraucht wurde.
 */
export function useBeltItem(state: WorldState, player: PlayerState, slot: number): boolean {
  if (player.down) {
    return false;
  }
  const index = player.belt.items.findIndex((entry) => entry.x === slot);
  const entry = player.belt.items[index];
  const id = entry ? itemAt(entry.item.def)?.id : undefined;
  if (!entry || !id) {
    return false;
  }

  if (id === "bandage" || id === "medkit") {
    const effect = CONSUMABLES[id];
    const amount = player.maxHealth * effect.healShare;
    if (player.health >= player.maxHealth) {
      return false; // Nichts zu heilen - nicht verschwenden.
    }
    if (effect.seconds > 0) {
      player.regenPerSecond = amount / effect.seconds;
      player.regenTime = effect.seconds;
    } else {
      const healed = Math.min(amount, player.maxHealth - player.health);
      player.health += healed;
      state.events.push({ type: "healed", playerId: player.id, amount: Math.round(healed), x: player.position.x, y: player.position.y });
    }
  } else if (id === "ammoBox") {
    player.fastReload = CONSUMABLES.ammoBox.fastReloadSeconds;
  } else {
    return false;
  }
  removeAt(player.belt, index);
  return true;
}

/** Laufende Wirkungen: Heilung ueber Zeit, schnelles Nachladen. */
export function stepGear(state: WorldState, player: PlayerState, dt: number): void {
  if (player.fastReload > 0) {
    player.fastReload = Math.max(0, player.fastReload - dt);
  }
  if (player.regenTime <= 0) {
    return;
  }
  // Wer faellt, dessen Verband ist hin - wie im echten Leben unterbrochen.
  if (player.down) {
    player.regenTime = 0;
    return;
  }
  const step = Math.min(dt, player.regenTime);
  player.regenTime -= step;
  const healed = Math.min(player.regenPerSecond * step, player.maxHealth - player.health);
  player.health += healed;
  if (player.regenTime <= 0 && healed >= 0) {
    state.events.push({
      type: "healed",
      playerId: player.id,
      amount: Math.round(player.regenPerSecond * CONSUMABLES.bandage.seconds),
      x: player.position.x,
      y: player.position.y,
    });
  }
}

// ---------------------------------------------------------------------------
// Werkbank
// ---------------------------------------------------------------------------

export type Recipe = (typeof RECIPES)[number];

/** Hat der Rucksack alle Zutaten? (Starter-Stuecke zaehlen nicht.) */
export function hasIngredients(items: readonly PackedItem[], recipe: Recipe): boolean {
  const pool = items.filter((entry) => !entry.starter && !entry.belt).map((entry) => entry.def);
  for (const need of recipe.needs) {
    const at = pool.indexOf(itemIndex(need));
    if (at < 0) return false;
    pool.splice(at, 1);
  }
  return true;
}

/** Ein Ort, aus dem die Werkbank nimmt und in den sie legt. */
export interface CraftStore {
  items: readonly PackedItem[];
  size: { width: number; height: number };
}

/**
 * Baut ein Rezept ueber mehrere Orte hinweg (2026-09-26): im Packbildschirm
 * Lager und Rucksack zusammen. Zutaten werden in der Reihenfolge der Orte
 * entnommen, das Ergebnis kommt an die erste freie Stelle des ersten Ortes,
 * der Platz hat. Gibt die neuen Listen zurueck (gleiche Reihenfolge), oder
 * `null`, wenn Zutaten oder Platz fehlen.
 */
export function craftAcross(stores: readonly CraftStore[], recipe: Recipe): PackedItem[][] | null {
  if (!hasIngredients(stores.flatMap((store) => store.items), recipe)) {
    return null;
  }
  const lists = stores.map((store) => store.items.map((entry) => ({ ...entry })));
  for (const need of recipe.needs) {
    const def = itemIndex(need);
    for (const list of lists) {
      const at = list.findIndex((entry) => entry.def === def && !entry.starter && !entry.belt);
      if (at >= 0) {
        list.splice(at, 1);
        break;
      }
    }
  }

  // Platz suchen im Gitter, wie es nach dem Entnehmen aussieht.
  const def = itemIndex(recipe.result);
  for (let index = 0; index < lists.length; index += 1) {
    const list = lists[index]!;
    const size = stores[index]!.size;
    const grid = createGrid(size.width, size.height);
    let id = 1;
    for (const entry of list) {
      if (!entry.belt) place(grid, { id: id++, def: entry.def }, entry.x, entry.y, entry.rotated);
    }
    const spot = findFreeSpot(grid, def);
    if (spot) {
      list.push({ def, x: spot.x, y: spot.y, rotated: spot.rotated });
      return lists;
    }
  }
  return null;
}

/**
 * Baut ein Rezept in EINEM Rucksack: Zutaten raus, Ergebnis an die erste
 * freie Stelle. Gibt den neuen Rucksack zurueck, oder `null`, wenn Zutaten
 * oder Platz fehlen. Arbeitet auf der gepackten Form, wie sie zwischen zwei
 * Gebieten im Run liegt (`RunState.players[].backpack`).
 */
export function craft(
  items: readonly PackedItem[],
  size: { width: number; height: number },
  recipe: Recipe,
): PackedItem[] | null {
  return craftAcross([{ items, size }], recipe)?.[0] ?? null;
}
