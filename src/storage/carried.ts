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

import type { ItemInstance, RunOutcome } from "../systems/types";

let carried: ItemInstance[] = [];

/** Was aus erfolgreichen Runs dieser Sitzung noch da ist. */
export function carriedItems(): readonly ItemInstance[] {
  return carried;
}

/**
 * Schliesst einen Run ab.
 *
 * Bei Erfolg (Extraktion oder Bosssieg) wandert die Beute in die Liste, bei
 * einem Team-Wipe ist sie weg. Gibt zurueck, wie viele Gegenstaende der Run
 * eingebracht beziehungsweise gekostet hat - der Ergebnisbildschirm sagt es
 * damit ausdruecklich, statt es den Spieler selbst herausfinden zu lassen.
 */
export function finishRun(
  outcome: RunOutcome,
  runItems: readonly ItemInstance[],
  /**
   * Bei der Extraktion am Boden liegend zurueckgelassen? Das Team ist raus,
   * dieser Spieler aber nicht wirklich - fuer seine Beute zaehlt es wie ein
   * Wipe. Siehe `leftBehind` in `systems/encounters.ts`.
   */
  wasLeftBehind = false,
): { kept: number; lost: number } {
  if (outcome === "wipe" || wasLeftBehind) {
    return { kept: 0, lost: runItems.length };
  }

  carried = [...carried, ...runItems];
  return { kept: runItems.length, lost: 0 };
}

/** Setzt alles zurueck. Nur fuer Tests. */
export function resetCarried(): void {
  carried = [];
}
