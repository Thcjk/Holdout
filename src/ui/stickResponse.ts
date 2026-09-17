/**
 * Die Kennlinie des Bewegungs-Joysticks: aus Zugstrecke wird Tempo.
 *
 * Bewusst eine eigene, reine Funktion ohne Phaser - so laesst sich das
 * Steuerungsgefuehl im Test nachrechnen, statt es nur auf dem Handy zu ahnen.
 */

import { TOUCH } from "../config/constants";

/**
 * Bildet die Zugstrecke in Pixeln auf einen Wert zwischen 0 und 1 ab.
 *
 * - Bis zur toten Zone: genau 0. Ein aufliegender Daumen zittert, und ohne
 *   diesen Bereich liefe die Figur von selbst los.
 * - Darueber: die Strecke bis zum Stickrand, durch die Kurve geschickt.
 *   Geradlinig (Kurve 1) waere schon ein kleiner Schubs ein spuerbarer Satz;
 *   quadratisch (Kurve 2) wird die Mitte fein, volles Tempo gibt es weiterhin
 *   am Rand.
 * - Ab dem Stickrand: genau 1, egal wie weit der Daumen noch zieht.
 */
export function stickStrength(distance: number): number {
  if (distance <= TOUCH.deadZone) {
    return 0;
  }
  const usable = Math.min(distance, TOUCH.stickRadius) - TOUCH.deadZone;
  const span = Math.max(1, TOUCH.stickRadius - TOUCH.deadZone);
  return Math.pow(usable / span, TOUCH.responseCurve);
}
