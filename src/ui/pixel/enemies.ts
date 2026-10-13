/**
 * Die Gegner: die goldene Armee der Toten, die der Zeitriss geweckt hat -
 * Skelettkrieger mit Bronzehelmen, Gladiatoren, Hopliten - und der Rissdaemon.
 *
 * Raster 48 x 48 (wie die Helden), Fuesse unten, Blick nach rechts.
 */

import type { EnemyType } from "../../game/types";
import { BONE, BRONZE, CREST, DEMON, FIRE, FUR, GOLD, LEATHER, ORANGE_HOT, OUT, RED, RED_EYE, STEEL, VIOLET } from "./palette";
import { oval, Pix, poly, rect, thick, union, type Ramp } from "./pix";

export const ENEMY_SIZE = 48;

/** Augenhoehle mit Gluehpunkt. */
export function socket(p: Pix, x: number, y: number, glow: string): void {
  p.px(x, y, OUT);
  p.px(x + 1, y, OUT);
  p.px(x, y + 1, OUT);
  p.px(x + 1, y + 1, glow);
}

/** Schaedel mit Zahnreihe. (cx, cy) = Mitte. */
export function skull(p: Pix, cx: number, cy: number, glow = RED_EYE, rx = 6.5, ry = 6): void {
  p.shape(oval(cx, cy, rx, ry), BONE, { shade: 1 });
  // Kiefer
  p.shape(rect(cx - rx + 2, cy + ry - 3, rx * 2 - 3, 4), BONE, { shade: 1 });
  socket(p, cx - 3, cy - 1, glow);
  socket(p, cx + 2, cy - 1, glow);
  p.px(cx, cy + 2, OUT);
  // Zaehne
  for (let x = Math.round(cx - rx + 3); x < cx + rx - 2; x += 1) {
    p.px(x, cy + ry - 1, x % 2 === 0 ? OUT : BONE[1]);
  }
}

/** Korinthischer Bronzehelm ueber dem Schaedel; `plume` = Helmbusch. */
export function helmet(p: Pix, cx: number, cy: number, plume: Ramp | null, big = false): void {
  if (plume) {
    if (big) {
      // Grosser, nach hinten geschwungener Busch
      p.shape(poly(cx + 4, cy - 7, cx + 1, cy - 15, cx - 6, cy - 17, cx - 12, cy - 13, cx - 13, cy - 4, cx - 9, cy - 3, cx - 9, cy - 10, cx - 4, cy - 12, cx, cy - 9), plume, { shade: 1 });
    } else {
      p.shape(poly(cx + 3, cy - 7, cx - 1, cy - 12, cx - 8, cy - 11, cx - 8, cy - 7), plume, { shade: 1 });
    }
  }
  // Glocke: oben rund, hinten bis zum Kinn, vorn ueber den Augen offen
  p.shape(poly(cx - 8, cy + 3, cx - 8, cy - 4, cx - 5, cy - 8, cx + 2, cy - 9, cx + 7, cy - 6, cx + 8, cy - 2, cx + 1, cy - 2, cx - 2, cy + 1, cx - 3, cy + 6, cx - 7, cy + 6), BRONZE, { shade: 1, noise: 0.08 });
  // Nasenschutz
  p.shape(rect(cx, cy - 2, 2, 4), BRONZE, { shade: 0 });
  // Maeanderband (griechisches Muster)
  for (let x = cx - 6; x <= cx + 6; x += 2) {
    p.pxOn(x, cy - 4, BRONZE[0]);
  }
}

/** Knochenarm/-bein als duenner Strich. */
export function bone(p: Pix, x0: number, y0: number, x1: number, y1: number, width = 2): void {
  p.shape(thick(x0, y0, x1, y1, width), BONE, { shade: 0, light: 0 });
}

/** Rippen und Wirbelsaeule. */
export function ribs(p: Pix, cx: number, top: number, bottom: number): void {
  p.shape(oval(cx, (top + bottom) / 2, 5.5, (bottom - top) / 2), BONE, { shade: 1 });
  for (let y = top + 1; y < bottom; y += 2) {
    p.line(cx - 4, y, cx + 4, y, BONE[0]);
  }
  p.line(cx, top, cx, bottom, BONE[1]);
}

/** Runder Hoplitenschild mit Emblem. */
export function hoplon(p: Pix, cx: number, cy: number, r: number): void {
  p.shape(oval(cx, cy, r, r), BRONZE, { shade: 2, noise: 0.1 });
  p.shape(oval(cx, cy, r - 2, r - 2), GOLD, { shade: 1 });
  // Lambda
  p.line(cx - 2, cy + 2, cx, cy - 2, RED[1]);
  p.line(cx, cy - 2, cx + 2, cy + 2, RED[1]);
}

// --- Skelettkrieger (grunt) ---------------------------------------------------------------

function skelettkrieger(p: Pix): void {
  // Beine mit Beinschienen
  bone(p, 21, 35, 19, 44);
  bone(p, 27, 35, 29, 44);
  p.shape(rect(17, 39, 4, 5), BRONZE, { shade: 1 });
  p.shape(rect(27, 39, 4, 5), BRONZE, { shade: 1 });
  p.shape(rect(15, 44, 6, 2), BONE, { shade: 0 });
  p.shape(rect(27, 44, 6, 2), BONE, { shade: 0 });
  // Becken mit Lederstreifen
  p.shape(rect(19, 32, 11, 3), BONE, { shade: 1 });
  for (let x = 19; x < 30; x += 2) {
    p.shape(rect(x, 34, 1, 4), LEATHER, { shade: 0, light: 0 });
  }
  ribs(p, 24, 22, 32);
  // Hinterer Arm
  bone(p, 19, 24, 15, 31);
  // Schaedel mit Helm
  skull(p, 25, 15);
  helmet(p, 25, 15, BRONZE);
  // Vorderer Arm mit Sichelschwert (Khopesch)
  bone(p, 30, 24, 34, 29);
  p.shape(thick(34, 30, 36, 25, 2), LEATHER, { shade: 0 });
  p.shape(poly(36, 25, 37, 18, 41, 14, 44, 15, 40, 18, 38, 25), STEEL, { shade: 1 });
  // Rundschild vorn links
  hoplon(p, 13, 31, 7);
}

// --- Flatterschaedel (swarmer) ------------------------------------------------------------

function flatterschaedel(p: Pix): void {
  // Fledermausfluegel
  p.shape(poly(20, 26, 8, 16, 4, 22, 8, 23, 6, 28, 11, 27, 13, 32, 19, 30), LEATHER, { shade: 1 });
  p.shape(poly(28, 26, 40, 16, 44, 22, 40, 23, 42, 28, 37, 27, 35, 32, 29, 30), LEATHER, { shade: 1 });
  p.line(19, 27, 9, 18, LEATHER[0]);
  p.line(29, 27, 39, 18, LEATHER[0]);
  // Schaedel mit violetten Augen und Bronzekappe
  skull(p, 24, 27, VIOLET[3], 6, 5.5);
  p.shape(poly(17, 25, 18, 21, 24, 19, 30, 21, 31, 25, 24, 23), BRONZE, { shade: 1, noise: 0.08 });
}

// --- Wolfsreiter (charger) ----------------------------------------------------------------

function wolfsreiter(p: Pix): void {
  // Schwanz
  p.shape(poly(8, 28, 2, 24, 4, 30, 9, 33), FUR, { shade: 1 });
  // Wolfskoerper
  p.shape(union(oval(19, 32, 11, 7), oval(30, 30, 7, 7)), FUR, { shade: 2 });
  // Beine
  for (const [x, back] of [[12, true], [17, false], [28, true], [33, false]] as const) {
    p.shape(rect(x, 35, 3, 9), back ? FUR : FUR, { shade: 1 });
    p.shape(rect(x - 1, 43, 5, 3), FUR, { shade: 0 });
  }
  // Kopf mit Schnauze und Ohren
  p.shape(poly(32, 24, 36, 18, 38, 23), FUR, { shade: 1 });
  p.shape(poly(31, 26, 37, 22, 44, 27, 46, 31, 41, 34, 34, 34), FUR, { shade: 1 });
  p.px(38, 26, RED_EYE);
  p.px(39, 26, "#ffb0a0");
  // Maul mit Zaehnen
  p.line(39, 31, 46, 31, OUT);
  for (let x = 40; x < 46; x += 2) {
    p.px(x, 32, BONE[3]);
  }
  // Mähne aus Glut
  p.shape(poly(27, 24, 29, 19, 31, 23, 33, 18, 34, 23), FIRE, { shade: 0 });
  // Skelettreiter
  bone(p, 19, 26, 21, 20);
  ribs(p, 20, 15, 23);
  skull(p, 21, 9, RED_EYE, 5.5, 5);
  helmet(p, 21, 9, RED);
  bone(p, 23, 17, 28, 20);
}

// --- Skelettschuetze (spitter) ------------------------------------------------------------

function skelettschuetze(p: Pix): void {
  bone(p, 21, 35, 19, 44);
  bone(p, 27, 35, 29, 44);
  p.shape(rect(15, 44, 6, 2), BONE, { shade: 0 });
  p.shape(rect(27, 44, 6, 2), BONE, { shade: 0 });
  // Koecher auf dem Ruecken
  p.shape(rect(14, 20, 5, 12), LEATHER, { shade: 1 });
  p.line(15, 19, 14, 16, BONE[2]);
  p.line(17, 19, 17, 15, BONE[2]);
  p.shape(rect(19, 32, 11, 3), BONE, { shade: 1 });
  ribs(p, 24, 22, 32);
  // Kapuze aus rotem Tuch statt Helm
  skull(p, 25, 15);
  p.shape(poly(16, 21, 17, 10, 23, 7, 30, 8, 33, 12, 31, 13, 24, 11, 20, 14, 20, 22), RED, { shade: 1 });
  // Bogen vorn
  bone(p, 30, 24, 35, 26);
  p.shape(thick(36, 13, 39, 26, 2), LEATHER, { shade: 0 });
  p.shape(thick(39, 26, 36, 38, 2), LEATHER, { shade: 0 });
  p.line(36, 14, 36, 37, BONE[3]);
}

// --- Gladiator (bruiser) -------------------------------------------------------------------

function gladiator(p: Pix): void {
  // Dreizack hinter dem Koerper
  p.shape(thick(9, 46, 12, 4, 2), LEATHER, { shade: 0 });
  p.shape(union(rect(8, 3, 9, 2), rect(8, 0, 2, 4), rect(12, 0, 2, 4), rect(15, 0, 2, 4)), STEEL, { shade: 0 });
  // Breite Beine mit Beinschienen
  p.shape(rect(15, 36, 7, 8), LEATHER, { shade: 1 });
  p.shape(rect(26, 36, 7, 8), LEATHER, { shade: 1 });
  p.shape(rect(14, 39, 8, 5), BRONZE, { shade: 1, noise: 0.08 });
  p.shape(rect(26, 39, 8, 5), BRONZE, { shade: 1, noise: 0.08 });
  p.shape(rect(13, 44, 9, 2), LEATHER, { shade: 0 });
  p.shape(rect(26, 44, 10, 2), LEATHER, { shade: 0 });
  // Massiger Rumpf: goldener Muskelpanzer mit Guertel
  p.shape(poly(12, 21, 36, 21, 35, 37, 13, 37), GOLD, { shade: 2, noise: 0.05 });
  p.line(18, 26, 22, 28, GOLD[1]);
  p.line(30, 26, 26, 28, GOLD[1]);
  p.line(24, 29, 24, 31, GOLD[1]);
  p.line(16, 30, 32, 30, GOLD[1]);
  p.shape(rect(12, 32, 24, 4), BRONZE, { shade: 1 });
  p.shape(rect(22, 32, 4, 4), GOLD, { shade: 0 });
  // Riesiger Schulterpanzer (Manica) hinten links
  p.shape(poly(6, 20, 12, 15, 20, 17, 20, 25, 15, 31, 7, 29), BRONZE, { shade: 2, noise: 0.1 });
  for (let y = 19; y < 29; y += 3) {
    p.line(8, y, 17, y + 1, BRONZE[0]);
  }
  // Helm mit Gesichtsgitter
  p.shape(poly(15, 19, 15, 9, 20, 4, 29, 4, 33, 9, 33, 19, 29, 22, 19, 22), BRONZE, { shade: 2, noise: 0.08 });
  p.shape(poly(26, 4, 30, 0, 32, 1, 30, 6), BRONZE, { shade: 1 });
  p.shape(oval(26, 14, 5, 5), STEEL, { shade: 1 });
  for (let x = 23; x <= 29; x += 2) {
    p.line(x, 10, x, 18, STEEL[0]);
  }
  p.line(21, 14, 31, 14, STEEL[0]);
  p.px(27, 13, RED_EYE);
  // Vorderer Arm, kraeftig, mit Armschiene
  p.shape(thick(34, 24, 38, 33, 6), BRONZE, { shade: 1, noise: 0.06 });
  p.shape(rect(35, 31, 6, 6), LEATHER, { shade: 1 });
  p.shape(oval(38, 38, 3.5, 3), BRONZE, { shade: 1 });
}

// --- Hoplitenhauptmann (elite) ------------------------------------------------------------

function hoplitenhauptmann(p: Pix): void {
  // Roter Umhang
  p.shape(poly(16, 22, 30, 22, 33, 44, 12, 44), RED, { shade: 2 });
  // Speer hinten
  p.shape(thick(4, 44, 42, 6, 2), LEATHER, { shade: 0 });
  p.shape(poly(41, 7, 46, 1, 44, 9), STEEL, { shade: 0 });
  bone(p, 21, 35, 19, 44);
  bone(p, 27, 35, 29, 44);
  p.shape(rect(17, 38, 4, 6), GOLD, { shade: 1 });
  p.shape(rect(27, 38, 4, 6), GOLD, { shade: 1 });
  p.shape(rect(15, 44, 6, 2), BONE, { shade: 0 });
  p.shape(rect(27, 44, 6, 2), BONE, { shade: 0 });
  // Goldener Muskelpanzer
  p.shape(poly(17, 22, 31, 22, 30, 34, 18, 34), GOLD, { shade: 2, noise: 0.06 });
  p.line(21, 26, 23, 27, GOLD[1]);
  p.line(27, 26, 25, 27, GOLD[1]);
  p.line(24, 28, 24, 33, GOLD[1]);
  for (let x = 18; x < 31; x += 2) {
    p.shape(rect(x, 34, 1, 4), LEATHER, { shade: 0, light: 0 });
  }
  // Schaedel mit grossem weissen Helmbusch
  skull(p, 25, 15, VIOLET[3]);
  helmet(p, 25, 15, CREST, true);
  // Arm mit Speer und grosser Rundschild vorn
  bone(p, 30, 24, 34, 27);
  hoplon(p, 15, 30, 9);
}

// --- Rissdaemon (boss) ----------------------------------------------------------------------

function rissdaemon(p: Pix): void {
  // Fluegel
  p.shape(poly(14, 18, 2, 6, 0, 18, 3, 17, 2, 25, 6, 23, 7, 30, 13, 27), DEMON, { shade: 1 });
  p.shape(poly(34, 18, 46, 6, 47, 18, 44, 17, 45, 25, 41, 23, 40, 30, 35, 27), DEMON, { shade: 1 });
  p.line(13, 19, 3, 8, DEMON[0]);
  p.line(35, 19, 45, 8, DEMON[0]);
  // Schwanz
  p.shape(thick(14, 40, 4, 44, 2), DEMON, { shade: 0 });
  p.shape(poly(1, 42, 5, 41, 3, 46), DEMON, { shade: 0 });
  // Beine, krumm, mit Krallen
  p.shape(poly(16, 34, 22, 34, 21, 42, 23, 46, 14, 46, 16, 41), DEMON, { shade: 1 });
  p.shape(poly(26, 34, 32, 34, 32, 41, 35, 46, 26, 46, 27, 41), DEMON, { shade: 1 });
  // Massiger Oberkoerper
  p.shape(poly(11, 20, 37, 20, 34, 36, 14, 36), DEMON, { shade: 2 });
  p.line(18, 26, 22, 28, DEMON[1]);
  p.line(30, 26, 26, 28, DEMON[1]);
  p.line(24, 29, 24, 35, DEMON[1]);
  // Risse aus violettem Licht
  p.line(15, 24, 18, 31, VIOLET[3]);
  p.line(32, 23, 29, 30, VIOLET[2]);
  // Arme mit Krallen und Goldreifen
  p.shape(thick(11, 22, 8, 34, 6), DEMON, { shade: 1 });
  p.shape(thick(37, 22, 40, 34, 6), DEMON, { shade: 1 });
  p.shape(rect(6, 29, 6, 2), GOLD, { shade: 0 });
  p.shape(rect(37, 29, 6, 2), GOLD, { shade: 0 });
  for (const x of [5, 8, 11]) {
    p.line(x, 35, x - 1, 38, BONE[3]);
  }
  for (const x of [37, 40, 43]) {
    p.line(x, 35, x + 1, 38, BONE[3]);
  }
  // Kopf mit Hoernern, roten Augen, Grinsen
  p.shape(poly(17, 12, 12, 4, 14, 1, 20, 8), BONE, { shade: 1 });
  p.shape(poly(31, 12, 36, 4, 34, 1, 28, 8), BONE, { shade: 1 });
  p.shape(oval(24, 15, 8, 7), DEMON, { shade: 1 });
  p.shape(poly(19, 14, 24, 11, 29, 14, 27, 20, 21, 20), CREST, { shade: 1 });
  p.px(21, 15, RED_EYE);
  p.px(22, 15, RED_EYE);
  p.px(26, 15, RED_EYE);
  p.px(27, 15, RED_EYE);
  for (let x = 21; x <= 27; x += 1) {
    p.px(x, 18, x % 2 === 0 ? OUT : CREST[2]);
  }
}

// --- Glutschaedel (exploder) ---------------------------------------------------------------

function glutschaedel(p: Pix): void {
  // Flammenkrone
  p.shape(poly(14, 30, 12, 18, 16, 22, 17, 12, 21, 19, 24, 8, 27, 18, 31, 11, 32, 21, 36, 16, 34, 30), FIRE, { shade: 1, light: 0 });
  p.shape(poly(18, 30, 18, 22, 21, 25, 24, 16, 27, 24, 30, 21, 30, 30), FIRE, { shade: 0, light: 0, flat: true });
  p.fill(poly(19, 30, 21, 26, 24, 22, 27, 26, 29, 30), FIRE[3]);
  // Schaedel
  skull(p, 24, 32, ORANGE_HOT, 7, 6.5);
  // Funken
  for (const [x, y] of [[10, 22], [38, 24], [14, 10], [35, 9]] as const) {
    p.px(x, y, FIRE[3]);
  }
}

// --- Seelenurne (splitter) -----------------------------------------------------------------

function seelenurne(p: Pix): void {
  // Knochenbeine
  bone(p, 20, 36, 18, 44);
  bone(p, 28, 36, 30, 44);
  p.shape(rect(15, 44, 6, 2), BONE, { shade: 0 });
  p.shape(rect(28, 44, 6, 2), BONE, { shade: 0 });
  // Amphore: bauchig, enger Hals, zwei Henkel
  p.shape(union(oval(24, 28, 11, 10), rect(20, 12, 9, 8), rect(17, 10, 15, 3)), GOLD, { shade: 2, noise: 0.05 });
  p.shape(thick(15, 15, 13, 24, 2), GOLD, { shade: 0 });
  p.shape(thick(33, 15, 35, 24, 2), GOLD, { shade: 0 });
  // Schwarzes Band mit Schaedelbild
  p.shape(rect(14, 25, 21, 7), LEATHER, { shade: 0, light: 0 });
  p.fill(oval(24, 28, 3, 3), BONE[2]);
  p.px(23, 28, OUT);
  p.px(25, 28, OUT);
  for (let x = 15; x < 34; x += 3) {
    p.px(x, 26, GOLD[2]);
    p.px(x, 30, GOLD[2]);
  }
  // Seelenrauch aus der Oeffnung
  p.shape(poly(20, 10, 18, 5, 22, 6, 23, 0, 26, 5, 30, 3, 29, 10), VIOLET, { shade: 0 });
  p.px(24, 5, VIOLET[3]);
}

export function drawEnemyPixels(type: EnemyType): Pix {
  const p = new Pix(ENEMY_SIZE, ENEMY_SIZE, 23);
  switch (type) {
    case "grunt":
      skelettkrieger(p);
      break;
    case "swarmer":
      flatterschaedel(p);
      break;
    case "charger":
      wolfsreiter(p);
      break;
    case "spitter":
      skelettschuetze(p);
      break;
    case "bruiser":
      gladiator(p);
      break;
    case "elite":
      hoplitenhauptmann(p);
      break;
    case "boss":
      rissdaemon(p);
      break;
    case "exploder":
      glutschaedel(p);
      break;
    case "splitter":
      seelenurne(p);
      break;
  }
  p.outline(OUT);
  return p;
}
