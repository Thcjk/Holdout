/**
 * Was ein Run an Beute uebriglaesst - bis zum Schliessen der App.
 *
 * ================================================================
 * BEWUSST NUR IM ARBEITSSPEICHER
 * ================================================================
 *
 * Das dauerhafte Lager kommt in Phase 13. Es jetzt schon in `localStorage` zu
 * schreiben waere genau der Vorgriff, den die Projektregel ausschliesst: Was
 * nicht in der V1-Liste der aktuellen Phase steht, wird nicht gebaut.
 *
 * Schlimmer noch waere es praktisch: Ein halbes Lager ohne Rucksack-Gitter
 * (Phase 11) und ohne Waffenwirkung (Phase 12) legt ein Datenformat fest, das
 * beide Phasen danach umbauen muessten - mitsamt den Staenden, die Spieler
 * dann schon haben.
 *
 * Also: Diese Liste lebt, solange die Seite offen ist, und ist nach einem
 * Neuladen weg. Das ist wenig, aber es ist ehrlich, und es erfuellt genau das,
 * was fuer diese Phase verlangt war.
 *
 * ================================================================
 * WIPE LEERT, ERFOLG BEHAELT
 * ================================================================
 *
 * Das ist die eine Regel, um die sich das ganze Genre dreht - der Grund,
 * warum Aussteigen ueberhaupt eine Entscheidung ist. Sie steht deshalb an
 * EINER Stelle (`finishRun`) und nicht verteilt ueber Ergebnisbildschirm und
 * Spielszene: Zwei Stellen, die entscheiden, ob Beute verlorengeht, laufen
 * frueher oder spaeter auseinander - und der Fehler faellt erst auf, wenn
 * jemand seine Beute unverdient verliert.
 */

import type { PackedItem, PlacedItem, RunOutcome } from "../systems/types";

/*
 * ================================================================
 * SEIT ETAPPE 9: RUCKSACK UND LAGER GETRENNT
 * ================================================================
 *
 * Vorher war hier eine einzige Liste "gesicherte Beute", und in sie wanderte
 * nach einem Erfolg ALLES aus dem Rucksack - auch das Starter-Set. Weil das
 * Starter-Set beim naechsten Packen frisch dazukommt, haette es sich mit
 * jedem erfolgreichen Run verdoppelt. Und die Anordnung im Rucksack ging
 * verloren.
 *
 * Jetzt zwei Dinge:
 *
 *   backpack  Der Rucksack, wie er aus einem ERFOLGREICHEN Run kam - mit
 *             Lage und Drehung. Er ist der Ausgangspunkt des naechsten
 *             Packens. Nach einem Wipe ist er leer.
 *   stash     Das Lager links im Packbildschirm: was man aus dem Rucksack
 *             herausgenommen hat. Ein Wipe fasst es nicht an.
 *
 * Das Starter-Set steht in keiner der beiden Listen als eigener Besitz: Es
 * ist GESCHUETZT. Liegt ein Starter-Gegenstand nicht im Rucksack, legt ihn
 * der Packbildschirm ins Lager. Verloren geht er nie, gezaehlt wird er nie.
 */

let backpack: PackedItem[] = [];
let stash: PackedItem[] = [];

/** Der Rucksack fuer das naechste Packen (nach einem Wipe leer). */
export function backpackForNextRun(): readonly PackedItem[] {
  return backpack;
}

/** Das Lager ohne Starter-Set - das ergaenzt der Packbildschirm selbst. */
export function stashItems(): readonly PackedItem[] {
  return stash;
}

/** Merkt sich das Lager, wie es beim Loslaufen aussah. */
export function saveStash(items: readonly PackedItem[]): void {
  stash = items.filter((entry) => !entry.starter).map((entry) => ({ ...entry }));
}

/**
 * Schliesst einen Run ab.
 *
 * Bei Erfolg (Extraktion oder Bosssieg) bleibt der Rucksack, wie er ist, und
 * ist der Ausgangspunkt des naechsten Packens; bei einem Wipe ist er leer.
 * Gibt zurueck, wie viele Gegenstaende der Run eingebracht beziehungsweise
 * gekostet hat - OHNE Starter-Set, das weder gewonnen noch verloren wird.
 */
export function finishRun(
  outcome: RunOutcome,
  items: readonly PlacedItem[],
  /**
   * Bei der Extraktion am Boden liegend zurueckgelassen? Das Team ist raus,
   * dieser Spieler aber nicht wirklich - fuer seine Beute zaehlt es wie ein
   * Wipe. Siehe `leftBehind` in `systems/encounters.ts`.
   */
  wasLeftBehind = false,
): { kept: number; lost: number } {
  const counted = items.filter((entry) => !entry.item.starter).length;

  if (outcome === "wipe" || wasLeftBehind) {
    backpack = [];
    return { kept: 0, lost: counted };
  }

  backpack = items.map((entry) => ({
    def: entry.item.def,
    x: entry.x,
    y: entry.y,
    rotated: entry.rotated,
    starter: entry.item.starter === true,
    equipped: entry.item.equipped === true,
  }));
  return { kept: counted, lost: 0 };
}

/** Setzt alles zurueck. Nur fuer Tests. */
export function resetCarried(): void {
  backpack = [];
  stash = [];
}
