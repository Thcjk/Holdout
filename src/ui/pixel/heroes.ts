/**
 * Die sechs Helden: blaue Mechs, Pixel fuer Pixel (64 x 64, Fuesse bei y = 62).
 *
 * Alle teilen denselben Bauplan (`mechBody`: Beine mit Kniegelenk, Huefte mit
 * Panzerschurz, Rumpf mit Kragen und Leuchtkern, Schulterpanzer, Arme) und
 * unterscheiden sich in Helm, Farben, Zubehoer und Statur:
 *   Waechter  - Klingen-Flossen, langes Visier, Energieschild (Startheld)
 *   Koloss    - breit und schwer, kleiner Kopf, Riesenfaeuste, Warnstreifen
 *   Spaeher   - schlank und hell, grosses Zielauge, Antenne und Radar
 *   Pyro      - Kuppelhelm mit Atemgitter, Treibstofftanks auf dem Ruecken
 *   Phantom   - dunkler Tarn-Mech, lange Flosse, Energieschal
 *   Ingenieur - runder Kopf mit Brille, Werkzeug-Rucksack, kleine Drohne
 * Jede Figur schaut nach rechts; das Spiel spiegelt sie beim Laufen nach links.
 */

import type { CharacterId } from "../../game/types";
import {
  BLUE,
  BLUE_DEEP,
  CYAN,
  CYAN_DARK,
  CYAN_LIGHT,
  GRAY,
  INDIGO,
  ORANGE,
  OUTLINE,
  SKY,
  VISOR,
  WHITE,
  YELLOW,
} from "./palette";
import { ellipse, Pix, poly, rect, type Ramp, union } from "./pix";

export const HERO_SIZE = 64;

const GLOW: Ramp = [OUTLINE, CYAN_DARK, CYAN, CYAN_LIGHT];

interface Spec {
  armor: Ramp;
  /** Zweite Panzerfarbe (Brustplatte, Schienbeine). */
  trim: Ramp;
  joint?: Ramp;
  glow?: Ramp;
  /** Zusaetzliche Breite (Koloss) bzw. negativ fuer schlanke Mechs. */
  bulk?: number;
}

/** Eingravierte Plattenfuge: dunkle Linie mit hellem Pixel darunter (wirkt wie eine Kante). */
function seam(p: Pix, x0: number, y0: number, x1: number, y1: number, ramp: Ramp): void {
  p.line(x0, y0 + 1, x1, y1 + 1, ramp[3]);
  p.line(x0, y0, x1, y1, ramp[1]);
}

/** Niete / Bolzen. */
function bolt(p: Pix, x: number, y: number, ramp: Ramp): void {
  p.px(x, y, ramp[3]);
  p.px(x + 1, y + 1, ramp[1]);
}

function glowLight(p: Pix, x: number, y: number, w: number, h: number, glow: Ramp): void {
  p.shape(rect(x - 1, y - 1, w + 2, h + 2), [OUTLINE, GRAY[0], GRAY[1], GRAY[1]], { shade: 0, light: 0 });
  p.shape(rect(x, y, w, h), glow, { shade: 1, light: 0, edge: false });
  p.px(x, y, glow[3]);
}

/** Beine, Huefte, Rumpf, Schultern und Arme (der Kopf kommt danach). */
function mechBody(p: Pix, s: Spec): void {
  const a = s.armor;
  const t = s.trim;
  const j = s.joint ?? GRAY;
  const b = s.bulk ?? 0;
  const glow = s.glow ?? GLOW;

  // --- Hinteres Bein (links)
  p.shape(rect(22 - b, 46, 7, 7), j, { shade: 1 });
  p.shape(ellipse(25.5 - b, 53, 3.6, 3), j, { shade: 1 });
  p.shape(poly(19 - b, 53, 29 - b, 53, 30 - b, 59, 19 - b, 59), t, { shade: 2 });
  seam(p, 20 - b, 56, 28 - b, 56, t);
  p.shape(poly(17 - b, 58, 30 - b, 58, 32 - b, 62, 16 - b, 62), j, { shade: 1 });
  // --- Vorderes Bein (rechts)
  p.shape(rect(35 + b, 46, 7, 7), j, { shade: 1 });
  p.shape(ellipse(38.5 + b, 53, 3.6, 3), j, { shade: 1 });
  p.shape(poly(33 + b, 53, 43 + b, 53, 44 + b, 59, 33 + b, 59), t, { shade: 2 });
  seam(p, 34 + b, 56, 43 + b, 56, t);
  p.shape(poly(32 + b, 58, 46 + b, 58, 49 + b, 62, 32 + b, 62), j, { shade: 1 });
  p.hline(42 + b, 47 + b, 59, j[3]);
  // Kniekappen
  p.shape(ellipse(25.5 - b, 52.5, 2.6, 2.2), a, { shade: 1 });
  p.shape(ellipse(38.5 + b, 52.5, 2.6, 2.2), a, { shade: 1 });

  // --- Hinterer Arm
  p.shape(rect(15 - b, 36, 5, 6), j, { shade: 1 });
  p.shape(poly(13 - b, 41, 20 - b, 41, 20 - b, 48, 14 - b, 48), a, { shade: 2 });
  seam(p, 14 - b, 44, 19 - b, 44, a);
  p.shape(ellipse(17 - b, 50.5, 3.6 + b * 0.3, 3.3 + b * 0.3), j, { shade: 1 });

  // --- Huefte mit Panzerschurz
  p.shape(poly(22 - b, 42, 42 + b, 42, 41 + b, 48, 23 - b, 48), j, { shade: 1 });
  p.shape(poly(27, 43, 37, 43, 36, 50, 28, 50), a, { shade: 2 });
  p.hline(29, 35, 45, a[3]);

  // --- Rumpf
  p.shape(poly(20 - b, 29, 44 + b, 29, 42 + b, 43, 22 - b, 43), a, { shade: 3 });
  p.shape(poly(24 - b, 32, 40 + b, 32, 38 + b, 41, 26 - b, 41), t, { shade: 2 });
  seam(p, 32, 33, 32, 40, t);
  seam(p, 26 - b, 37, 38 + b, 37, t);
  p.shape(rect(27, 27, 10, 4), j, { shade: 1 });
  glowLight(p, 30, 34, 4, 3, glow);

  // --- Schulterpanzer
  p.shape(ellipse(20 - b, 33, 6 + b * 0.5, 5.5), a, { shade: 2 });
  p.shape(ellipse(44 + b, 33, 6.8 + b * 0.5, 6), a, { shade: 3 });
  seam(p, 39 + b, 34, 50 + b, 34, a);
  bolt(p, 44 + b, 30, a);
  bolt(p, 18 - b, 31, a);

  // --- Vorderer Arm
  p.shape(rect(44 + b, 38, 5, 4), j, { shade: 1 });
  p.shape(poly(43 + b, 41, 51 + b, 41, 50 + b, 48, 44 + b, 48), a, { shade: 2 });
  p.hline(45 + b, 49 + b, 43, glow[2]);
  p.shape(ellipse(47.5 + b, 50.5, 3.8 + b * 0.3, 3.4 + b * 0.3), j, { shade: 1 });
  p.hline(46 + b, 50 + b, 50, j[1]);
}

/** Glanzstreifen oben links auf einem Helm. */
function shine(p: Pix, x0: number, y0: number, x1: number, y1: number): void {
  p.line(x0, y0, x1, y1, "#ffffff");
  p.px(x0 - 1, y0 + 2, "#e6ecff");
}

/** Hals unter dem Helm. */
function neck(p: Pix): void {
  p.shape(rect(28, 26, 8, 5), GRAY, { shade: 1 });
}

// --- Die sechs ---------------------------------------------------------------------------

function waechter(p: Pix): void {
  // Klingen-Flossen hinten am Helm
  p.shape(poly(23, 13, 13, 1, 16, 1, 28, 10), BLUE, { shade: 1 });
  p.shape(poly(29, 10, 25, 0, 28, 0, 34, 8), BLUE, { shade: 1 });
  mechBody(p, { armor: BLUE, trim: SKY });
  neck(p);
  // Helm: Kuppel mit nach vorn gezogenem Visier
  const head = union(ellipse(30, 17, 12, 11), poly(19, 16, 46, 13, 49, 22, 43, 28, 23, 28, 18, 23));
  p.shape(head, BLUE, { shade: 3 });
  seam(p, 21, 21, 31, 24, BLUE);
  seam(p, 27, 7, 26, 13, BLUE);
  shine(p, 22, 12, 28, 8);
  p.shape(poly(33, 15, 47, 13.5, 48, 21, 34, 22), VISOR, { shade: 1 });
  p.hline(38, 45, 18, CYAN);
  p.hline(39, 44, 17, CYAN_LIGHT);
  p.px(46, 18, CYAN_LIGHT);
  for (const y of [21, 23, 25]) {
    p.hline(20, 23, y, CYAN_DARK);
  }
  // Energieschild am hinteren Arm
  p.shape(poly(3, 30, 18, 27, 20, 52, 11, 57, 2, 51), WHITE, { shade: 2 });
  p.shape(poly(6, 33, 15, 31, 16, 49, 11, 52, 5, 48), SKY, { shade: 2 });
  for (const y of [37, 41, 45]) {
    p.line(8, y, 13, y - 2, CYAN);
    p.line(8, y + 1, 13, y - 1, CYAN_DARK);
  }
  p.shape(rect(8, 30, 6, 2), GRAY, { shade: 0 });
  bolt(p, 4, 32, WHITE);
  bolt(p, 17, 29, WHITE);
}

function koloss(p: Pix): void {
  // Auspuffrohre auf dem Ruecken
  p.shape(rect(13, 16, 4, 12), GRAY, { shade: 1 });
  p.shape(rect(18, 13, 4, 14), GRAY, { shade: 1 });
  p.px(14, 15, ORANGE[3]);
  p.px(19, 12, ORANGE[3]);
  mechBody(p, { armor: BLUE_DEEP, trim: BLUE, bulk: 4, glow: [OUTLINE, YELLOW[1], YELLOW[2], YELLOW[3]] });
  // Riesige Faeuste
  p.shape(ellipse(12, 50, 6, 5.5), BLUE_DEEP, { shade: 2 });
  p.shape(ellipse(52, 50, 6.5, 6), BLUE_DEEP, { shade: 3 });
  for (const y of [48, 51]) {
    seam(p, 48, y, 56, y, BLUE_DEEP);
  }
  // Warnstreifen auf Brust und Schulter
  for (let i = 0; i < 5; i += 1) {
    p.line(22 + i * 4, 42, 25 + i * 4, 39, YELLOW[2]);
  }
  for (let i = 0; i < 3; i += 1) {
    p.line(43 + i * 3, 31, 45 + i * 3, 28, YELLOW[2]);
  }
  // Kleiner, tief sitzender Kopf hinter einem Schutzbuegel
  p.shape(rect(24, 23, 16, 7), GRAY, { shade: 1 });
  p.shape(union(ellipse(32, 19, 10, 8), rect(22, 18, 20, 8)), BLUE_DEEP, { shade: 2 });
  p.shape(rect(25, 19, 16, 5), VISOR, { shade: 1 });
  p.hline(31, 39, 21, YELLOW[2]);
  p.hline(32, 38, 20, YELLOW[3]);
  p.shape(poly(20, 15, 17, 8, 24, 12), YELLOW, { shade: 1 });
  p.shape(poly(41, 12, 47, 7, 44, 15), YELLOW, { shade: 1 });
  seam(p, 23, 26, 41, 26, BLUE_DEEP);
}

function spaeher(p: Pix): void {
  // Radar auf dem Ruecken
  p.shape(rect(14, 18, 3, 12), GRAY, { shade: 0 });
  p.shape(ellipse(12, 15, 5.5, 4), WHITE, { shade: 1 });
  p.shape(ellipse(12, 15, 2.5, 1.6), SKY, { shade: 0 });
  p.px(12, 14, CYAN);
  mechBody(p, { armor: WHITE, trim: SKY, bulk: -1 });
  neck(p);
  // Lange Antenne
  p.line(23, 11, 17, 1, WHITE[1]);
  p.line(24, 11, 18, 1, WHITE[3]);
  p.px(17, 0, CYAN);
  // Schlanker Helm
  const head = union(ellipse(31, 17, 11, 10.5), poly(21, 15, 45, 15, 46, 23, 40, 28, 24, 28, 19, 23));
  p.shape(head, WHITE, { shade: 3 });
  seam(p, 22, 22, 30, 25, WHITE);
  shine(p, 23, 12, 29, 8);
  // Grosses Zielauge
  p.shape(ellipse(39, 19, 5.5, 5.5), VISOR, { shade: 1 });
  p.shape(ellipse(39.5, 19, 3.2, 3.2), GLOW, { shade: 2, edge: false });
  p.px(38, 17, "#ffffff");
  p.ring(ellipse(39, 19, 6.3, 6.3), SKY[1]);
  for (const y of [20, 22, 24]) {
    p.hline(22, 26, y, SKY[1]);
  }
}

function pyro(p: Pix): void {
  // Treibstofftanks auf dem Ruecken, Schlauch zum Arm
  p.shape(union(rect(9, 24, 6, 20), ellipse(12, 24, 3, 2.5)), ORANGE, { shade: 2 });
  p.shape(union(rect(14, 26, 6, 18), ellipse(17, 26, 3, 2.5)), ORANGE, { shade: 2 });
  p.hline(9, 19, 34, ORANGE[0]);
  p.hline(9, 19, 35, ORANGE[3]);
  p.line(16, 44, 24, 49, GRAY[1]);
  mechBody(p, { armor: BLUE, trim: ORANGE, glow: [OUTLINE, ORANGE[1], ORANGE[2], ORANGE[3]] });
  neck(p);
  // Runder Kuppelhelm mit Sichtfenster und Atemgitter
  p.shape(ellipse(31.5, 17, 13, 12.5), BLUE, { shade: 3 });
  shine(p, 22, 12, 28, 7);
  p.shape(ellipse(36, 16, 8, 6.5), VISOR, { shade: 2 });
  p.hline(32, 40, 15, ORANGE[2]);
  p.hline(33, 39, 14, ORANGE[3]);
  p.px(41, 19, "#ffffff");
  p.shape(rect(33, 23, 9, 5), GRAY, { shade: 1 });
  for (const x of [34, 36, 38, 40]) {
    p.line(x, 24, x, 26, GRAY[0]);
  }
  p.shape(rect(21, 7, 5, 4), ORANGE, { shade: 1 });
  p.px(22, 6, ORANGE[3]);
  seam(p, 20, 20, 25, 26, BLUE);
}

function phantom(p: Pix): void {
  // Energieschal weht nach hinten
  p.shape(poly(27, 27, 19, 26, 12, 29, 4, 27, 7, 31, 13, 33, 20, 31, 27, 32), GLOW, { shade: 1 });
  p.line(9, 30, 19, 29, CYAN_LIGHT);
  // Lange, nach hinten gezogene Flosse
  p.shape(poly(23, 14, 6, 4, 9, 4, 18, 9, 29, 14), INDIGO, { shade: 1 });
  mechBody(p, { armor: INDIGO, trim: BLUE_DEEP, bulk: -1 });
  neck(p);
  const head = union(ellipse(31, 18, 11, 10), poly(21, 15, 49, 17, 46, 23, 39, 28, 24, 28, 20, 22));
  p.shape(head, INDIGO, { shade: 3 });
  // Schmaler, leuchtender Schlitz
  p.shape(poly(31, 17, 49, 17, 47, 21, 32, 21), VISOR, { shade: 0 });
  p.hline(35, 46, 19, CYAN);
  p.hline(37, 44, 18, CYAN_LIGHT);
  seam(p, 22, 20, 27, 26, INDIGO);
  seam(p, 29, 8, 26, 14, INDIGO);
  shine(p, 24, 13, 30, 10);
}

function ingenieur(p: Pix): void {
  // Werkzeug-Rucksack mit Antenne
  p.shape(rect(10, 26, 11, 16), GRAY, { shade: 2 });
  p.shape(rect(12, 29, 7, 4), YELLOW, { shade: 1 });
  p.shape(rect(12, 35, 7, 2), GLOW, { shade: 0 });
  p.line(12, 26, 9, 18, GRAY[2]);
  p.px(9, 17, YELLOW[3]);
  mechBody(p, { armor: SKY, trim: YELLOW });
  neck(p);
  // Runder Kopf mit grosser Brille
  p.shape(ellipse(31.5, 18, 12, 11), SKY, { shade: 3 });
  p.shape(rect(20, 15, 26, 4), GRAY, { shade: 1 });
  p.shape(ellipse(35, 17, 4.5, 4.5), YELLOW, { shade: 1 });
  p.shape(ellipse(43, 17, 4.5, 4.5), YELLOW, { shade: 1 });
  p.shape(ellipse(35, 17, 2.6, 2.6), GLOW, { shade: 1, edge: false });
  p.shape(ellipse(43, 17, 2.6, 2.6), GLOW, { shade: 1, edge: false });
  p.px(34, 16, "#ffffff");
  p.px(42, 16, "#ffffff");
  seam(p, 30, 25, 41, 25, SKY);
  shine(p, 23, 12, 29, 9);
  // Kleine Drohne ueber der Schulter
  p.shape(ellipse(53, 8, 5, 3), WHITE, { shade: 1 });
  p.hline(46, 60, 4, GRAY[2]);
  p.line(53, 5, 53, 4, GRAY[1]);
  p.px(55, 8, CYAN);
  p.px(53, 11, CYAN_DARK);
  p.px(52, 12, CYAN_DARK);
}

/** Malt einen Helden in eine neue 64x64-Leinwand. */
export function paintHero(id: CharacterId): Pix {
  const p = new Pix(HERO_SIZE, HERO_SIZE, 11);
  switch (id) {
    case "ritter":
      waechter(p);
      break;
    case "zwerg":
      koloss(p);
      break;
    case "elfe":
      spaeher(p);
      break;
    case "magierin":
      pyro(p);
      break;
    case "schurke":
      phantom(p);
      break;
    case "zauberer":
      ingenieur(p);
      break;
  }
  p.outline(OUTLINE);
  return p;
}
