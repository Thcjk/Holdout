/**
 * Das Logo: blauer Wappenschild mit Krone, dahinter gekreuzt Schwert und
 * Zauberstab, davor der Schriftzug HOLDOUT in dickem Gold, darunter ein rotes
 * Band "DIE LETZTE FESTE". Gemalt wie die Figuren (`figures/kit.ts`).
 */

import { type Ctx, ell, gloss, grainOver, line, LINE, P, part, rect } from "./figures/kit";
import { FONT_TITLE } from "./paper";

export const LOGO_WIDTH = 900;
export const LOGO_HEIGHT = 360;

const GOLD = ["#f6c24c", "#c9851f"] as const;

function crossedWeapons(c: Ctx, cx: number, cy: number): void {
  for (const side of [-1, 1] as const) {
    c.save();
    c.translate(cx, cy);
    c.rotate(side * 0.78);
    if (side === -1) {
      // Schwert
      part(c, P("M -12 -150 L 0 -176 L 12 -150 L 12 50 L -12 50 Z"), { base: "#dfe5ea", shade: "#9aa4b0", dx: -6, dy: 0, line: 5 });
      line(c, "M 0 -146 L 0 44", 3, "rgba(110,120,132,0.8)");
      part(c, rect(-40, 46, 80, 16, 6), { base: GOLD[0], shade: GOLD[1], dx: 0, dy: -4, line: 5 });
      part(c, rect(-9, 62, 18, 44, 6), { base: "#3f5f9e", shade: "#2b4374", dx: -3, dy: 0, line: 5 });
      part(c, ell(0, 114, 12, 12), { base: GOLD[0], shade: GOLD[1], dx: -2, dy: -2, line: 5 });
    } else {
      // Zauberstab mit Kristall
      part(c, rect(-8, -132, 16, 250, 8), { base: "#9a6236", shade: "#6b4228", dx: -4, dy: 0, line: 5 });
      part(c, rect(-14, -138, 28, 14, 5), { base: GOLD[0], shade: GOLD[1], dx: 0, dy: -3, line: 5 });
      const glow = c.createRadialGradient(0, -170, 4, 0, -170, 60);
      glow.addColorStop(0, "rgba(160,220,255,0.7)");
      glow.addColorStop(1, "rgba(160,220,255,0)");
      c.fillStyle = glow;
      c.fillRect(-60, -230, 120, 120);
      part(c, P("M 0 -206 L 22 -170 L 0 -134 L -22 -170 Z"), { base: "#a6e0ff", shade: "#5fb4e8", dx: -6, dy: 0, line: 5 });
      gloss(c, -6, -178, 4, 10, 0.7, 0.3);
    }
    c.restore();
  }
}

function shield(c: Ctx, cx: number): void {
  const outer = P(`M ${cx - 128} 26 Q ${cx} 2 ${cx + 128} 26 L ${cx + 128} 150 Q ${cx + 120} 252 ${cx} 300 Q ${cx - 120} 252 ${cx - 128} 150 Z`);
  part(c, outer, { base: GOLD[0], shade: GOLD[1], dx: -10, dy: -8, line: 6 });
  const inner = P(`M ${cx - 110} 40 Q ${cx} 20 ${cx + 110} 40 L ${cx + 110} 148 Q ${cx + 102} 238 ${cx} 278 Q ${cx - 102} 238 ${cx - 110} 148 Z`);
  part(c, inner, { base: "#4d6aa3", shade: "#344f86", dx: -16, dy: -10, line: 4, hi: [cx - 50, 70, 90], light: 0.3 });
  // Nieten auf dem Goldrand
  for (const [x, y] of [[-116, 40], [116, 40], [-116, 140], [116, 140], [0, 290]] as const) {
    part(c, ell(cx + x, y, 5, 5), { base: "#fff0b0", shade: GOLD[1], dx: -1, dy: -1, line: 2.4 });
  }
  // Krone oben im Schild
  const crown = P(`M ${cx - 40} 98 L ${cx - 46} 56 L ${cx - 22} 76 L ${cx} 46 L ${cx + 22} 76 L ${cx + 46} 56 L ${cx + 40} 98 Z`);
  part(c, crown, { base: GOLD[0], shade: GOLD[1], dx: -6, dy: -3, line: 4.5 });
  for (const x of [-46, 0, 46]) {
    part(c, ell(cx + x, x === 0 ? 44 : 54, 6, 6), { base: "#d9533f", shade: "#a33a2b", dx: -1, dy: -1, line: 3 });
  }
}

function wordmark(c: Ctx, cx: number, cy: number): void {
  let size = 158;
  c.font = `${size}px ${FONT_TITLE}`;
  while (c.measureText("HOLDOUT").width > 780 && size > 60) {
    size -= 4;
    c.font = `${size}px ${FONT_TITLE}`;
  }
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  // Dicke dunkle Kante und Tiefe (mehrfach nach unten versetzt)
  c.strokeStyle = LINE;
  c.lineWidth = 26;
  for (let k = 12; k >= 0; k -= 3) {
    c.strokeText("HOLDOUT", cx, cy + k);
  }
  c.fillStyle = "#8a4f1a";
  c.fillText("HOLDOUT", cx, cy + 9);
  c.lineWidth = 10;
  c.strokeStyle = LINE;
  c.strokeText("HOLDOUT", cx, cy);
  const gradient = c.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
  gradient.addColorStop(0, "#fff4b8");
  gradient.addColorStop(0.42, "#ffd05a");
  gradient.addColorStop(0.58, "#f2a632");
  gradient.addColorStop(1, "#c46f1c");
  c.fillStyle = gradient;
  c.fillText("HOLDOUT", cx, cy);
  // Glanzstreifen oben in den Buchstaben
  c.save();
  c.beginPath();
  c.rect(0, cy - size * 0.4, LOGO_WIDTH, size * 0.16);
  c.clip();
  c.fillStyle = "rgba(255,255,255,0.45)";
  c.fillText("HOLDOUT", cx, cy);
  c.restore();
}

function ribbon(c: Ctx, cx: number, by: number): void {
  for (const side of [-1, 1] as const) {
    part(c, P(`M ${cx + side * 176} ${by - 14} L ${cx + side * 262} ${by - 6} L ${cx + side * 236} ${by + 16} L ${cx + side * 264} ${by + 40} L ${cx + side * 176} ${by + 32} Z`), {
      base: "#9a2a22",
      shade: "#6e1a16",
      dx: 0,
      dy: -6,
      line: 4.5,
    });
  }
  const band = P(`M ${cx - 206} ${by - 26} Q ${cx} ${by - 42} ${cx + 206} ${by - 26} L ${cx + 206} ${by + 24} Q ${cx} ${by + 8} ${cx - 206} ${by + 24} Z`);
  part(c, band, { base: "#c94235", shade: "#962620", dx: 0, dy: -8, line: 4.5 });
  c.font = `36px ${FONT_TITLE}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  c.lineWidth = 6;
  c.strokeStyle = "#5e1712";
  c.strokeText("DIE LETZTE FESTE", cx, by - 7);
  c.fillStyle = "#f8ead0";
  c.fillText("DIE LETZTE FESTE", cx, by - 7);
}

/** Malt das Logo in eine Leinwand von LOGO_WIDTH x LOGO_HEIGHT. */
export function paintLogo(c: Ctx): void {
  const cx = LOGO_WIDTH / 2;
  crossedWeapons(c, cx, 170);
  shield(c, cx);
  wordmark(c, cx, 184);
  ribbon(c, cx, 316);
  grainOver(c, LOGO_WIDTH, LOGO_HEIGHT, 0.04);
}
