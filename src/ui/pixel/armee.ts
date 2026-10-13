/**
 * Die goldene Armee (Entwurf fuer die Wanderfestung): Untote eines Wuestenreichs,
 * die der Festung hinterherjagen, weil sie ihr Sonnenherz zurueckwollen.
 *
 * Jede Figur hat eine Aufgabe gegen die Festung:
 *   Sandlaeufer   - Fussvolk mit Nemes-Kopftuch und Sichelschwert, hackt an den Beinen
 *   Enterer       - mit Leiter und Enterhaken, klettert aufs Deck
 *   Phalanx       - grosser Turmschild, vorn kaum verwundbar, kommt in Reihen
 *   Skarabaeus    - goldener Kaefer, fliegt im Schwarm aufs Deck
 *   Sandpriester  - Robe und Sonnenstab, schuetzt und weckt Gefallene
 *   Streitwagen   - Schakal-Gespann, schnell, rammt die Beine
 *   Ballista      - Pfeilgeschuetz auf Raedern, schiesst Module ab
 *   Belagerungsturm - rollt neben die Festung und laesst Enterer ueber eine Bruecke
 *   Goldener Koloss - Endgegner: eine laufende Riesenstatue
 * Alle schauen nach rechts (dorthin laeuft die Festung). Fuesse unten.
 */

import { bone, helmet, ribs, skull } from "./enemies";
import { BONE, BRONZE, CREST, CREST_RED, FIRE, GOLD, LEATHER, OUTLINE, STEEL, WOOD } from "./palette";
import { ellipse, Pix, poly, rect, thick, union, type Mask, type Ramp } from "./pix";

export type ArmyId =
  | "laeufer"
  | "enterer"
  | "phalanx"
  | "skarabaeus"
  | "priester"
  | "streitwagen"
  | "ballista"
  | "turm"
  | "koloss";

export const ARMY: readonly { id: ArmyId; name: string }[] = [
  { id: "laeufer", name: "Sandläufer" },
  { id: "enterer", name: "Enterer" },
  { id: "phalanx", name: "Phalanx" },
  { id: "skarabaeus", name: "Skarabäus" },
  { id: "priester", name: "Sandpriester" },
  { id: "streitwagen", name: "Streitwagen" },
  { id: "ballista", name: "Ballista" },
  { id: "turm", name: "Belagerungsturm" },
  { id: "koloss", name: "Goldener Koloss" },
];

/** Groesse der Leinwand je Figur. */
export const ARMY_SIZE: Record<ArmyId, readonly [number, number]> = {
  laeufer: [48, 48],
  enterer: [48, 48],
  phalanx: [48, 48],
  skarabaeus: [32, 32],
  priester: [48, 56],
  streitwagen: [88, 56],
  ballista: [80, 56],
  turm: [76, 124],
  koloss: [132, 168],
};

const LINEN: Ramp = ["#3a3428", "#a89c84", "#e4dccb", "#fbf7ee"];
const ROBE: Ramp = ["#120a18", "#341e3e", "#4e2e5a", "#6e4680"];
const MEMBRANE: Ramp = ["#3a2408", "#b88a48", "#e8c888", "#fff2cc"];
const JACKAL: Ramp = ["#141018", "#2e2632", "#463c4a", "#64586a"];
const EYE_GOLD = "#ffd040";
const EYE_HOT = "#ff6a2a";

/** Streifenmuster auf schon Gemaltes innerhalb der Maske. */
function stripes(p: Pix, mask: Mask, color: string, every = 3): void {
  for (let y = mask.y0; y <= mask.y1; y += 1) {
    if (y % every !== 0) {
      continue;
    }
    for (let x = mask.x0; x <= mask.x1; x += 1) {
      if (mask.test(x, y)) {
        p.pxOn(x, y, color);
      }
    }
  }
}

/** Nemes-Kopftuch (gold mit dunklen Streifen) ueber einem Schaedel bei (cx, cy). */
function nemes(p: Pix, cx: number, cy: number): void {
  const cloth = poly(cx - 8, cy + 9, cx - 8, cy - 3, cx - 4, cy - 7, cx + 4, cy - 7, cx + 7, cy - 4, cx + 7, cy - 2, cx - 1, cy - 3, cx - 4, cy, cx - 4, cy + 9);
  p.shape(cloth, GOLD, { shade: 1 });
  stripes(p, cloth, BRONZE[0], 3);
  p.shape(rect(cx - 5, cy - 4, 12, 2), GOLD, { shade: 0 });
  // Kobra auf der Stirn
  p.px(cx + 5, cy - 6, GOLD[3]);
  p.px(cx + 5, cy - 5, GOLD[1]);
}

// --- Sandlaeufer ---------------------------------------------------------------------------

function laeufer(p: Pix): void {
  // Laufpose: hinteres Bein weit zurueck, vorderes vorn
  bone(p, 21, 33, 15, 39);
  bone(p, 15, 39, 11, 45);
  bone(p, 26, 33, 32, 38);
  bone(p, 32, 38, 33, 45);
  p.shape(rect(7, 44, 6, 2), BONE, { shade: 0 });
  p.shape(rect(31, 44, 7, 2), BONE, { shade: 0 });
  // Lendenschurz aus Leinen mit Goldguertel
  p.shape(poly(18, 30, 30, 30, 32, 37, 25, 35, 16, 37), LINEN, { shade: 1 });
  p.shape(rect(18, 29, 13, 2), GOLD, { shade: 0 });
  // Hinterer Arm schwingt zurueck
  bone(p, 21, 22, 14, 27);
  ribs(p, 25, 19, 29);
  // Goldener Halskragen
  p.shape(ellipse(26, 19.5, 6.5, 2.5), GOLD, { shade: 1 });
  skull(p, 28, 12);
  nemes(p, 28, 12);
  // Vorderer Arm mit Sichelschwert
  bone(p, 30, 21, 35, 25);
  p.shape(thick(35, 26, 37, 22, 2), LEATHER, { shade: 0 });
  p.shape(poly(37, 22, 38, 15, 42, 11, 46, 12, 46, 15, 43, 14, 40, 17, 39, 22), BRONZE, { shade: 1 });
}

// --- Enterer -------------------------------------------------------------------------------

function enterer(p: Pix): void {
  // Leiter auf dem Ruecken (schraeg)
  p.shape(thick(6, 44, 16, 3, 2), WOOD, { shade: 0 });
  p.shape(thick(12, 45, 22, 4, 2), WOOD, { shade: 0 });
  for (let t = 0.1; t < 1; t += 0.16) {
    p.line(6 + (16 - 6) * t, 44 - 41 * t, 12 + (22 - 12) * t, 45 - 41 * t, WOOD[3]);
  }
  bone(p, 21, 35, 19, 44);
  bone(p, 27, 35, 29, 44);
  p.shape(rect(17, 39, 4, 5), BRONZE, { shade: 1 });
  p.shape(rect(27, 39, 4, 5), BRONZE, { shade: 1 });
  p.shape(rect(15, 44, 6, 2), BONE, { shade: 0 });
  p.shape(rect(27, 44, 6, 2), BONE, { shade: 0 });
  p.shape(rect(19, 32, 11, 3), BONE, { shade: 1 });
  ribs(p, 24, 22, 32);
  // Seilrolle quer ueber der Brust
  for (let i = 0; i < 7; i += 1) {
    p.px(19 + i * 2, 23 + i * 1.3, "#d8b878");
    p.px(20 + i * 2, 24 + i * 1.3, "#8a6a3a");
  }
  skull(p, 25, 15);
  helmet(p, 25, 15, CREST_RED);
  // Enterhaken hoch erhoben
  bone(p, 30, 23, 35, 18);
  p.shape(thick(35, 19, 38, 8, 2), STEEL, { shade: 0 });
  p.shape(poly(32, 10, 38, 7, 44, 10, 42, 12, 38, 10, 34, 12), STEEL, { shade: 1 });
  p.px(32, 12, STEEL[3]);
  p.px(44, 12, STEEL[3]);
}

// --- Phalanx --------------------------------------------------------------------------------

function phalanx(p: Pix): void {
  // Langer Speer schraeg nach vorn
  p.shape(thick(4, 34, 46, 14, 2), WOOD, { shade: 0 });
  p.shape(poly(42, 13, 48, 11, 45, 17), STEEL, { shade: 0 });
  bone(p, 19, 35, 17, 44);
  bone(p, 25, 35, 27, 44);
  p.shape(rect(15, 38, 4, 6), GOLD, { shade: 1 });
  p.shape(rect(25, 38, 4, 6), GOLD, { shade: 1 });
  p.shape(rect(13, 44, 6, 2), BONE, { shade: 0 });
  p.shape(rect(25, 44, 6, 2), BONE, { shade: 0 });
  // Roter Umhang hinten
  p.shape(poly(14, 21, 22, 21, 22, 40, 10, 42), CREST_RED, { shade: 1 });
  p.shape(poly(16, 21, 28, 21, 27, 34, 17, 34), GOLD, { shade: 1, noise: 0.05 });
  skull(p, 22, 14);
  helmet(p, 22, 14, CREST, true);
  // Grosser Turmschild vorn
  const shield = union(rect(27, 17, 14, 28), ellipse(34, 17, 7, 4));
  p.shape(shield, GOLD, { shade: 2, noise: 0.05 });
  p.ring(union(rect(29, 18, 10, 25), ellipse(34, 18, 5, 2.5)), GOLD[1]);
  // Sonnenscheibe als Wappen
  p.shape(ellipse(34, 29, 3.5, 3.5), BRONZE, { shade: 1 });
  for (const [dx, dy] of [[0, -6], [0, 6], [-5, 0], [5, 0], [-4, -4], [4, 4], [-4, 4], [4, -4]] as const) {
    p.px(34 + dx, 29 + dy, BRONZE[1]);
  }
}

// --- Skarabaeus ------------------------------------------------------------------------------

function skarabaeus(p: Pix): void {
  // Duenne Fluegel
  p.shape(poly(13, 15, 1, 6, 2, 15, 10, 19), MEMBRANE, { shade: 0 });
  p.shape(poly(19, 15, 31, 6, 30, 15, 22, 19), MEMBRANE, { shade: 0 });
  p.line(12, 15, 3, 8, MEMBRANE[1]);
  p.line(20, 15, 29, 8, MEMBRANE[1]);
  // Beinchen
  for (const [x0, y0, x1, y1] of [[11, 21, 7, 25], [12, 24, 8, 29], [21, 21, 25, 25], [20, 24, 24, 29]] as const) {
    p.line(x0, y0, x1, y1, BRONZE[0]);
  }
  // Panzer (zwei Deckfluegel) und Kopf
  p.shape(ellipse(16, 20, 7, 8), GOLD, { shade: 2 });
  p.line(16, 14, 16, 27, GOLD[0]);
  p.shape(ellipse(16, 11, 4.5, 3.2), BRONZE, { shade: 1 });
  p.shape(poly(13, 9, 11, 4, 15, 8), BRONZE, { shade: 0 });
  p.shape(poly(19, 9, 21, 4, 17, 8), BRONZE, { shade: 0 });
  p.px(14, 11, EYE_HOT);
  p.px(18, 11, EYE_HOT);
}

// --- Sandpriester ----------------------------------------------------------------------------

function priester(p: Pix): void {
  // Sonnenstab hinten
  p.shape(thick(36, 54, 38, 13, 2), WOOD, { shade: 0 });
  p.shape(ellipse(38, 9, 6, 6), GOLD, { shade: 1 });
  p.shape(ellipse(38, 9, 3, 3), FIRE, { shade: 0, edge: false });
  p.px(37, 8, "#fffbe0");
  for (const [dx, dy] of [[0, -9], [-8, 0], [8, 0], [-6, -6], [6, -6]] as const) {
    p.px(38 + dx, 9 + dy, GOLD[2]);
  }
  // Lange Robe mit Goldsaum
  const robe = poly(17, 24, 31, 24, 36, 54, 11, 54);
  p.shape(robe, ROBE, { shade: 2 });
  p.shape(rect(21, 25, 5, 29), GOLD, { shade: 1 });
  stripes(p, rect(21, 25, 5, 29), BRONZE[0], 4);
  p.shape(poly(11, 51, 36, 51, 36, 54, 11, 54), GOLD, { shade: 0 });
  // Schultern mit Goldkragen
  p.shape(ellipse(24, 24, 9, 3.5), GOLD, { shade: 1 });
  stripes(p, ellipse(24, 24, 9, 3.5), CREST_RED[1], 2);
  // Schaedel mit hoher Krone
  skull(p, 25, 16, EYE_GOLD);
  p.shape(poly(18, 12, 19, 2, 24, -1, 30, 2, 31, 12, 25, 10), CREST, { shade: 1 });
  p.shape(rect(18, 10, 14, 3), GOLD, { shade: 0 });
  p.shape(ellipse(24.5, 5, 2.5, 2.5), GOLD, { shade: 0 });
  // Arm zum Stab
  p.shape(thick(29, 27, 36, 32, 4), ROBE, { shade: 1 });
  bone(p, 35, 31, 37, 29);
  // Schwebende Glyphen
  p.px(10, 30, EYE_GOLD);
  p.px(8, 36, GOLD[3]);
  p.px(12, 41, EYE_GOLD);
}

// --- Streitwagen -----------------------------------------------------------------------------

function streitwagen(p: Pix): void {
  // Schakal-Bestie vorn, im Galopp
  p.shape(thick(66, 34, 74, 46, 3), JACKAL, { shade: 0 });
  p.shape(thick(54, 34, 48, 46, 3), JACKAL, { shade: 0 });
  p.shape(union(ellipse(60, 29, 12, 6.5), ellipse(70, 26, 6, 6)), JACKAL, { shade: 2 });
  for (let x = 53; x < 66; x += 3) {
    p.line(x, 26, x + 1, 32, BONE[1]);
  }
  p.shape(thick(72, 34, 79, 44, 3), JACKAL, { shade: 0 });
  p.shape(thick(58, 34, 56, 46, 3), JACKAL, { shade: 0 });
  // Kopf mit langer Schnauze und hohen Ohren
  p.shape(poly(70, 21, 72, 8, 75, 18), JACKAL, { shade: 1 });
  p.shape(poly(74, 21, 79, 10, 79, 20), JACKAL, { shade: 1 });
  p.shape(poly(70, 19, 80, 19, 87, 25, 85, 28, 74, 29), JACKAL, { shade: 1 });
  p.px(77, 22, EYE_HOT);
  p.line(79, 27, 86, 26, OUTLINE);
  for (let x = 80; x < 86; x += 2) {
    p.px(x, 28, BONE[3]);
  }
  // Goldenes Geschirr
  p.shape(rect(57, 23, 3, 12), GOLD, { shade: 0 });
  p.shape(ellipse(70, 31, 4, 2), GOLD, { shade: 0 });
  // Deichsel
  p.shape(thick(26, 40, 58, 32, 2), WOOD, { shade: 0 });
  // Wagenkasten mit Sonnenwappen
  p.shape(poly(10, 22, 36, 22, 38, 40, 12, 42), GOLD, { shade: 2, noise: 0.05 });
  p.shape(poly(12, 18, 34, 18, 36, 23, 10, 23), BRONZE, { shade: 1 });
  p.shape(ellipse(24, 31, 4, 4), BRONZE, { shade: 1 });
  p.px(24, 25, BRONZE[1]);
  p.px(24, 37, BRONZE[1]);
  p.px(18, 31, BRONZE[1]);
  p.px(30, 31, BRONZE[1]);
  // Grosses Speichenrad
  p.shape(ellipse(22, 44, 10.5, 10.5), WOOD, { shade: 1 });
  p.fill(ellipse(22, 44, 7.5, 7.5), "#2a1c12");
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI;
    p.line(22 - Math.cos(a) * 7, 44 - Math.sin(a) * 7, 22 + Math.cos(a) * 7, 44 + Math.sin(a) * 7, WOOD[2]);
  }
  p.ring(ellipse(22, 44, 10.5, 10.5), GOLD[1]);
  p.shape(ellipse(22, 44, 2.5, 2.5), GOLD, { shade: 0 });
  // Lenker: Skelett mit Helm, Peitsche
  ribs(p, 26, 9, 17);
  skull(p, 27, 4.5, undefined, 5.5, 5);
  helmet(p, 27, 4.5, CREST_RED);
  bone(p, 31, 12, 38, 14);
  p.line(38, 14, 50, 6, LEATHER[2]);
  p.line(50, 6, 58, 12, LEATHER[1]);
}

// --- Ballista -------------------------------------------------------------------------------

function ballista(p: Pix): void {
  // Karren
  p.shape(rect(8, 30, 52, 10), WOOD, { shade: 1 });
  for (let x = 14; x < 58; x += 8) {
    p.line(x, 31, x, 39, WOOD[0]);
  }
  p.shape(rect(8, 28, 52, 3), GOLD, { shade: 0 });
  // Raeder
  for (const x of [17, 51]) {
    p.shape(ellipse(x, 44, 8, 8), WOOD, { shade: 1 });
    p.fill(ellipse(x, 44, 5, 5), "#2a1c12");
    p.line(x - 5, 44, x + 5, 44, WOOD[2]);
    p.line(x, 39, x, 49, WOOD[2]);
    p.shape(ellipse(x, 44, 2, 2), GOLD, { shade: 0 });
  }
  // Bedienmannschaft: Skelett hinten
  bone(p, 10, 28, 9, 20);
  ribs(p, 10, 11, 20);
  skull(p, 11, 6, undefined, 5.5, 5);
  helmet(p, 11, 6, null);
  bone(p, 14, 14, 22, 20);
  // Bogengeschuetz: Schaft, goldene Arme, Sehne, Bolzen
  p.shape(thick(18, 24, 62, 20, 5), WOOD, { shade: 1 });
  p.shape(rect(30, 22, 6, 8), WOOD, { shade: 1 });
  p.shape(thick(56, 20, 60, 5, 3), GOLD, { shade: 1 });
  p.shape(thick(56, 22, 60, 37, 3), GOLD, { shade: 1 });
  p.line(60, 5, 40, 21, BONE[3]);
  p.line(60, 37, 40, 23, BONE[3]);
  p.shape(thick(38, 21, 74, 19, 2), STEEL, { shade: 0 });
  p.shape(poly(72, 16, 80, 19, 72, 23), STEEL, { shade: 0 });
}

// --- Belagerungsturm ---------------------------------------------------------------------------

function turm(p: Pix): void {
  // Fahne oben
  p.line(20, 0, 20, 18, WOOD[1]);
  p.shape(poly(21, 1, 34, 4, 21, 9), CREST_RED, { shade: 0 });
  p.px(26, 4, GOLD[2]);
  // Turmkoerper aus Holzbohlen, nach oben schmaler
  const body = poly(12, 18, 60, 18, 66, 112, 6, 112);
  p.shape(body, WOOD, { shade: 3 });
  for (let x = 14; x < 66; x += 6) {
    p.line(x, 19, x + (x - 36) * 0.12, 111, WOOD[1]);
  }
  // Goldbeschlaege
  for (const y of [38, 66, 94]) {
    const inset = (112 - y) * 0.064;
    p.shape(rect(6 + inset, y, 60 - inset * 2, 4), GOLD, { shade: 1 });
    for (let x = Math.ceil(9 + inset); x < 63 - inset; x += 6) {
      p.px(x, y + 1, GOLD[3]);
    }
  }
  // Zinnen oben
  for (let x = 12; x < 60; x += 9) {
    p.shape(rect(x, 12, 6, 7), WOOD, { shade: 1 });
  }
  // Fenster mit Skeletten
  for (const [x, y] of [[26, 48], [44, 48], [35, 76]] as const) {
    p.fill(rect(x - 5, y - 6, 11, 11), "#140c08");
    skull(p, x, y, undefined, 4, 3.5);
  }
  // Heruntergelassene Bruecke nach rechts
  p.shape(poly(58, 20, 76, 27, 76, 34, 58, 28), WOOD, { shade: 1 });
  p.line(63, 23, 63, 30, WOOD[1]);
  p.line(69, 25, 69, 32, WOOD[1]);
  p.line(58, 14, 75, 27, STEEL[1]);
  // Raeder
  for (const x of [14, 58]) {
    p.shape(ellipse(x, 113, 9, 9), WOOD, { shade: 1 });
    p.fill(ellipse(x, 113, 5, 5), "#2a1c12");
    p.shape(ellipse(x, 113, 2, 2), GOLD, { shade: 0 });
  }
}

// --- Goldener Koloss (Endgegner) ---------------------------------------------------------------

const STATUE: Ramp = ["#3a2408", "#9a6a18", "#d8a032", "#f8dc80"];

function crack(p: Pix, points: readonly number[]): void {
  for (let i = 0; i + 3 < points.length; i += 2) {
    p.line(points[i]!, points[i + 1]!, points[i + 2]!, points[i + 3]!, EYE_HOT);
  }
  p.px(points[0]!, points[1]!, "#ffe0a0");
}

function koloss(p: Pix): void {
  // Hinteres Bein (Schritt nach hinten)
  p.shape(poly(40, 104, 58, 104, 52, 140, 42, 160, 26, 160, 34, 138), STATUE, { shade: 3, noise: 0.04 });
  p.shape(poly(22, 156, 46, 156, 48, 166, 18, 166), STATUE, { shade: 2 });
  // Riesiger Rundschild hinten links
  p.shape(ellipse(28, 84, 26, 30), BRONZE, { shade: 3, noise: 0.06 });
  p.shape(ellipse(28, 84, 20, 24), STATUE, { shade: 2 });
  p.shape(ellipse(28, 84, 7, 7), BRONZE, { shade: 1 });
  crack(p, [14, 70, 20, 78, 18, 90, 24, 98]);
  // Schurz
  p.shape(poly(42, 96, 96, 96, 100, 122, 38, 122), LINEN, { shade: 2 });
  for (let x = 44; x < 98; x += 6) {
    p.line(x, 98, x - 1, 121, LINEN[1]);
  }
  p.shape(rect(40, 92, 58, 7), STATUE, { shade: 1 });
  // Vorderes Bein (Schritt nach vorn)
  p.shape(poly(72, 118, 92, 118, 100, 140, 108, 160, 90, 160, 82, 140), STATUE, { shade: 3, noise: 0.04 });
  p.shape(poly(86, 156, 114, 156, 118, 166, 84, 166), STATUE, { shade: 2 });
  crack(p, [88, 124, 92, 136, 98, 142]);
  // Rumpf: goldene Brustplatte
  p.shape(poly(38, 44, 102, 44, 98, 96, 42, 96), STATUE, { shade: 4, noise: 0.04 });
  p.line(70, 48, 70, 92, STATUE[1]);
  p.line(52, 62, 66, 66, STATUE[1]);
  p.line(88, 62, 74, 66, STATUE[1]);
  p.line(48, 80, 92, 80, STATUE[1]);
  crack(p, [56, 52, 60, 60, 58, 70, 64, 78, 62, 88]);
  crack(p, [86, 70, 82, 78, 84, 86]);
  // Gluehender Kern in der Brust
  p.shape(ellipse(70, 70, 6, 6), FIRE, { shade: 1, edge: false });
  p.px(68, 68, "#fffbe0");
  // Kragen
  p.shape(ellipse(70, 46, 30, 8), BRONZE, { shade: 2 });
  stripes(p, ellipse(70, 46, 30, 8), CREST_RED[1], 3);
  // Kopf mit Nemes
  const cloth = poly(48, 54, 48, 26, 56, 14, 84, 14, 92, 26, 92, 54, 84, 54, 82, 34, 58, 34, 56, 54);
  p.shape(cloth, GOLD, { shade: 2 });
  stripes(p, cloth, BRONZE[0], 4);
  p.shape(poly(58, 22, 82, 22, 82, 46, 76, 54, 64, 54, 58, 46), STATUE, { shade: 2, noise: 0.03 });
  p.shape(rect(54, 18, 32, 5), GOLD, { shade: 1 });
  p.shape(poly(68, 18, 70, 8, 72, 18), GOLD, { shade: 1 });
  // Leere, gluehende Augen und Bart
  p.fill(rect(62, 30, 6, 3), "#2a1004");
  p.fill(rect(73, 30, 6, 3), "#2a1004");
  p.hline(63, 66, 31, EYE_HOT);
  p.hline(74, 77, 31, EYE_HOT);
  p.px(64, 31, "#ffe0a0");
  p.px(75, 31, "#ffe0a0");
  p.line(70, 34, 70, 42, STATUE[1]);
  p.shape(rect(66, 50, 8, 12), STATUE, { shade: 1 });
  stripes(p, rect(66, 50, 8, 12), STATUE[0], 2);
  // Vorderer Arm mit Riesenspeer
  p.shape(thick(100, 52, 106, 80, 14), STATUE, { shade: 2, noise: 0.04 });
  p.shape(ellipse(100, 50, 12, 10), BRONZE, { shade: 2 });
  p.shape(rect(98, 70, 16, 5), BRONZE, { shade: 0 });
  p.shape(thick(86, 166, 126, 4, 4), WOOD, { shade: 1 });
  p.shape(poly(120, 14, 126, -2, 131, 16, 126, 24), STEEL, { shade: 1 });
  p.shape(ellipse(106, 86, 8.5, 7.5), STATUE, { shade: 2 });
  p.line(100, 84, 112, 83, STATUE[1]);
  p.line(100, 88, 112, 87, STATUE[1]);
}

/** Malt eine Figur der goldenen Armee. */
export function paintArmy(id: ArmyId): Pix {
  const [w, h] = ARMY_SIZE[id];
  const p = new Pix(w, h, 29);
  switch (id) {
    case "laeufer":
      laeufer(p);
      break;
    case "enterer":
      enterer(p);
      break;
    case "phalanx":
      phalanx(p);
      break;
    case "skarabaeus":
      skarabaeus(p);
      break;
    case "priester":
      priester(p);
      break;
    case "streitwagen":
      streitwagen(p);
      break;
    case "ballista":
      ballista(p);
      break;
    case "turm":
      turm(p);
      break;
    case "koloss":
      koloss(p);
      break;
  }
  p.outline(OUTLINE);
  return p;
}
