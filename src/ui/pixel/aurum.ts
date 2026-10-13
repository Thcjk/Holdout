/**
 * Die neue Welt (Entwurf): Aurum, die goldene Totenstadt unter dem Wuestenmond.
 *
 * Eine Bergbau-Crew in Mechs hat einen Schacht bis auf den alten Platz der
 * Totenstadt gebohrt. Der Boden ist dunkler Basalt mit Goldeinlagen, in der
 * Mitte ein Sonnenmosaik - dort steht der Bohrkern der Crew. Oben, links und
 * rechts fuehren Grabtore in die Tiefe, aus denen die goldene Armee kommt.
 * Scheinwerfer der Crew werfen Lichtkegel, Sand ist durch den Schacht gerieselt.
 *
 * Gemalt in halber Aufloesung (1 Pixel = 2 Entwurfspixel), 480 x 270.
 */

import { seeded } from "../theme";
import { BRONZE, GOLD, GRAY, OUTLINE, STEEL, YELLOW } from "./palette";
import { ellipse, Pix, poly, rect, union, type Ramp } from "./pix";

export const AURUM_W = 480;
export const AURUM_H = 270;
/** Mitte des Sonnenmosaiks (dort steht der Bohrkern). */
export const AURUM_CENTER: readonly [number, number] = [240, 150];

const BASALT = ["#2b2836", "#2f2c3b", "#332f40", "#2d2a39", "#302c3d"];
const JOINT = "#1c1a25";
const INLAY = "#8a6a2c";
const INLAY_LIGHT = "#c89a3e";
const SAND: Ramp = ["#3a2e20", "#5e4a32", "#7a6244", "#98805a"];
const WALL: Ramp = ["#16141e", "#2a2636", "#3a3548", "#4e4860"];

function floor(p: Pix, random: () => number): void {
  const tileW = 16;
  const tileH = 10;
  for (let row = 0; row * tileH < AURUM_H; row += 1) {
    const offset = (row % 2) * 8;
    for (let x = -offset; x < AURUM_W; x += tileW) {
      const color = BASALT[Math.floor(random() * BASALT.length)] ?? BASALT[0]!;
      const y = row * tileH;
      p.fill(rect(x, y, tileW, tileH), color);
      p.hline(x, x + tileW - 1, y, JOINT);
      for (let yy = y; yy < y + tileH; yy += 1) {
        p.px(x, yy, JOINT);
      }
      // Kante oben-links etwas heller, ein paar Kratzer
      p.hline(x + 1, x + tileW - 2, y + 1, "#3a3648");
      if (random() < 0.25) {
        const cx = x + 3 + Math.floor(random() * 10);
        p.line(cx, y + 3, cx + 2, y + 6, JOINT);
      }
    }
  }
}

/** Sonnenmosaik aus Gold im Boden. */
function sunMosaic(p: Pix): void {
  const [cx, cy] = AURUM_CENTER;
  for (const [rx, ry] of [[74, 42], [70, 39], [34, 19]] as const) {
    p.ring(ellipse(cx, cy, rx, ry), INLAY);
  }
  p.ring(ellipse(cx, cy, 72, 40.5), INLAY_LIGHT);
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    p.line(cx + Math.cos(a) * 36, cy + Math.sin(a) * 20.5, cx + Math.cos(a) * 68, cy + Math.sin(a) * 37.5, i % 2 === 0 ? INLAY : "#6a5024");
  }
}

function sandDrift(p: Pix, cx: number, cy: number, rx: number, ry: number): void {
  const mask = ellipse(cx, cy, rx, ry);
  p.shape(mask, SAND, { shade: 1, edge: false });
  // Weicher Rand: Schachbrett nach aussen
  const outer = ellipse(cx, cy, rx + 3, ry + 2);
  for (let y = outer.y0; y <= outer.y1; y += 1) {
    for (let x = outer.x0; x <= outer.x1; x += 1) {
      if (outer.test(x, y) && !mask.test(x, y) && (x + y) % 2 === 0) {
        p.px(x, y, SAND[1]);
      }
    }
  }
}

/** Grabtor: Goldbogen mit dunkler Oeffnung. `w`/`h` = Oeffnung. */
function gate(p: Pix, cx: number, bottom: number, w: number, h: number): void {
  p.shape(union(rect(cx - w / 2 - 6, bottom - h - 2, w + 12, h + 2), ellipse(cx, bottom - h, w / 2 + 6, 8)), GOLD, { shade: 2, noise: 0.06 });
  p.fill(union(rect(cx - w / 2, bottom - h + 2, w, h - 2), ellipse(cx, bottom - h + 2, w / 2, 6)), "#0a0810");
  // Glimmende Augen in der Tiefe
  p.px(cx - 4, bottom - h + 10, "#ffb43c");
  p.px(cx + 3, bottom - h + 10, "#ffb43c");
  p.px(cx - 9, bottom - h + 16, "#ff8a2a");
  p.px(cx + 8, bottom - h + 15, "#ff8a2a");
  // Schlussstein und Saeulen-Kapitelle
  p.shape(poly(cx - 4, bottom - h - 10, cx + 4, bottom - h - 10, cx + 3, bottom - h - 4, cx - 3, bottom - h - 4), BRONZE, { shade: 1 });
  p.shape(rect(cx - w / 2 - 8, bottom - 4, 8, 4), GOLD, { shade: 1 });
  p.shape(rect(cx + w / 2, bottom - 4, 8, 4), GOLD, { shade: 1 });
}

/** Seitliches Grabtor (am linken/rechten Rand): Bogen nach innen gedreht. */
function sideGate(p: Pix, x: number, cy: number, left: boolean): void {
  const dir = left ? 1 : -1;
  const x0 = left ? x : x - 14;
  p.shape(rect(x0, cy - 22, 14, 44), GOLD, { shade: 2, noise: 0.06 });
  p.fill(rect(left ? x0 : x0 + 4, cy - 17, 10, 34), "#0a0810");
  p.px(x0 + (left ? 3 : 9), cy - 4, "#ffb43c");
  p.px(x0 + (left ? 4 : 8), cy + 5, "#ff8a2a");
  p.line(x0 + (left ? 13 : 0), cy - 22, x0 + (left ? 13 : 0), cy + 21, GOLD[1]);
  void dir;
}

/** Abgebrochene Saeule. */
function brokenColumn(p: Pix, x: number, base: number, h: number): void {
  p.shape(rect(x - 1, base - 3, 12, 3), BRONZE, { shade: 1 });
  p.shape(poly(x, base - 3, x + 10, base - 3, x + 10, base - h + 2, x + 6, base - h - 2, x + 3, base - h + 3, x, base - h), GOLD, { shade: 1, noise: 0.05 });
  for (let cx = x + 2; cx < x + 9; cx += 3) {
    for (let y = base - h + 4; y < base - 4; y += 1) {
      p.pxOn(cx, y, GOLD[1]);
    }
  }
}

/** Riesiger goldener Statuenkopf im Sand (halb versunken). */
function statueHead(p: Pix, cx: number, cy: number): void {
  p.shape(union(ellipse(cx, cy, 14, 13), rect(cx - 12, cy, 24, 10)), GOLD, { shade: 2, noise: 0.06 });
  // Helm-Busch
  p.shape(poly(cx - 10, cy - 10, cx - 4, cy - 22, cx + 10, cy - 20, cx + 14, cy - 8, cx + 8, cy - 12), BRONZE, { shade: 1 });
  p.fill(rect(cx - 7, cy - 1, 5, 3), "#2a1a08");
  p.fill(rect(cx + 2, cy - 1, 5, 3), "#2a1a08");
  p.line(cx, cy + 2, cx, cy + 6, GOLD[1]);
  p.hline(cx - 4, cx + 4, cy + 8, GOLD[1]);
  sandDrift(p, cx, cy + 11, 20, 5);
}

function obelisk(p: Pix, x: number, base: number): void {
  p.shape(poly(x, base, x + 12, base, x + 10, base - 40, x + 6, base - 46, x + 2, base - 40), GOLD, { shade: 2, noise: 0.05 });
  for (let y = base - 34; y < base - 6; y += 6) {
    p.px(x + 5, y, GOLD[1]);
    p.px(x + 7, y + 2, GOLD[1]);
  }
}

function sarcophagus(p: Pix, x: number, y: number): void {
  p.shape(poly(x, y + 8, x + 30, y + 8, x + 28, y, x + 2, y), GOLD, { shade: 1, noise: 0.05 });
  p.shape(rect(x + 1, y + 8, 28, 6), BRONZE, { shade: 1 });
  p.hline(x + 6, x + 24, y + 3, GOLD[1]);
}

/** Scheinwerfer-Mast der Crew mit Lichtkegel auf dem Boden. */
function floodlight(p: Pix, x: number, y: number, tx: number, ty: number): void {
  p.fill(ellipse(tx, ty, 34, 18), "#fff6c014");
  p.fill(ellipse(tx, ty, 22, 11), "#fff6c010");
  p.shape(rect(x - 1, y - 30, 3, 30), GRAY, { shade: 0 });
  p.shape(rect(x - 5, y - 34, 11, 6), STEEL, { shade: 1 });
  p.px(x - 3, y - 31, "#fff6c0");
  p.px(x, y - 31, "#fff6c0");
  p.px(x + 3, y - 31, "#fff6c0");
  p.shape(rect(x - 4, y - 2, 9, 3), GRAY, { shade: 0 });
}

function crate(p: Pix, x: number, y: number): void {
  p.shape(rect(x, y, 12, 9), GRAY, { shade: 1 });
  p.hline(x + 1, x + 10, y + 4, YELLOW[2]);
  p.shape(rect(x + 2, y - 4, 9, 4), STEEL, { shade: 0 });
}

/** Malt den Platz der Totenstadt (ohne Bohrkern und Gebaeude). */
export function paintAurum(): Pix {
  const p = new Pix(AURUM_W, AURUM_H, 5);
  const random = seeded(2387);
  floor(p, random);
  sunMosaic(p);

  // Sand, der durch den Schacht gerieselt ist
  sandDrift(p, 40, 262, 70, 16);
  sandDrift(p, 440, 266, 80, 14);
  sandDrift(p, 250, 274, 60, 10);
  sandDrift(p, 470, 60, 26, 30);
  sandDrift(p, 8, 70, 22, 26);

  // Obere Mauer der Totenstadt mit Goldfries
  p.shape(rect(0, 0, AURUM_W, 30), WALL, { shade: 2 });
  p.fill(rect(0, 22, AURUM_W, 3), GOLD[1]);
  p.hline(0, AURUM_W - 1, 22, GOLD[3]);
  for (let x = 2; x < AURUM_W; x += 8) {
    p.px(x, 23, GOLD[0]);
    p.px(x + 2, 24, GOLD[0]);
  }
  for (let x = 0; x < AURUM_W; x += 24) {
    p.line(x, 0, x, 21, WALL[0]);
  }
  gate(p, 240, 34, 26, 26);
  statueHead(p, 190, 30);
  statueHead(p, 292, 30);

  // Seitliche Tore
  sideGate(p, 0, 150, true);
  sideGate(p, AURUM_W, 150, false);

  // Ruinen und Ausgrabung
  brokenColumn(p, 70, 70, 22);
  brokenColumn(p, 400, 76, 16);
  brokenColumn(p, 96, 236, 14);
  obelisk(p, 30, 120);
  obelisk(p, 440, 120);
  sarcophagus(p, 360, 226);
  floodlight(p, 150, 110, 190, 140);
  floodlight(p, 336, 112, 292, 142);
  crate(p, 160, 196);
  crate(p, 174, 200);
  crate(p, 314, 82);
  // Kabel vom Kern zu den Scheinwerfern
  p.line(240, 160, 150, 110, OUTLINE);
  p.line(240, 160, 336, 112, OUTLINE);
  return p;
}
