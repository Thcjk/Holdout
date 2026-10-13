/**
 * Die Arena: der Burghof der Feste Holdout, gemalt im Stil der Figuren.
 *
 * Boden aus grossen, abgetretenen Steinplatten in warmem Grau. In den Fugen
 * waechst Moos, an den Raendern draengt Gras herein, hier und da liegen Kiesel,
 * Blaetter und eine Pfuetze. In der Mitte ein runder Platz mit dem Wappen.
 * Oben die Burgmauer mit dem Tor, aus dem die Monster kommen, Bannern und
 * Fackeln; links und rechts Mauerkronen mit Efeu; unten eine Bruestung mit
 * Faessern, Kisten und Heu.
 *
 * Der Boden ist absichtlich ruhig und mittelhell, damit sich Helden und Monster
 * (dunkle Kontur) gut davon abheben.
 */

import { ARENA } from "../game/constants";
import { type Ctx, ell, fill, gloss, grainOver, line, LINE, P, part, rect, tube, within } from "./figures/kit";
import { seeded } from "./paper";

/** So weit reicht das Arenabild ueber die Spielflaeche hinaus (fuer Mauer und Kisten). */
export const ARENA_WALL = 44;

const STONE = ["#a7a192", "#a09a8a", "#aca697", "#9b9584"] as const;
const MORTAR = "#78725f";
const WALL: readonly [string, string] = ["#8e8b98", "#6a6778"];
const WALL_TOP: readonly [string, string] = ["#a3a0ad", "#7c798c"];
const GOLD: readonly [string, string] = ["#f0b23e", "#c27f1d"];

// --- Boden --------------------------------------------------------------------------

/** Eine Steinplatte mit leicht verschobenen Ecken und weich gerundeten Kanten. */
function slab(c: Ctx, x: number, y: number, w: number, h: number, random: () => number): void {
  const j = (): number => (random() - 0.5) * 3;
  const corners = [
    [x + 2 + j(), y + 2 + j()],
    [x + w - 2 + j(), y + 2 + j()],
    [x + w - 2 + j(), y + h - 2 + j()],
    [x + 2 + j(), y + h - 2 + j()],
  ] as const;
  // Leicht gerundete Ecken (arcTo), damit die Platten abgetreten wirken.
  const shape = new Path2D();
  const last = corners[3];
  const first = corners[0];
  shape.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    shape.arcTo(a[0], a[1], b[0], b[1], 5);
  }
  shape.closePath();
  const tone = STONE[Math.floor(random() * STONE.length)]!;
  part(c, shape, { base: tone, shade: "#878172", dx: 1.6, dy: 2.2, line: 0, hi: [x + w * 0.3, y + h * 0.3, Math.max(w, h) * 0.6], light: 0.12 });
  c.lineWidth = 1.2;
  c.strokeStyle = "rgba(62,54,46,0.75)";
  c.stroke(shape);
  // Abnutzung: ein paar dunkle Tupfen und manchmal ein Riss.
  within(c, shape, () => {
    for (let i = 0; i < 3; i += 1) {
      fill(c, ell(x + random() * w, y + random() * h, 1 + random() * 2.4, 0.8 + random() * 1.4), "rgba(70,62,50,0.18)");
    }
    if (random() < 0.18) {
      const cx = x + w * (0.2 + random() * 0.6);
      line(c, `M ${cx} ${y + 3} L ${cx + 4} ${y + h * 0.35} L ${cx - 2} ${y + h * 0.6} L ${cx + 3} ${y + h * 0.85}`, 0.9, "rgba(50,44,36,0.7)");
    }
  });
}

function flagstones(c: Ctx, x0: number, y0: number, w: number, h: number, random: () => number): void {
  fill(c, rect(x0, y0, w, h), MORTAR);
  const rowH = 34;
  let row = 0;
  for (let y = y0 - 8; y < y0 + h; y += rowH) {
    let x = x0 - 10 - (row % 2) * 22;
    while (x < x0 + w) {
      const sw = 40 + random() * 34;
      // Manche Reihen teilen sich eine Platte in zwei kleine.
      if (random() < 0.22) {
        slab(c, x, y, sw, rowH / 2, random);
        slab(c, x, y + rowH / 2, sw, rowH / 2, random);
      } else {
        slab(c, x, y, sw, rowH, random);
      }
      x += sw;
    }
    row += 1;
  }
}

/** Grasbueschel: ein paar spitze Halme mit Kontur. */
function tuft(c: Ctx, x: number, y: number, s: number, random: () => number): void {
  const blades = 3 + Math.floor(random() * 3);
  let d = `M ${x - s} ${y} `;
  for (let i = 0; i < blades; i += 1) {
    const bx = x - s + ((i + 0.5) / blades) * s * 2;
    d += `L ${bx + (random() - 0.5) * s * 0.6} ${y - s * (1.2 + random() * 0.9)} L ${bx + s / blades} ${y - s * 0.15} `;
  }
  d += `L ${x + s} ${y} Z`;
  part(c, P(d), { base: "#86a352", shade: "#5f7d36", dx: 0.6, dy: 1, line: 1.1 });
}

function mossPatch(c: Ctx, x: number, y: number, random: () => number): void {
  for (let i = 0; i < 5; i += 1) {
    fill(c, ell(x + (random() - 0.5) * 22, y + (random() - 0.5) * 10, 3 + random() * 6, 2 + random() * 3), i % 2 ? "rgba(108,140,62,0.75)" : "rgba(128,160,72,0.7)");
  }
}

function pebble(c: Ctx, x: number, y: number, r: number): void {
  part(c, ell(x, y, r * 1.3, r), { base: "#b9b3a3", shade: "#8a8473", dx: 0.4, dy: 0.6, line: 1 });
}

function leaf(c: Ctx, x: number, y: number, angle: number, color: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  part(c, P("M -5 0 Q 0 -4 5 0 Q 0 4 -5 0 Z"), { base: color, line: 0.9 });
  line(c, "M -4 0 L 4 0", 0.6, "rgba(42,32,27,0.6)");
  c.restore();
}

function flower(c: Ctx, x: number, y: number, color: string): void {
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    fill(c, ell(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.8, 1.8), color);
  }
  fill(c, ell(x, y, 1.2, 1.2), "#f0b23e");
}

function puddle(c: Ctx, x: number, y: number): void {
  part(c, P(`M ${x - 26} ${y} Q ${x - 24} ${y - 9} ${x - 6} ${y - 9} Q ${x + 10} ${y - 12} ${x + 24} ${y - 4} Q ${x + 30} ${y + 4} ${x + 14} ${y + 8} Q ${x - 10} ${y + 11} ${x - 26} ${y} Z`), {
    base: "#7d8fa0",
    shade: "#5f7181",
    dx: -1.4,
    dy: -1.6,
    line: 1.2,
  });
  gloss(c, x - 8, y - 4, 7, 1.4, 0.55, -0.1);
  gloss(c, x + 10, y + 1, 3, 0.8, 0.4, -0.1);
}

/** Runder Platz mit Steinring und dem Wappen der Feste. */
function plaza(c: Ctx, cx: number, cy: number, random: () => number): void {
  const rx = 118;
  const ry = 76;
  fill(c, ell(cx, cy, rx + 4, ry + 4), MORTAR);
  // Ring aus Keilsteinen
  const n = 26;
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2 + 0.02;
    const a1 = ((i + 1) / n) * Math.PI * 2 - 0.02;
    const p = (a: number, k: number): string => `${cx + Math.cos(a) * rx * k} ${cy + Math.sin(a) * ry * k}`;
    const tone = STONE[Math.floor(random() * STONE.length)]!;
    part(c, P(`M ${p(a0, 1)} Q ${p((a0 + a1) / 2, 1.02)} ${p(a1, 1)} L ${p(a1, 0.8)} Q ${p((a0 + a1) / 2, 0.81)} ${p(a0, 0.8)} Z`), { base: tone, shade: "#7f7a6b", dx: 1.2, dy: 1.6, line: 1.2 });
  }
  // Innen: glatter, etwas dunklerer Stein
  part(c, ell(cx, cy, rx * 0.78, ry * 0.78), { base: "#958f80", shade: "#7d7869", dx: 2, dy: 2.4, line: 1.4 });
  c.save();
  c.lineWidth = 3;
  c.strokeStyle = "rgba(240,178,62,0.75)";
  c.stroke(ell(cx, cy, rx * 0.7, ry * 0.7));
  c.restore();
  // Wappen: blauer Schild mit goldenem Turm
  const shield = P(`M ${cx - 32} ${cy - 36} L ${cx + 32} ${cy - 36} L ${cx + 32} ${cy - 4} Q ${cx + 30} ${cy + 28} ${cx} ${cy + 41} Q ${cx - 30} ${cy + 28} ${cx - 32} ${cy - 4} Z`);
  part(c, shield, { base: "#4d6aa3", shade: "#34508a", dx: 3, dy: 3, line: 2.4, hi: [cx - 14, cy - 20, 30], light: 0.25 });
  const tower = P(
    `M ${cx - 12} ${cy + 22} L ${cx - 12} ${cy - 15} L ${cx - 16} ${cy - 15} L ${cx - 16} ${cy - 25} L ${cx - 9} ${cy - 25} L ${cx - 9} ${cy - 20} ` +
      `L ${cx - 3.5} ${cy - 20} L ${cx - 3.5} ${cy - 25} L ${cx + 3.5} ${cy - 25} L ${cx + 3.5} ${cy - 20} L ${cx + 9} ${cy - 20} L ${cx + 9} ${cy - 25} ` +
      `L ${cx + 16} ${cy - 25} L ${cx + 16} ${cy - 15} L ${cx + 12} ${cy - 15} L ${cx + 12} ${cy + 22} Z`,
  );
  part(c, tower, { base: GOLD[0], shade: GOLD[1], dx: 2, dy: 2, line: 2 });
  fill(c, P(`M ${cx - 4.5} ${cy + 22} L ${cx - 4.5} ${cy + 12} Q ${cx} ${cy + 6} ${cx + 4.5} ${cy + 12} L ${cx + 4.5} ${cy + 22} Z`), LINE);
}

// --- Mauern und Dinge am Rand ------------------------------------------------------

function brickRows(c: Ctx, x0: number, y0: number, w: number, h: number, brickW: number, brickH: number, random: () => number): void {
  within(c, rect(x0, y0, w, h), () => {
    let row = 0;
    for (let y = y0; y < y0 + h; y += brickH) {
      for (let x = x0 - (row % 2) * (brickW / 2); x < x0 + w; x += brickW) {
        const tone = random() < 0.5 ? WALL[0] : "#97949f";
        part(c, rect(x + 1, y + 1, brickW - 2, brickH - 2, 3), { base: tone, shade: WALL[1], dx: 1.4, dy: 1.8, line: 1.1 });
      }
      row += 1;
    }
  });
}

function banner(c: Ctx, x: number, y: number, color: readonly [string, string]): void {
  tube(c, `M ${x - 17} ${y} L ${x + 17} ${y}`, 4, "#8a5a33", "#5e3b22", 1.4);
  const cloth = P(`M ${x - 13} ${y + 2} L ${x + 13} ${y + 2} L ${x + 13} ${y + 42} L ${x} ${y + 34} L ${x - 13} ${y + 42} Z`);
  part(c, cloth, { base: color[0], shade: color[1], dx: 2.4, dy: 1.6, line: 2 });
  line(c, `M ${x - 6} ${y + 6} L ${x - 7} ${y + 34}`, 0.9, "rgba(20,14,12,0.35)");
  part(c, ell(x, y + 17, 5.5, 5.5), { base: GOLD[0], shade: GOLD[1], dx: 1, dy: 1.2, line: 1.6 });
}

function torch(c: Ctx, x: number, y: number): void {
  const glow = c.createRadialGradient(x, y - 10, 2, x, y - 10, 54);
  glow.addColorStop(0, "rgba(255,190,90,0.5)");
  glow.addColorStop(1, "rgba(255,190,90,0)");
  c.fillStyle = glow;
  c.fillRect(x - 54, y - 64, 108, 108);
  part(c, P(`M ${x - 5} ${y - 4} L ${x + 5} ${y - 4} L ${x + 3} ${y + 10} L ${x - 3} ${y + 10} Z`), { base: "#5e5a66", shade: "#423f4b", dx: 0.6, dy: 1, line: 1.6 });
  const flame = P(`M ${x} ${y - 3} Q ${x - 9} ${y - 10} ${x - 2} ${y - 23} Q ${x} ${y - 15} ${x + 4} ${y - 19} Q ${x + 10} ${y - 10} ${x} ${y - 3} Z`);
  part(c, flame, { base: "#ffc24a", shade: "#f0702c", dx: 1, dy: -1.6, line: 1.6 });
  fill(c, P(`M ${x} ${y - 5} Q ${x - 3} ${y - 10} ${x} ${y - 14} Q ${x + 3} ${y - 10} ${x} ${y - 5} Z`), "#fff0b0");
}

function gate(c: Ctx, cx: number, top: number, bottom: number): void {
  const w = 64;
  // Torbogen aus hellem Stein
  const arch = P(`M ${cx - w / 2 - 10} ${bottom} L ${cx - w / 2 - 10} ${top + 22} Q ${cx} ${top - 14} ${cx + w / 2 + 10} ${top + 22} L ${cx + w / 2 + 10} ${bottom} Z`);
  part(c, arch, { base: WALL_TOP[0], shade: WALL_TOP[1], dx: 2, dy: 2, line: 2 });
  const door = P(`M ${cx - w / 2} ${bottom} L ${cx - w / 2} ${top + 26} Q ${cx} ${top - 2} ${cx + w / 2} ${top + 26} L ${cx + w / 2} ${bottom} Z`);
  part(c, door, { base: "#3a2a24", shade: "#241915", dx: 2, dy: 2, line: 2 });
  // Fallgitter
  within(c, door, () => {
    for (let x = cx - w / 2 + 8; x < cx + w / 2; x += 11) {
      tube(c, `M ${x} ${top} L ${x} ${bottom}`, 3, "#5e5a66", "#3f3c48", 1);
    }
    for (let y = top + 18; y < bottom; y += 11) {
      tube(c, `M ${cx - w / 2} ${y} L ${cx + w / 2} ${y}`, 3, "#5e5a66", "#3f3c48", 1);
    }
  });
  // Unheimliches Glimmen dahinter
  const glow = c.createRadialGradient(cx, bottom, 2, cx, bottom, 40);
  glow.addColorStop(0, "rgba(180,110,230,0.45)");
  glow.addColorStop(1, "rgba(180,110,230,0)");
  c.fillStyle = glow;
  c.fillRect(cx - 40, bottom - 40, 80, 44);
}

function barrel(c: Ctx, x: number, y: number): void {
  const body = P(`M ${x - 11} ${y - 14} Q ${x - 15} ${y} ${x - 11} ${y + 14} L ${x + 11} ${y + 14} Q ${x + 15} ${y} ${x + 11} ${y - 14} Z`);
  part(c, body, { base: "#a8693a", shade: "#7f4c26", dx: 2.4, dy: 0.6, line: 1.8 });
  for (const dy of [-8, 8]) {
    tube(c, `M ${x - 13} ${y + dy} Q ${x} ${y + dy + 2.4} ${x + 13} ${y + dy}`, 2.4, "#6e7782", "#4e5660", 1);
  }
  part(c, ell(x, y - 14, 11, 3.6), { base: "#b97c48", shade: "#8f5a30", dx: 0.6, dy: 0.8, line: 1.6 });
}

function crate(c: Ctx, x: number, y: number, s: number): void {
  part(c, rect(x - s / 2, y - s / 2, s, s, 2), { base: "#c08a4a", shade: "#94642e", dx: 2, dy: 2, line: 1.8 });
  line(c, `M ${x - s / 2 + 4} ${y - s / 2 + 4} L ${x + s / 2 - 4} ${y + s / 2 - 4}`, 2.2, "#7a5228");
  line(c, `M ${x - s / 2 + 4} ${y - s / 2 + 4} L ${x - s / 2 + 4} ${y + s / 2 - 4} M ${x + s / 2 - 4} ${y - s / 2 + 4} L ${x + s / 2 - 4} ${y + s / 2 - 4}`, 1.4, "#7a5228");
}

function hay(c: Ctx, x: number, y: number): void {
  part(c, P(`M ${x - 22} ${y + 10} Q ${x - 24} ${y - 10} ${x - 8} ${y - 13} Q ${x + 10} ${y - 15} ${x + 22} ${y - 6} Q ${x + 26} ${y + 6} ${x + 18} ${y + 11} Z`), {
    base: "#d8b25c",
    shade: "#b08a38",
    dx: 2,
    dy: 2,
    line: 1.6,
  });
  for (let i = -16; i < 18; i += 5) {
    line(c, `M ${x + i} ${y - 9} L ${x + i + 2} ${y + 8}`, 0.8, "rgba(120,80,30,0.7)");
  }
}

function ivy(c: Ctx, x: number, y: number, length: number, random: () => number): void {
  line(c, `M ${x} ${y} Q ${x + 6} ${y + length / 2} ${x - 2} ${y + length}`, 1.4, "#4d6a2c");
  for (let k = 0; k < length; k += 7) {
    const lx = x + Math.sin(k * 0.3) * 4;
    const side = k % 14 === 0 ? -1 : 1;
    part(c, ell(lx + side * 4, y + k, 3.6, 2.6, side * 0.6 + random() * 0.4), { base: "#6f9442", shade: "#4f6f2c", dx: 0.4, dy: 0.6, line: 1 });
  }
}

/** Malt den ganzen Hof (Masse in Arena-Pixeln, inklusive Rand `ARENA_WALL`). */
export function paintArena(c: Ctx): void {
  const wall = ARENA_WALL;
  const width = ARENA.width + wall * 2;
  const random = seeded(77);
  const x0 = wall;
  const y0 = wall;
  const w = ARENA.width;
  const h = ARENA.height;

  // --- Boden
  within(c, rect(x0 - 6, y0, w + 12, h + 6), () => {
    flagstones(c, x0 - 6, y0, w + 12, h + 6, random);
    // Erdflecken, wo viel gelaufen wird
    for (let i = 0; i < 7; i += 1) {
      const px = x0 + 60 + random() * (w - 120);
      const py = y0 + 40 + random() * (h - 80);
      const g = c.createRadialGradient(px, py, 4, px, py, 46 + random() * 30);
      g.addColorStop(0, "rgba(120,96,64,0.32)");
      g.addColorStop(1, "rgba(120,96,64,0)");
      c.fillStyle = g;
      c.fillRect(px - 80, py - 80, 160, 160);
    }
    plaza(c, x0 + w / 2, y0 + h / 2, random);
    // Moos in Fugen, Gras von den Raendern her
    for (let i = 0; i < 26; i += 1) {
      mossPatch(c, x0 + random() * w, y0 + 10 + random() * (h - 10), random);
    }
    for (let i = 0; i < 46; i += 1) {
      const edge = random();
      const x = edge < 0.5 ? x0 + random() * w : edge < 0.75 ? x0 + random() * 40 : x0 + w - random() * 40;
      const y = edge < 0.5 ? (random() < 0.5 ? y0 + 30 + random() * 30 : y0 + h - random() * 30) : y0 + 30 + random() * (h - 40);
      tuft(c, x, y, 4 + random() * 4, random);
    }
    for (let i = 0; i < 30; i += 1) {
      pebble(c, x0 + random() * w, y0 + 10 + random() * (h - 10), 1.6 + random() * 2);
    }
    const leaves = ["#c98a3a", "#b5532f", "#d9a441", "#8a9a44"];
    for (let i = 0; i < 16; i += 1) {
      leaf(c, x0 + random() * w, y0 + 10 + random() * (h - 10), random() * 6.28, leaves[i % leaves.length]!);
    }
    for (let i = 0; i < 18; i += 1) {
      const fx = random() < 0.5 ? x0 + 10 + random() * 60 : x0 + w - 10 - random() * 60;
      flower(c, fx, y0 + 20 + random() * (h - 30), i % 3 === 0 ? "#f4efe2" : i % 3 === 1 ? "#e9a0b0" : "#a8c8f0");
    }
    puddle(c, x0 + w * 0.2, y0 + h * 0.72);
    puddle(c, x0 + w * 0.82, y0 + h * 0.3);
    // Schatten der Mauern auf dem Boden (oben stark, seitlich leicht)
    const top = c.createLinearGradient(0, y0, 0, y0 + 46);
    top.addColorStop(0, "rgba(30,26,40,0.5)");
    top.addColorStop(1, "rgba(30,26,40,0)");
    c.fillStyle = top;
    c.fillRect(x0 - 6, y0, w + 12, 46);
    for (const side of [0, 1]) {
      const sx = side === 0 ? x0 - 6 : x0 + w + 6;
      const g = c.createLinearGradient(sx, 0, sx + (side === 0 ? 30 : -30), 0);
      g.addColorStop(0, "rgba(30,26,40,0.35)");
      g.addColorStop(1, "rgba(30,26,40,0)");
      c.fillStyle = g;
      c.fillRect(side === 0 ? sx : sx - 30, y0, 30, h + 6);
    }
  });

  // --- Burgmauer oben: Ziegel, Zinnen, Tor in der Mitte
  const wallTop = 6;
  fill(c, rect(-4, wallTop + 10, width + 8, y0 - wallTop - 8), WALL[1]);
  brickRows(c, -4, wallTop + 12, width + 8, y0 - wallTop - 10, 34, 13, random);
  outline(c, rect(-4, wallTop + 10, width + 8, y0 - wallTop - 8));
  for (let x = -6; x < width + 10; x += 38) {
    part(c, rect(x + 4, wallTop - 2, 24, 17, 3), { base: WALL_TOP[0], shade: WALL_TOP[1], dx: 1.6, dy: 2, line: 1.8 });
  }
  gate(c, width / 2, wallTop + 2, y0 + 2);
  banner(c, width / 2 - 78, wallTop + 16, ["#c4392f", "#962620"]);
  banner(c, width / 2 + 78, wallTop + 16, ["#3f5f9e", "#2d4577"]);
  banner(c, width * 0.17, wallTop + 16, ["#3f5f9e", "#2d4577"]);
  banner(c, width * 0.83, wallTop + 16, ["#c4392f", "#962620"]);
  for (const fx of [width * 0.08, width * 0.32, width * 0.68, width * 0.92]) {
    torch(c, fx, y0 - 10);
  }

  // --- Mauerkronen links und rechts mit Efeu
  for (const side of [0, 1]) {
    const px = side === 0 ? 0 : width - wall + 6;
    const pw = wall - 6;
    part(c, rect(px, y0 - 8, pw, h + 16, 4), { base: WALL[0], shade: WALL[1], dx: 2, dy: 1, line: 2 });
    for (let y = y0 + 4; y < y0 + h; y += 30) {
      part(c, rect(px + 4, y, pw - 8, 26, 4), { base: WALL_TOP[0], shade: WALL_TOP[1], dx: 1.4, dy: 1.6, line: 1.3 });
    }
    for (let k = 0; k < 3; k += 1) {
      ivy(c, side === 0 ? px + pw - 6 : px + 6, y0 + 30 + k * 140 + random() * 40, 50 + random() * 30, random);
    }
  }

  // --- Unten: Bruestung mit Faessern, Kisten und Heu
  part(c, rect(-4, y0 + h + 4, width + 8, wall, 0), { base: WALL[0], shade: WALL[1], dx: 0, dy: 3, line: 2 });
  brickRows(c, -4, y0 + h + 8, width + 8, wall - 4, 34, 13, random);
  barrel(c, 26, y0 + h + 18);
  barrel(c, 54, y0 + h + 24);
  crate(c, width - 40, y0 + h + 20, 26);
  crate(c, width - 68, y0 + h + 26, 20);
  hay(c, width * 0.5 - 150, y0 + h + 24);
  barrel(c, width * 0.5 + 160, y0 + h + 22);
  crate(c, width * 0.5 + 186, y0 + h + 26, 20);

  // Kontur der Spielflaeche
  outline(c, rect(x0 - 6, y0, w + 12, h + 6), 3);
}

function outline(c: Ctx, shape: Path2D, width = 2): void {
  c.lineWidth = width;
  c.strokeStyle = LINE;
  c.stroke(shape);
}

/** Korn ueber den ganzen Hof (in Leinwand-Pixeln). */
export function arenaGrain(c: Ctx, width: number, height: number): void {
  grainOver(c, width, height, 0.05);
}
