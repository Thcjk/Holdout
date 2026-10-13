/**
 * Wie die Welt auf den Bildschirm kommt: Kamera und Zeichenreihenfolge.
 *
 * Die Kamera folgt der Festung nur waagerecht. Senkrecht steht sie fest, so dass
 * das Deck oben im Bild liegt und darunter Platz fuer den Kampf am Boden ist.
 *
 * Zeichenreihenfolge ("depth"): Am Boden gilt "weiter unten = weiter vorn", also
 * die y-Koordinate. Alles auf dem Deck liegt ueber dem Rumpf, aber hinter allem,
 * was am Boden vor der Festung steht.
 */

import type Phaser from "phaser";
import { BEHIND, DECK_H, ELEVATION } from "../../game/constants";

/** Weltkoordinate y = 0 (Hinterkante des Decks am Boden) liegt so weit unter dem Bildrand. */
export const CAMERA_Y = -222;

export const DEPTH = {
  ground: -1000,
  prints: -900,
  shadow: -800,
  fortShadow: -850,
  /** Rumpf und Deck (Beine haben die y-Lage ihres Fusses). */
  body: DECK_H - 0.3,
  smoke: 5000,
  effects: 6000,
  hud: 9000,
} as const;

/** Dinge auf dem Deck: ueber dem Rumpf, untereinander nach ihrer Deck-Zeile. */
export function deckDepth(localY: number): number {
  return DECK_H + 0.01 + localY * 0.0001;
}

/** Zeichenreihenfolge fuer etwas bei Bodenlage y und Hoehe z. */
export function depthFor(y: number, z: number, fortY: number): number {
  return z > ELEVATION * 0.5 ? deckDepth(y - fortY) : y;
}

/** Kamera auf die Festung setzen: links sieht man genau bis zur Seilwinden-Grenze. */
export function followFort(camera: Phaser.Cameras.Scene2D.Camera, fortX: number): void {
  camera.setScroll(fortX - BEHIND - 14, CAMERA_Y);
}
