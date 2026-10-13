/**
 * Das Logo in Pixel-Art: "HOLDOUT" in dicken Goldbuchstaben mit Bronzekante,
 * dahinter ein violetter Zeitriss, darunter ein Steinband "DER ZEITRISS" mit
 * cyanfarbener Mech-Schrift.
 *
 * Die Buchstaben kommen aus der Pixelschrift: Text wird klein auf eine Leinwand
 * geschrieben und dann hart auf ganze Pixel gerundet (Maske). Diese Maske wird
 * wie jede andere Form schattiert - so bekommen die Buchstaben Licht und Kante.
 */

import { FONT_TITLE } from "../theme";
import { CYAN, CYAN_LIGHT, GOLD, OUTLINE, RIFT, STONE } from "./palette";
import { type Mask, Pix, poly, rect } from "./pix";

export const LOGO_W = 200;
export const LOGO_H = 80;

/** Schreibt Text klein und macht daraus eine Pixelmaske (Mitte bei cx, oben bei y). */
export function textMask(text: string, size: number, cx: number, y: number, font = FONT_TITLE): Mask {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return rect(0, 0, 0, 0);
  }
  ctx.font = `${size}px ${font}`;
  const width = Math.ceil(ctx.measureText(text).width) + 4;
  const height = Math.ceil(size * 1.3);
  canvas.width = width;
  canvas.height = height;
  ctx.font = `${size}px ${font}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 2, 1);
  const data = ctx.getImageData(0, 0, width, height).data;
  const x0 = Math.round(cx - width / 2);
  const solid = (x: number, y2: number): boolean => {
    const lx = x - x0;
    const ly = y2 - y;
    if (lx < 0 || ly < 0 || lx >= width || ly >= height) {
      return false;
    }
    return (data[(ly * width + lx) * 4 + 3] ?? 0) > 110;
  };
  return { test: solid, x0, y0: y, x1: x0 + width, y1: y + height };
}

export function paintLogo(): Pix {
  const p = new Pix(LOGO_W, LOGO_H, 3);
  const cx = LOGO_W / 2;

  // Zeitriss hinter der Schrift: gezackter Spalt mit Leuchten
  const crack = poly(cx - 6, 0, cx + 4, 8, cx - 2, 16, cx + 7, 26, cx, 34, cx + 6, 44, cx - 3, 54, cx + 2, 62, cx - 8, 52, cx - 3, 43, cx - 10, 33, cx - 4, 25, cx - 11, 15, cx - 5, 8);
  p.fill(poly(cx - 16, 0, cx + 14, 4, cx + 18, 30, cx + 12, 60, cx - 18, 56, cx - 22, 28), "#2a1240");
  p.shape(crack, RIFT, { shade: 1, edge: false });
  p.line(cx - 4, 4, cx + 2, 30, RIFT[3]);
  p.line(cx + 2, 30, cx - 3, 56, RIFT[3]);

  // Steinband mit Untertitel
  const band = poly(cx - 52, 56, cx + 52, 56, cx + 56, 62, cx + 52, 72, cx - 52, 72, cx - 56, 62);
  p.shape(band, STONE, { shade: 1 });
  p.hline(cx - 50, cx + 50, 58, "#6a5a86");
  const sub = textMask("DER ZEITRISS", 14, cx, 57);
  p.fill(sub, CYAN);
  for (let x = sub.x0; x <= sub.x1; x += 1) {
    for (let y = sub.y0; y <= sub.y1; y += 1) {
      if (sub.test(x, y) && !sub.test(x, y - 1)) {
        p.px(x, y, CYAN_LIGHT);
      }
    }
  }
  // Nieten am Band
  for (const x of [cx - 46, cx + 45]) {
    p.px(x, 63, GOLD[3]);
    p.px(x + 1, 64, GOLD[1]);
  }

  // HOLDOUT in Gold
  const letters = textMask("HOLDOUT", 46, cx, 4);
  // Tiefe: dieselbe Maske zweimal versetzt in Bronze darunter
  p.shape({ ...letters, test: (x, y) => letters.test(x, y - 3), y1: letters.y1 + 3 }, ["#2e1c0c", "#5e3a14", "#7a5426", "#9a6e34"], { shade: 0, light: 0, edge: false });
  p.shape(letters, GOLD, { shade: 2, light: 1, edge: false });
  // Glanzlinie oben in den Buchstaben
  for (let x = letters.x0; x <= letters.x1; x += 1) {
    for (let y = letters.y0; y < letters.y0 + 22; y += 1) {
      if (letters.test(x, y) && !letters.test(x, y - 1)) {
        p.px(x, y + 1, "#fffbe0");
        break;
      }
    }
  }
  p.outline(OUTLINE);
  return p;
}
