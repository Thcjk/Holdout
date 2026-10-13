/**
 * Boden der Wueste in der Abenddaemmerung (Entwurf): roetlicher Sand mit
 * Windrippeln, Felsen, Knochen und Goldscherben. 1 Pixel = 1 Entwurfspixel.
 *
 * Die Farben sind bewusst gedeckt (Rost, Malve), damit die goldene Armee und
 * die blauen Mechs davor leuchten.
 */

import { BONE, GOLD } from "./palette";
import { ellipse, Pix, poly, type Ramp } from "./pix";

export const DUNE = ["#563832", "#5e3e38", "#66443c", "#6e4a42", "#76504a"] as const;
const RIPPLE_DARK = "#4c302c";
const RIPPLE_LIGHT = "#86605a";
export const ROCK: Ramp = ["#1c1216", "#36262a", "#4e3a3a", "#6a5250"];
const SALT = "#8a6c66";

/** Glatter Zufall (Wertrauschen) mit Gitterabstand `cell`. */
function valueNoise(seed: number, cell: number): (x: number, y: number) => number {
  const hash = (ix: number, iy: number): number => {
    let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  return (x, y) => {
    const gx = x / cell;
    const gy = y / cell;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

export interface DesertOptions {
  seed?: number;
  /** Felsen, Knochen, Scherben streuen. */
  debris?: boolean;
  /** Farben ueberschreiben (z. B. fuer eine Oase). */
  tones?: readonly string[];
}

export function paintDesert(w: number, h: number, options: DesertOptions = {}): Pix {
  const seed = options.seed ?? 5;
  const tones = options.tones ?? DUNE;
  const p = new Pix(w, h, seed);
  const big = valueNoise(seed, 150);
  const mid = valueNoise(seed + 1, 26);
  const ripple = valueNoise(seed + 2, 140);
  // Duenen als Relief: Licht von links oben, also hell, wo der Boden nach links oben ansteigt
  const height = (x: number, y: number): number => big(x, y) * 0.92 + mid(x, y) * 0.08;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const slope = (height(x - 4, y - 3) - height(x + 4, y + 3)) * 7;
      const v = 0.5 + slope + (mid(x * 2, y * 2) - 0.5) * 0.12;
      const dither = ((x + y) % 2) * 0.05;
      const i = Math.max(0, Math.min(tones.length - 1, Math.floor((v + dither) * tones.length)));
      p.px(x, y, tones[i]!);
    }
  }
  // Windrippeln: kurze, wellige Linien, nur stellenweise
  for (let y0 = 5; y0 < h; y0 += 11) {
    const phase = (y0 * 0.37) % 6.28;
    for (let x = 0; x < w; x += 1) {
      const y = Math.round(y0 + Math.sin(x / 23 + phase) * 3 + Math.sin(x / 9 + phase * 2) * 1);
      if (ripple(x, y) < 0.55) {
        continue;
      }
      p.px(x, y, RIPPLE_DARK + "88");
      p.px(x, y + 1, RIPPLE_LIGHT + "66");
    }
  }
  if (options.debris !== false) {
    const random = (): number => p.random();
    // Salzflecken
    for (let i = 0; i < 6; i += 1) {
      const cx = random() * w;
      const cy = random() * h;
      for (let k = 0; k < 40; k += 1) {
        p.px(cx + (random() - 0.5) * 30, cy + (random() - 0.5) * 12, SALT);
      }
    }
    // Felsen
    for (let i = 0; i < Math.round((w * h) / 22000); i += 1) {
      const cx = random() * w;
      const cy = random() * h;
      const r = 3 + random() * 7;
      p.fill(ellipse(cx + 2, cy + r * 0.5, r * 1.1, r * 0.4), "#2a1c1c66");
      p.shape(poly(cx - r, cy + r * 0.4, cx - r * 0.6, cy - r * 0.6, cx + r * 0.2, cy - r * 0.8, cx + r, cy - r * 0.1, cx + r * 0.8, cy + r * 0.4), ROCK, { shade: 1 });
    }
    // Knochen und Goldscherben
    for (let i = 0; i < Math.round((w * h) / 30000); i += 1) {
      const cx = Math.round(random() * w);
      const cy = Math.round(random() * h);
      if (random() < 0.5) {
        p.line(cx, cy, cx + 5, cy + 1, BONE[2]);
        p.px(cx - 1, cy - 1, BONE[3]);
        p.px(cx - 1, cy + 1, BONE[3]);
        p.px(cx + 6, cy, BONE[3]);
        p.px(cx + 6, cy + 2, BONE[3]);
      } else {
        p.px(cx, cy, GOLD[2]);
        p.px(cx + 1, cy, GOLD[3]);
        p.px(cx, cy + 1, GOLD[1]);
      }
    }
  }
  return p;
}
