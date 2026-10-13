/**
 * Bausteine fuer Mechs und Maschinen (Pixel-Art): der gemeinsame Mech-Koerper,
 * Plattenfugen, Nieten, Leuchten, Warnstreifen.
 *
 * Der Mech-Koerper (`mechBody`) ist fuer eine 64 x 64-Leinwand entworfen,
 * Fuesse bei y = 62, Blick nach rechts. Helm und Zubehoer malt jede Figur selbst.
 */

import { CYAN, CYAN_DARK, CYAN_LIGHT, GRAY, OUTLINE, YELLOW } from "./palette";
import { ellipse, Pix, poly, rect, type Mask, type Ramp } from "./pix";

export const GLOW: Ramp = [OUTLINE, CYAN_DARK, CYAN, CYAN_LIGHT];

export interface Spec {
  armor: Ramp;
  /** Zweite Panzerfarbe (Brustplatte, Schienbeine). */
  trim: Ramp;
  joint?: Ramp;
  glow?: Ramp;
  /** Zusaetzliche Breite (Koloss) bzw. negativ fuer schlanke Mechs. */
  bulk?: number;
}

/** Eingravierte Plattenfuge: dunkle Linie mit hellem Pixel darunter (wirkt wie eine Kante). */
export function seam(p: Pix, x0: number, y0: number, x1: number, y1: number, ramp: Ramp): void {
  p.line(x0, y0 + 1, x1, y1 + 1, ramp[3]);
  p.line(x0, y0, x1, y1, ramp[1]);
}

/** Niete / Bolzen. */
export function bolt(p: Pix, x: number, y: number, ramp: Ramp): void {
  p.px(x, y, ramp[3]);
  p.px(x + 1, y + 1, ramp[1]);
}

export function glowLight(p: Pix, x: number, y: number, w: number, h: number, glow: Ramp): void {
  p.shape(rect(x - 1, y - 1, w + 2, h + 2), [OUTLINE, GRAY[0], GRAY[1], GRAY[1]], {
    shade: 0,
    light: 0,
  });
  p.shape(rect(x, y, w, h), glow, { shade: 1, light: 0, edge: false });
  p.px(x, y, glow[3]);
}

/** Beine, Huefte, Rumpf, Schultern und Arme (der Kopf kommt danach). */
export function mechBody(p: Pix, s: Spec): void {
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
export function shine(p: Pix, x0: number, y0: number, x1: number, y1: number): void {
  p.line(x0, y0, x1, y1, "#ffffff");
  p.px(x0 - 1, y0 + 2, "#e6ecff");
}

/** Hals unter dem Helm. */
export function neck(p: Pix): void {
  p.shape(rect(28, 26, 8, 5), GRAY, { shade: 1 });
}

/** Gelb-schwarze Warnstreifen innerhalb einer Form. */
export function hazard(p: Pix, mask: Mask, step = 4): void {
  for (let y = mask.y0; y <= mask.y1; y += 1) {
    for (let x = mask.x0; x <= mask.x1; x += 1) {
      if (mask.test(x, y)) {
        p.px(x, y, Math.floor((x + y) / step) % 2 === 0 ? YELLOW[2] : "#1e1c22");
      }
    }
  }
}
