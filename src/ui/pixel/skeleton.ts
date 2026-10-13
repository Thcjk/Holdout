/**
 * Bausteine fuer die goldene Armee (Pixel-Art): Schaedel, Bronzehelm, Knochen,
 * Rippen, Rundschild. Benutzt von `armee.ts`.
 */

import { BONE, BRONZE, GOLD, OUT, RED, RED_EYE } from "./palette";
import { oval, Pix, poly, rect, thick, type Ramp } from "./pix";

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
      p.shape(
        poly(
          cx + 4,
          cy - 7,
          cx + 1,
          cy - 15,
          cx - 6,
          cy - 17,
          cx - 12,
          cy - 13,
          cx - 13,
          cy - 4,
          cx - 9,
          cy - 3,
          cx - 9,
          cy - 10,
          cx - 4,
          cy - 12,
          cx,
          cy - 9,
        ),
        plume,
        { shade: 1 },
      );
    } else {
      p.shape(poly(cx + 3, cy - 7, cx - 1, cy - 12, cx - 8, cy - 11, cx - 8, cy - 7), plume, {
        shade: 1,
      });
    }
  }
  // Glocke: oben rund, hinten bis zum Kinn, vorn ueber den Augen offen
  p.shape(
    poly(
      cx - 8,
      cy + 3,
      cx - 8,
      cy - 4,
      cx - 5,
      cy - 8,
      cx + 2,
      cy - 9,
      cx + 7,
      cy - 6,
      cx + 8,
      cy - 2,
      cx + 1,
      cy - 2,
      cx - 2,
      cy + 1,
      cx - 3,
      cy + 6,
      cx - 7,
      cy + 6,
    ),
    BRONZE,
    { shade: 1, noise: 0.08 },
  );
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
