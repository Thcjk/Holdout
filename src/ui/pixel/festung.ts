/**
 * Die Wanderfestung "Holdout" (Entwurf): eine Bohrplattform auf sechs Spinnenbeinen,
 * angetrieben vom gestohlenen Sonnenherz. Ansicht schraeg von vorn wie die Figuren.
 *
 * Aufbau in der Leinwand (FORT_W x FORT_H):
 *   - Deck: Raster aus DECK_COLS x DECK_ROWS Feldern (TILE_W x TILE_H) ab (DECK_X, DECK_Y)
 *   - Rumpf: Vorderwand unter der Deckkante, HULL_H hoch
 *   - Darunter Luft bis zum Boden (ELEVATION ab Deckkante): dort stehen die Beine,
 *     und Gegner unter der Festung sind vom Deck aus nicht zu sehen.
 * Module stehen auf Feldern; ihr Fusspunkt ist `tileFoot(c, r)`.
 */

import { hazard } from "./buildings";
import {
  CYAN,
  CYAN_DARK,
  CYAN_LIGHT,
  FIRE,
  GOLD,
  GRAY,
  ORANGE,
  OUTLINE,
  SKY,
  STEEL,
  VISOR,
  WOOD,
  YELLOW,
} from "./palette";
import { ellipse, Pix, poly, rect, thick, union, type Ramp } from "./pix";

export const FORT_W = 440;
export const FORT_H = 264;
export const DECK_X = 80;
export const DECK_Y = 40;
export const DECK_COLS = 7;
export const DECK_ROWS = 4;
export const TILE_W = 40;
export const TILE_H = 32;
export const HULL_H = 28;
/** Abstand Deckkante vorn -> Boden (in Pixeln nach unten). */
export const ELEVATION = 72;

/** Rumpf: dunkles Blaugrau der Crew. */
export const HULL: Ramp = ["#121318", "#2c2e36", "#43464f", "#646873"];
const PLATE: Ramp = ["#141519", "#32343b", "#484b54", "#6a6e79"];
/** Lack der Module: Eisengrau, damit die blauen Mechs davor auffallen. */
const IRON: Ramp = ["#16171c", "#3a3d46", "#5a5e6a", "#868b98"];
const TEAL: Ramp = ["#0e1c1e", "#1f4a4e", "#2e6e72", "#4fa0a2"];
const COPPER: Ramp = ["#2a1408", "#7a3e1a", "#b8682e", "#e89a5a"];
const ROPE = "#d8b878";

/** Mitte der Unterkante eines Felds (dort steht der Fuss eines Moduls). */
export function tileFoot(col: number, row: number): [number, number] {
  return [DECK_X + col * TILE_W + TILE_W / 2, DECK_Y + row * TILE_H + TILE_H - 4];
}

function rivet(p: Pix, x: number, y: number): void {
  p.px(x, y, PLATE[3]);
  p.px(x + 1, y + 1, PLATE[0]);
}

/** Ein Spinnenbein: Oberschenkel zum Knie (oben), Unterschenkel zum Fuss (Boden). */
function leg(p: Pix, ax: number, ay: number, kx: number, ky: number, fx: number, fy: number): void {
  // Kolben parallel zum Oberschenkel
  p.shape(thick(ax, ay + 6, (ax + kx) / 2, (ay + ky) / 2 + 8, 3), STEEL, { shade: 0 });
  // Oberschenkel
  p.shape(thick(ax, ay, kx, ky, 13), HULL, { shade: 2 });
  p.line(ax + (kx - ax) * 0.25, ay + (ky - ay) * 0.25 - 3, ax + (kx - ax) * 0.75, ay + (ky - ay) * 0.75 - 3, HULL[3]);
  // Unterschenkel, unten schmaler
  const dx = fx - kx;
  const dy = fy - ky;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const top = 6.5;
  const bottom = 3.5;
  p.shape(poly(kx + nx * top, ky + ny * top, fx + nx * bottom, fy - 7 + ny * bottom, fx - nx * bottom, fy - 7 - ny * bottom, kx - nx * top, ky - ny * top), HULL, { shade: 2 });
  // Warnstreifen am Schienbein
  const sx = kx + dx * 0.55;
  const sy = ky + dy * 0.55;
  hazard(p, thick(sx, sy, sx + dx * 0.12, sy + dy * 0.12, 8), 3);
  // Knie
  p.shape(ellipse(kx, ky, 7, 7), GRAY, { shade: 2 });
  p.shape(ellipse(kx, ky, 3, 3), STEEL, { shade: 1 });
  p.px(kx - 1, ky - 1, "#ffffff");
  // Fuss: Klaue mit drei Zehen
  p.shape(ellipse(fx, fy - 4, 6, 4), GRAY, { shade: 1 });
  p.shape(poly(fx - 9, fy, fx - 3, fy - 4, fx - 2, fy), STEEL, { shade: 0 });
  p.shape(poly(fx + 9, fy, fx + 3, fy - 4, fx + 2, fy), STEEL, { shade: 0 });
  p.shape(poly(fx - 1, fy + 1, fx, fy - 4, fx + 2, fy + 1), STEEL, { shade: 0 });
}

/** Zeichnet alle Beine einer Seite. `right` spiegelt die x-Werte. */
function legs(p: Pix, which: "back" | "mid" | "front"): void {
  const spec = {
    back: { ay: 58, ky: 22, fy: 136, kx: 38, fx: 22 },
    mid: { ay: 102, ky: 66, fy: 170, kx: 30, fx: 10 },
    front: { ay: 150, ky: 114, fy: 228, kx: 38, fx: 22 },
  }[which];
  leg(p, DECK_X + 4, spec.ay, spec.kx, spec.ky, spec.fx, spec.fy);
  // Rechts gespiegelt; das mittlere rechte Bein steht, dafuer ist das vordere angehoben
  const rightLift = which === "front" ? -10 : which === "mid" ? 8 : 0;
  leg(p, FORT_W - DECK_X - 4, spec.ay, FORT_W - spec.kx, spec.ky, FORT_W - spec.fx, spec.fy + rightLift);
}

function deck(p: Pix): void {
  const x0 = DECK_X;
  const y0 = DECK_Y;
  const w = DECK_COLS * TILE_W;
  const h = DECK_ROWS * TILE_H;
  // Grundplatte mit dunklen Fugen
  p.fill(rect(x0, y0, w, h), PLATE[0]);
  for (let r = 0; r < DECK_ROWS; r += 1) {
    for (let c = 0; c < DECK_COLS; c += 1) {
      const tx = x0 + c * TILE_W;
      const ty = y0 + r * TILE_H;
      const grate = (c + r * 3) % 5 === 2;
      p.shape(rect(tx + 1, ty + 1, TILE_W - 2, TILE_H - 2), PLATE, { shade: 1, edge: false, noise: 0.03 });
      if (grate) {
        // Gitterrost
        for (let gx = tx + 5; gx < tx + TILE_W - 4; gx += 3) {
          p.line(gx, ty + 5, gx, ty + TILE_H - 6, PLATE[0]);
        }
      } else {
        p.line(tx + 6, ty + TILE_H / 2, tx + TILE_W - 7, ty + TILE_H / 2, PLATE[1]);
        p.line(tx + 6, ty + TILE_H / 2 + 1, tx + TILE_W - 7, ty + TILE_H / 2 + 1, PLATE[3]);
      }
      rivet(p, tx + 3, ty + 3);
      rivet(p, tx + TILE_W - 5, ty + 3);
      rivet(p, tx + 3, ty + TILE_H - 5);
      rivet(p, tx + TILE_W - 5, ty + TILE_H - 5);
    }
  }
  // Ein paar Rostflecken und Kratzer
  for (const [x, y] of [[112, 70], [262, 132], [330, 58], [150, 150]] as const) {
    p.fill(ellipse(x, y, 4, 2), "#6a3a2a88");
    p.px(x + 2, y - 1, "#8a4a2a");
  }
  // Kante vorn mit Warnstreifen
  hazard(p, rect(x0, y0 + h - 4, w, 4), 4);
  // Erhoehter Rand hinten und an den Seiten
  p.shape(rect(x0 - 4, y0 - 6, w + 8, 6), HULL, { shade: 1 });
  p.shape(rect(x0 - 4, y0 - 6, 4, h + 6), HULL, { shade: 1 });
  p.shape(rect(x0 + w, y0 - 6, 4, h + 6), HULL, { shade: 1 });
  // Gelaender hinten: Pfosten und Stange
  for (let x = x0; x <= x0 + w; x += 20) {
    p.shape(rect(x - 1, y0 - 18, 3, 13), GRAY, { shade: 0 });
  }
  p.shape(rect(x0 - 2, y0 - 19, w + 4, 3), YELLOW, { shade: 0 });
}

function hull(p: Pix): void {
  const x0 = DECK_X - 4;
  const x1 = DECK_X + DECK_COLS * TILE_W + 4;
  const y0 = DECK_Y + DECK_ROWS * TILE_H;
  const y1 = y0 + HULL_H;
  const face = poly(x0, y0, x1, y0, x1 - 8, y1, x0 + 8, y1);
  p.shape(face, HULL, { shade: 2, noise: 0.03 });
  // Plattenfugen
  p.line(x0 + 2, y0 + 12, x1 - 4, y0 + 12, HULL[1]);
  p.line(x0 + 2, y0 + 13, x1 - 4, y0 + 13, HULL[3]);
  for (let x = x0 + 44; x < x1 - 20; x += 56) {
    p.line(x, y0 + 1, x, y1 - 2, HULL[1]);
  }
  // Bullaugen mit warmem Licht
  for (let x = x0 + 24; x < x1 - 16; x += 40) {
    p.shape(ellipse(x, y0 + 6, 4, 3.5), GRAY, { shade: 1 });
    p.fill(ellipse(x, y0 + 6, 2.2, 2), ORANGE[2]);
    p.px(x - 1, y0 + 5, ORANGE[3]);
  }
  // Warnband unten
  hazard(p, poly(x0 + 4, y1 - 7, x1 - 4, y1 - 7, x1 - 8, y1, x0 + 8, y1), 5);
  // Gelber Schriftzug-Ersatz: Crew-Wappen (Zahnrad mit Sonne)
  const ex = (x0 + x1) / 2;
  const ey = y0 + 19;
  p.shape(ellipse(ex, ey - 1, 9, 7), YELLOW, { shade: 1 });
  p.shape(ellipse(ex, ey - 1, 5.5, 4), HULL, { shade: 0 });
  p.shape(ellipse(ex, ey - 1, 3, 2.2), GOLD, { shade: 0, edge: false });
  for (const [dx, dy] of [[-10, -1], [10, -1], [0, -8], [-7, -6], [7, -6]] as const) {
    p.px(ex + dx, ey - 1 + dy, YELLOW[2]);
  }
  // Strickleiter haengt herunter (dort klettern die Mechs hoch)
  const lx = DECK_X + 5 * TILE_W + 8;
  for (let y = y1; y < y1 + 34; y += 1) {
    p.px(lx, y, ROPE);
    p.px(lx + 8, y, ROPE);
  }
  for (let y = y1 + 4; y < y1 + 34; y += 6) {
    p.hline(lx, lx + 8, y, WOOD[2]);
  }
  // Scheinwerfer unter dem Bug
  p.shape(rect(x1 - 30, y1 - 2, 10, 5), GRAY, { shade: 1 });
  p.px(x1 - 26, y1 + 2, "#fff6c0");
  p.px(x1 - 24, y1 + 2, "#fff6c0");
}

/** Die Festung ohne Module. */
export function paintFortress(): Pix {
  const p = new Pix(FORT_W, FORT_H, 17);
  legs(p, "back");
  legs(p, "mid");
  hull(p);
  deck(p);
  legs(p, "front");
  p.outline(OUTLINE);
  return p;
}

// --- Module ----------------------------------------------------------------------------------

export type ModuleId =
  | "geschuetz"
  | "harpune"
  | "moerser"
  | "spule"
  | "platte"
  | "oel"
  | "motor"
  | "generator"
  | "magnet"
  | "werkstatt"
  | "herz"
  | "bruecke";

export interface ModuleInfo {
  id: ModuleId;
  name: string;
  /** Felder breit x hoch. */
  size: readonly [number, number];
  cost: number;
}

export const MODULES: readonly ModuleInfo[] = [
  { id: "geschuetz", name: "Geschützturm", size: [1, 1], cost: 25 },
  { id: "harpune", name: "Harpune", size: [1, 1], cost: 35 },
  { id: "moerser", name: "Mörser", size: [1, 1], cost: 45 },
  { id: "spule", name: "Funkenspule", size: [1, 1], cost: 40 },
  { id: "platte", name: "Panzerplatte", size: [1, 1], cost: 10 },
  { id: "oel", name: "Ölkessel", size: [1, 1], cost: 20 },
  { id: "generator", name: "Generator", size: [1, 1], cost: 30 },
  { id: "magnet", name: "Schrottmagnet", size: [1, 1], cost: 25 },
  { id: "motor", name: "Dampfmotor", size: [2, 1], cost: 50 },
  { id: "werkstatt", name: "Werkstatt", size: [2, 1], cost: 45 },
];

/** Groesse der Modul-Leinwand: Breite = Felder * 40, Hoehe fest. Fuss unten mittig. */
export function moduleCanvasSize(id: ModuleId): [number, number] {
  if (id === "herz") {
    return [80, 92];
  }
  if (id === "bruecke") {
    return [40, 84];
  }
  if (id === "motor") {
    return [80, 64];
  }
  if (id === "werkstatt") {
    return [80, 52];
  }
  return [40, 52];
}

function plinth(p: Pix, cx: number, cy: number, rx: number, ry: number): void {
  p.shape(ellipse(cx, cy, rx, ry), GRAY, { shade: 1 });
  const ring = ellipse(cx, cy, rx - 1, ry - 1);
  const topFace = ellipse(cx, cy - 1, rx - 3, ry - 2);
  hazard(p, { ...ring, test: (x, y) => ring.test(x, y) && !topFace.test(x, y) && y > cy }, 3);
  p.shape(topFace, STEEL, { shade: 1 });
}

function geschuetz(p: Pix): void {
  plinth(p, 20, 45, 15, 6);
  p.shape(rect(15, 33, 10, 10), GRAY, { shade: 1 });
  p.shape(union(ellipse(19, 30, 11, 8), rect(8, 30, 22, 6)), IRON, { shade: 2 });
  p.shape(ellipse(17, 26, 5, 2.5), TEAL, { shade: 0 });
  // Zwei Laeufe nach rechts
  p.shape(rect(26, 25, 14, 3), GRAY, { shade: 0 });
  p.shape(rect(26, 31, 14, 3), GRAY, { shade: 0 });
  p.px(39, 26, CYAN);
  p.px(39, 32, CYAN);
  p.px(12, 32, CYAN);
  p.px(13, 32, CYAN_LIGHT);
}

function harpune(p: Pix): void {
  plinth(p, 20, 45, 14, 6);
  p.shape(rect(15, 30, 9, 12), GRAY, { shade: 1 });
  // Seiltrommel
  p.shape(ellipse(10, 34, 6, 6), GRAY, { shade: 1 });
  p.shape(ellipse(10, 34, 3.5, 3.5), [OUTLINE, "#8a6a3a", ROPE, "#f4e0b0"], { shade: 1, edge: false });
  // Werferrohr schraeg nach rechts oben
  p.shape(thick(8, 30, 32, 20, 7), IRON, { shade: 2 });
  p.shape(thick(26, 22.5, 30, 21, 8), GRAY, { shade: 0 });
  // Harpunenspitze mit Widerhaken
  p.shape(poly(31, 17, 40, 18, 32, 24), STEEL, { shade: 1 });
  p.px(33, 16, STEEL[3]);
  p.px(33, 25, STEEL[3]);
  p.line(10, 34, 31, 21, ROPE);
}

function moerser(p: Pix): void {
  plinth(p, 20, 45, 15, 6);
  p.shape(thick(15, 40, 24, 19, 13), GRAY, { shade: 2 });
  hazard(p, thick(17.5, 34, 19.5, 29.5, 13), 3);
  p.shape(ellipse(24.5, 18, 7, 3.4), STEEL, { shade: 0 });
  p.fill(ellipse(24.5, 18, 4.6, 2), OUTLINE);
  // Granaten daneben
  for (const x of [32, 36]) {
    p.shape(union(rect(x - 1.5, 37, 3, 6), ellipse(x, 37, 1.5, 1.8)), ORANGE, { shade: 0 });
  }
}

function spule(p: Pix): void {
  plinth(p, 20, 45, 13, 5.5);
  p.shape(rect(16, 12, 8, 30), COPPER, { shade: 2 });
  for (const y of [16, 22, 28, 34]) {
    p.shape(ellipse(20, y, 7, 2.3), COPPER, { shade: 1 });
  }
  p.shape(ellipse(20, 9, 6, 6), STEEL, { shade: 2 });
  p.px(18, 7, "#ffffff");
  // Funken
  p.line(26, 6, 30, 3, CYAN_LIGHT);
  p.line(30, 3, 33, 6, CYAN);
  p.line(13, 6, 9, 2, CYAN);
  p.px(8, 2, CYAN_LIGHT);
}

function platte(p: Pix): void {
  p.shape(rect(2, 22, 36, 24), STEEL, { shade: 2, noise: 0.04 });
  hazard(p, rect(3, 22, 34, 4), 4);
  for (let x = 4; x < 38; x += 6) {
    p.shape(poly(x, 22, x + 3, 13, x + 5, 22), STEEL, { shade: 0 });
  }
  for (const [x, y] of [[5, 29], [33, 29], [5, 41], [33, 41]] as const) {
    p.px(x, y, STEEL[3]);
    p.px(x + 1, y + 1, STEEL[0]);
  }
  p.line(8, 35, 30, 35, STEEL[1]);
}

function oel(p: Pix): void {
  // Feuer unter dem Kessel
  p.shape(poly(10, 46, 14, 36, 17, 42, 20, 33, 23, 42, 26, 36, 30, 46), FIRE, { shade: 0, light: 0 });
  p.shape(rect(9, 42, 4, 6), GRAY, { shade: 0 });
  p.shape(rect(27, 42, 4, 6), GRAY, { shade: 0 });
  p.shape(ellipse(20, 32, 13, 10), GRAY, { shade: 2 });
  p.shape(ellipse(20, 25, 11, 3.5), GRAY, { shade: 0 });
  p.fill(ellipse(20, 25.5, 9, 2.4), "#1a1010");
  p.hline(15, 18, 25, ORANGE[2]);
  // Ausguss nach vorn
  p.shape(poly(28, 30, 39, 33, 39, 36, 28, 35), GRAY, { shade: 1 });
  p.px(39, 37, "#1a1010");
}

function generator(p: Pix): void {
  p.shape(rect(5, 20, 30, 26), GRAY, { shade: 2 });
  p.shape(rect(5, 16, 30, 5), IRON, { shade: 1 });
  for (const x of [9, 17, 25]) {
    p.shape(rect(x, 24, 6, 14), VISOR, { shade: 0 });
    p.shape(rect(x + 1, 27, 4, 10), [OUTLINE, CYAN_DARK, CYAN, CYAN_LIGHT], { shade: 1, edge: false });
  }
  // Blitzsymbol
  p.line(20, 40, 18, 43, YELLOW[2]);
  p.line(18, 43, 22, 43, YELLOW[2]);
  p.line(22, 43, 20, 46, YELLOW[2]);
  p.px(8, 17, CYAN);
  p.px(31, 17, CYAN);
}

function magnet(p: Pix): void {
  plinth(p, 14, 45, 11, 5);
  p.shape(rect(10, 14, 7, 30), GRAY, { shade: 1 });
  p.shape(thick(11, 15, 34, 9, 5), YELLOW, { shade: 1 });
  hazard(p, thick(18, 13, 28, 10.5, 5), 3);
  p.line(33, 11, 33, 24, GRAY[2]);
  // Hufeisen-Magnet
  p.shape(poly(26, 24, 40, 24, 40, 36, 36, 36, 36, 28, 30, 28, 30, 36, 26, 36), [OUTLINE, "#8e2028", "#d8383a", "#ff7a6a"], { shade: 1 });
  p.shape(rect(26, 34, 4, 3), STEEL, { shade: 0 });
  p.shape(rect(36, 34, 4, 3), STEEL, { shade: 0 });
}

function motor(p: Pix): void {
  // Zwei hohe Schornsteine hinten
  for (const x of [8, 18]) {
    p.shape(rect(x, 2, 8, 34), GRAY, { shade: 1 });
    p.shape(rect(x - 1, 2, 10, 3), STEEL, { shade: 0 });
    p.fill(rect(x + 1, 3, 6, 1), OUTLINE);
  }
  // Kessel liegend
  const boiler = union(rect(12, 28, 48, 24), ellipse(12, 40, 6, 12), ellipse(60, 40, 6, 12));
  p.shape(boiler, IRON, { shade: 2 });
  for (const x of [22, 38, 52]) {
    p.shape(rect(x, 28, 4, 24), COPPER, { shade: 0 });
  }
  // Feuerloch
  p.shape(rect(12, 42, 9, 7), GRAY, { shade: 0 });
  p.fill(rect(13, 44, 7, 4), ORANGE[2]);
  p.hline(14, 18, 44, ORANGE[3]);
  // Manometer
  p.shape(ellipse(30, 35, 3.5, 3.5), WOOD, { shade: 0 });
  p.fill(ellipse(30, 35, 2.4, 2.4), "#f6f1e2");
  p.line(30, 35, 31, 33, OUTLINE);
  // Schwungrad mit Kolben
  p.shape(rect(58, 38, 10, 4), STEEL, { shade: 0 });
  p.shape(ellipse(70, 46, 9, 9), GRAY, { shade: 2 });
  p.fill(ellipse(70, 46, 5.5, 5.5), "#1a1e2a");
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI;
    p.line(70 - Math.cos(a) * 6, 46 - Math.sin(a) * 6, 70 + Math.cos(a) * 6, 46 + Math.sin(a) * 6, STEEL[2]);
  }
  p.shape(ellipse(70, 46, 2, 2), YELLOW, { shade: 0 });
  p.shape(rect(6, 54, 66, 6), GRAY, { shade: 1 });
}

function werkstatt(p: Pix): void {
  // Werkbank
  p.shape(rect(4, 36, 60, 5), STEEL, { shade: 0 });
  p.shape(rect(6, 41, 4, 9), GRAY, { shade: 0 });
  p.shape(rect(58, 41, 4, 9), GRAY, { shade: 0 });
  p.shape(rect(10, 42, 48, 4), WOOD, { shade: 0 });
  // Werkzeuge auf der Bank
  p.shape(rect(12, 32, 10, 4), YELLOW, { shade: 0 });
  p.line(26, 34, 34, 33, STEEL[2]);
  p.shape(rect(36, 30, 6, 6), GRAY, { shade: 0 });
  // Roboterarm mit Schweissspitze
  p.shape(ellipse(66, 44, 8, 5), GRAY, { shade: 1 });
  p.shape(thick(66, 42, 70, 18, 6), IRON, { shade: 1 });
  p.shape(ellipse(70, 17, 4, 4), GRAY, { shade: 1 });
  p.shape(thick(70, 17, 52, 22, 5), IRON, { shade: 1 });
  p.shape(poly(52, 19, 46, 25, 49, 27, 53, 24), STEEL, { shade: 0 });
  // Funken
  for (const [x, y] of [[44, 28], [42, 25], [45, 31], [40, 29], [47, 32]] as const) {
    p.px(x, y, y % 2 ? YELLOW[3] : "#ffffff");
  }
}

/** Das Sonnenherz in seinem Kaefig (2 x 2 Felder). */
function herz(p: Pix): void {
  plinth(p, 40, 80, 36, 10);
  // Hintere Kaefigstaebe
  for (const x of [22, 58]) {
    p.shape(rect(x - 2, 22, 4, 54), IRON, { shade: 1 });
  }
  // Goldene Sonne
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = 15;
    const r1 = i % 2 === 0 ? 24 : 20;
    p.shape(thick(40 + Math.cos(a) * r0, 46 + Math.sin(a) * r0, 40 + Math.cos(a) * r1, 46 + Math.sin(a) * r1, 3), GOLD, { shade: 0, edge: false });
  }
  p.shape(ellipse(40, 46, 15, 15), GOLD, { shade: 3, edge: false });
  p.shape(ellipse(40, 46, 9, 9), FIRE, { shade: 2, edge: false });
  p.shape(ellipse(38, 44, 4, 4), [FIRE[2], FIRE[3], "#fff6c0", "#ffffff"], { shade: 0, light: 0, edge: false, flat: true });
  // Vordere Kaefigstaebe und Ringe
  for (const x of [10, 30, 50, 70]) {
    p.shape(rect(x - 2, 20, 4, 58), TEAL, { shade: 1 });
  }
  p.shape(rect(6, 16, 68, 6), IRON, { shade: 1 });
  p.shape(rect(6, 70, 68, 5), IRON, { shade: 1 });
  for (const x of [12, 40, 68]) {
    p.px(x, 18, CYAN);
  }
  // Kabel zum Deck
  p.line(8, 76, 2, 84, OUTLINE);
  p.line(72, 76, 78, 84, OUTLINE);
}

/** Bruecke: Fuehrerhaus vorn rechts (1 x 2 Felder), Fenster nach rechts. */
function bruecke(p: Pix): void {
  p.shape(rect(4, 34, 32, 44), IRON, { shade: 2 });
  // Dach mit Bug nach rechts
  p.shape(poly(2, 28, 30, 28, 39, 38, 39, 42, 2, 42), TEAL, { shade: 1 });
  // Fensterband
  p.shape(poly(6, 46, 34, 46, 38, 44, 38, 56, 6, 56), VISOR, { shade: 0 });
  for (const x of [14, 24, 33]) {
    p.line(x, 46, x, 56, IRON[1]);
  }
  p.hline(8, 12, 48, SKY[3]);
  p.hline(16, 20, 48, SKY[3]);
  p.px(9, 49, CYAN);
  // Tuer und Warnstreifen
  p.shape(rect(9, 60, 9, 16), GRAY, { shade: 1 });
  hazard(p, rect(4, 74, 32, 4), 4);
  // Antenne und Suchscheinwerfer
  p.line(10, 28, 10, 6, GRAY[2]);
  p.px(10, 5, "#ff4a4a");
  p.shape(rect(22, 20, 12, 7), GRAY, { shade: 1 });
  p.fill(rect(31, 21, 3, 5), "#fff6c0");
}

/** Malt ein Modul (Fuss unten mittig). */
export function paintModule(id: ModuleId): Pix {
  const [w, h] = moduleCanvasSize(id);
  const p = new Pix(w, h, 31);
  // Alles ist fuer eine Hoehe von 52 (bzw. 64/92/84) entworfen; Fuss bei h - 6.
  const painters: Record<ModuleId, (p: Pix) => void> = {
    geschuetz,
    harpune,
    moerser,
    spule,
    platte,
    oel,
    motor,
    generator,
    magnet,
    werkstatt,
    herz,
    bruecke,
  };
  painters[id](p);
  p.outline(OUTLINE);
  return p;
}
