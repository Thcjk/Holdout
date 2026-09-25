/**
 * Welche Waffe ist ausgeruestet - und was folgt daraus fuer den Kampf.
 *
 * Phaserfrei wie alles unter `systems/`: Der Host rechnet damit fuer alle,
 * der Packbildschirm benutzt dieselben Regeln.
 *
 * ================================================================
 * DIE WAFFE STEHT IM RUCKSACK, NICHT AM SPIELER
 * ================================================================
 *
 * Ausgeruestet ist der Gegenstand, der `equipped` traegt - hoechstens einer.
 * Es gibt kein zweites Feld am Spieler, das auf ihn zeigt. Zwei Stellen, die
 * dasselbe sagen, laufen auseinander: Man wirft die Waffe weg, und der
 * Spieler schiesst weiter mit ihr.
 *
 * ================================================================
 * DIE AUTOMATIK
 * ================================================================
 *
 * `settleEquipped` bringt einen Rucksack in Ordnung:
 *   - mehr als eine ausgeruestet -> nur die erste bleibt
 *   - keine ausgeruestet, aber eine Waffe dabei -> die erste wird es
 *
 * Aufgerufen wird es nach allem, was den Rucksack aendert: beim Aufbau
 * (Packen), beim Aufheben, beim Wegwerfen. Folge: Wer ohne Waffe eine
 * aufhebt, hat sie sofort in der Hand; wer die aktive wegwirft, bekommt die
 * naechste. Die Faust gibt es nur, wenn wirklich keine Waffe dabei ist.
 */

import { FIST, PLAYER, WEAPONS } from "../config/balance";
import { extraCharges, modifiedStats } from "./gear";
import type { WeaponStats } from "../config/balance";
import { itemAt } from "../config/items";
import type { InventoryGrid, PlacedItem, PlayerState } from "./types";

/** Ist dieser Katalogeintrag eine Waffe mit Kampfwerten? */
export function isWeapon(def: number): boolean {
  const item = itemAt(def);
  return item !== null && item.type === "weapon" && WEAPONS[item.id] !== undefined;
}

/** Der ausgeruestete Eintrag eines Gitters, oder `null`. */
export function equippedEntry(grid: InventoryGrid): PlacedItem | null {
  return grid.items.find((entry) => entry.item.equipped === true) ?? null;
}

/**
 * Womit der Spieler gerade angreift.
 *
 * `null` heisst Faust. Bewusst kein Pseudo-Eintrag "Faust" in `WEAPONS`: Die
 * Faust schiesst nicht, sie trifft direkt - ein anderer Ablauf, kein anderer
 * Zahlensatz.
 */
export function activeWeapon(player: PlayerState): WeaponStats | null {
  const entry = equippedEntry(player.backpack);
  if (!entry) {
    return null;
  }
  const item = itemAt(entry.item.def);
  const base = item && WEAPONS[item.id];
  // Mit Aufsaetzen (Visier, Lauf, Griff) - siehe `gear.ts`.
  return base ? modifiedStats(base, entry.item.mods) : null;
}

/** Munitionsladungen: drei, mit Magazin zwei mehr. */
export function ammoCapacity(player: PlayerState): number {
  return PLAYER.ammoCharges + extraCharges(equippedEntry(player.backpack)?.item.mods);
}

/** Anzeigename fuers HUD: der Waffenname oder "Faust". */
export function weaponLabel(grid: InventoryGrid): string {
  const entry = equippedEntry(grid);
  return entry ? (itemAt(entry.item.def)?.name ?? "Faust") : "Faust";
}

/** Beschriftung des FEUER-Knopfs: Kurzname der Waffe oder "FAUST". */
export function attackLabel(player: PlayerState): string {
  return activeWeapon(player)?.short ?? FIST.short;
}

/** Reichweite des Basisangriffs - fuer Zielsuche und Zielhilfe. */
export function attackRange(player: PlayerState): number {
  return activeWeapon(player)?.range ?? player.radius + FIST.reach;
}

/**
 * Zuschlag bei der Zielsuche der Faust: Die Suche misst Mitte zu Mitte, die
 * Faust reicht ab Koerperrand. So wird auch ein Brocken (Radius 30) gefunden,
 * der gerade eben in Reichweite steht.
 */
const FIST_TARGET_SLACK = 40;

/**
 * Wie weit die automatische Zielsuche reicht. EINE Stelle fuer Simulation
 * (`combat.ts`) und Ziellinie (`GameScene`) - sonst zeigte die Linie auf
 * einen Gegner, den der Schuss gar nicht sucht.
 */
export function autoAimReach(player: PlayerState): number {
  const weapon = activeWeapon(player);
  return weapon
    ? weapon.range * PLAYER.autoAimRangeFactor
    : player.radius + FIST.reach + FIST_TARGET_SLACK;
}

/** Nachladezeit je Ladung; die Faust braucht keine Munition. */
export function reloadTimeOf(player: PlayerState): number {
  return activeWeapon(player)?.reloadTime ?? 0;
}

/**
 * Ruestet die Waffe aus, deren linke obere Zelle `(x, y)` ist.
 *
 * Gibt zurueck, ob sich etwas geaendert hat. Keine Waffe an der Stelle ->
 * nichts passiert (auch nicht "alles ablegen"): Ein Tipp daneben soll nicht
 * die Waffe aus der Hand nehmen.
 */
export function equipAt(grid: InventoryGrid, x: number, y: number): boolean {
  const target = grid.items.find((entry) => entry.x === x && entry.y === y);
  if (!target || !isWeapon(target.item.def) || target.item.equipped) {
    return false;
  }
  for (const entry of grid.items) {
    entry.item.equipped = false;
  }
  target.item.equipped = true;
  return true;
}

/** Nimmt allen Gegenstaenden das Merkmal - fuer das Lager, das nichts traegt. */
export function clearEquipped(grid: InventoryGrid): void {
  for (const entry of grid.items) {
    entry.item.equipped = false;
  }
}

/** Siehe Kopfkommentar: hoechstens eine, und eine, wenn es eine gibt. */
export function settleEquipped(grid: InventoryGrid): void {
  let found = false;
  for (const entry of grid.items) {
    if (entry.item.equipped && (found || !isWeapon(entry.item.def))) {
      entry.item.equipped = false;
    } else if (entry.item.equipped) {
      found = true;
    }
  }
  if (found) {
    return;
  }
  const first = grid.items.find((entry) => isWeapon(entry.item.def));
  if (first) {
    first.item.equipped = true;
  }
}
