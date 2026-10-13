/**
 * Die Landschaft hinter allen Menues: Abenddaemmerung im Grauland.
 *
 * Von hinten nach vorn: Himmel mit Sternen, Mond und Wolken -> ferne Berge mit
 * Schnee -> naehere Berge -> bewaldete Huegel -> rechts die Feste Holdout auf
 * ihrem Huegel (Tuerme, Mauer, erleuchtete Fenster, Fahnen) -> ein Weg zur Burg
 * -> vorne eine Wiese mit Felsen, Bueschen, Blumen und Gluehwuermchen.
 * Gemalt mit denselben Werkzeugen wie die Figuren (`figures/kit.ts`).
 */

import { type Ctx, ell, fill, gloss, grainOver, line, LINE, P, part, rect, within } from "./figures/kit";
import { seeded } from "./paper";

type Pair = readonly [string, string];

function ridge(c: Ctx, W: number, H: number, base: number, amp: number, step: number, color: Pair, random: () => number, snow = false, lineColor = LINE): void {
  const points: [number, number][] = [];
  let x = -40;
  while (x <= W + step) {
    points.push([x, base - amp * (0.35 + random() * 0.65)]);
    x += step * (0.6 + random() * 0.8);
  }
  // Spitzen und Taeler abwechselnd, mit weichen Kurven dazwischen
  let d = `M -40 ${H} L ${points[0]![0]} ${points[0]![1]} `;
  for (let i = 1; i < points.length; i += 1) {
    const [px, py] = points[i - 1]!;
    const [qx, qy] = points[i]!;
    const valley = i % 2 === 0;
    d += valley ? `Q ${(px + qx) / 2} ${Math.max(py, qy) + amp * 0.15} ${qx} ${qy} ` : `L ${qx} ${qy} `;
  }
  d += `L ${W + 40} ${H} Z`;
  const shape = P(d);
  part(c, shape, { base: color[0], shade: color[1], dx: -10, dy: 6, line: 0 });
  if (snow) {
    within(c, shape, () => {
      for (let i = 1; i < points.length; i += 2) {
        const [sx, sy] = points[i]!;
        fill(c, P(`M ${sx - 26} ${sy + 22} L ${sx} ${sy - 2} L ${sx + 22} ${sy + 18} L ${sx + 12} ${sy + 14} L ${sx + 4} ${sy + 22} L ${sx - 6} ${sy + 15} Z`), "rgba(214,222,234,0.85)");
      }
    });
  }
  c.lineWidth = 2;
  c.lineJoin = "round";
  c.strokeStyle = lineColor;
  c.stroke(shape);
}

function cloud(c: Ctx, x: number, y: number, w: number, color: Pair): void {
  const h = w * 0.22;
  const shape = P(
    `M ${x - w / 2} ${y} Q ${x - w * 0.45} ${y - h} ${x - w * 0.25} ${y - h * 0.9} Q ${x - w * 0.15} ${y - h * 1.8} ${x + w * 0.05} ${y - h * 1.3} ` +
      `Q ${x + w * 0.2} ${y - h * 2} ${x + w * 0.32} ${y - h * 1.0} Q ${x + w * 0.5} ${y - h * 1.1} ${x + w / 2} ${y} Z`,
  );
  part(c, shape, { base: color[0], shade: color[1], dx: 0, dy: -h * 0.5, line: 1.6 });
}

function pine(c: Ctx, x: number, ground: number, h: number, color: Pair, lineWidth = 1.8): void {
  part(c, rect(x - h * 0.05, ground - h * 0.22, h * 0.1, h * 0.24, 1), { base: "#5e3b22", shade: "#432a18", dx: 0.6, dy: 0, line: lineWidth });
  const w = h * 0.38;
  let d = `M ${x} ${ground - h} `;
  // Drei Stufen Zweige
  for (const k of [0.38, 0.66, 0.92]) {
    const ww = w * (0.45 + k * 0.6);
    d += `L ${x + ww} ${ground - h * (1 - k) - h * 0.06} L ${x + ww * 0.45} ${ground - h * (1 - k) - h * 0.1} `;
  }
  d += `L ${x + w * 1.05} ${ground - h * 0.16} L ${x - w * 1.05} ${ground - h * 0.16} `;
  for (const k of [0.92, 0.66, 0.38]) {
    const ww = w * (0.45 + k * 0.6);
    d += `L ${x - ww * 0.45} ${ground - h * (1 - k) - h * 0.1} L ${x - ww} ${ground - h * (1 - k) - h * 0.06} `;
  }
  d += "Z";
  part(c, P(d), { base: color[0], shade: color[1], dx: -h * 0.06, dy: 0, line: lineWidth });
}

function bush(c: Ctx, x: number, y: number, s: number, random: () => number): void {
  let d = `M ${x - s} ${y} `;
  const bumps = 4;
  for (let i = 0; i < bumps; i += 1) {
    const bx = x - s + ((i + 1) / bumps) * s * 2;
    d += `Q ${bx - s / bumps} ${y - s * (0.9 + random() * 0.5)} ${bx} ${y - s * 0.2} `;
  }
  d += "Z";
  part(c, P(d), { base: "#5f8a48", shade: "#476b35", dx: 0, dy: -s * 0.3, line: 1.8 });
  for (let i = 0; i < 3; i += 1) {
    fill(c, ell(x - s * 0.6 + random() * s * 1.2, y - s * 0.4 - random() * s * 0.4, 1.8, 1.8), "#e9a0b0");
  }
}

function rock(c: Ctx, x: number, y: number, s: number): void {
  part(c, P(`M ${x - s} ${y} Q ${x - s * 1.1} ${y - s * 0.7} ${x - s * 0.3} ${y - s * 0.9} Q ${x + s * 0.4} ${y - s * 1.1} ${x + s} ${y - s * 0.4} Q ${x + s * 1.2} ${y} ${x + s} ${y} Z`), {
    base: "#8f8c99",
    shade: "#6a6778",
    dx: -s * 0.25,
    dy: 0,
    line: 1.8,
    hi: [x - s * 0.4, y - s * 0.7, s * 0.6],
    light: 0.3,
  });
}

function tuft(c: Ctx, x: number, y: number, s: number): void {
  part(c, P(`M ${x - s} ${y} L ${x - s * 0.6} ${y - s * 1.6} L ${x - s * 0.2} ${y - s * 0.3} L ${x + s * 0.1} ${y - s * 2} L ${x + s * 0.4} ${y - s * 0.3} L ${x + s * 0.9} ${y - s * 1.4} L ${x + s} ${y} Z`), {
    base: "#7c9e52",
    shade: "#5a7a3a",
    dx: 0.4,
    dy: 0.6,
    line: 1.2,
  });
}

// --- Die Feste ------------------------------------------------------------------------

const STONE: Pair = ["#9a97a6", "#716e82"];
const STONE_DARK: Pair = ["#827f92", "#5e5b70"];

function bricks(c: Ctx, shape: Path2D, x: number, y: number, w: number, h: number, bw = 16, bh = 9): void {
  within(c, shape, () => {
    let row = 0;
    for (let by = y + bh; by < y + h; by += bh) {
      line(c, `M ${x} ${by} L ${x + w} ${by}`, 0.8, "rgba(42,32,27,0.35)");
      for (let bx = x + (row % 2) * (bw / 2); bx < x + w; bx += bw) {
        line(c, `M ${bx} ${by - bh} L ${bx} ${by}`, 0.8, "rgba(42,32,27,0.35)");
      }
      row += 1;
    }
  });
}

function battlements(c: Ctx, x: number, y: number, w: number, s = 9): void {
  for (let bx = x; bx < x + w - s * 0.6; bx += s * 1.6) {
    part(c, rect(bx, y - s, s, s + 1, 1.5), { base: STONE[0], shade: STONE[1], dx: 1.6, dy: 0, line: 1.8 });
  }
}

function windowLit(c: Ctx, x: number, y: number, w: number, h: number, lit: boolean): void {
  if (lit) {
    const g = c.createRadialGradient(x + w / 2, y + h / 2, 1, x + w / 2, y + h / 2, w * 2.4);
    g.addColorStop(0, "rgba(255,210,110,0.55)");
    g.addColorStop(1, "rgba(255,210,110,0)");
    c.fillStyle = g;
    c.fillRect(x - w * 2, y - w * 2, w * 5, h + w * 4);
  }
  const shape = new Path2D();
  shape.roundRect(x, y, w, h, [w / 2, w / 2, 0, 0]);
  part(c, shape, { base: lit ? "#ffd36a" : "#3a3346", shade: lit ? "#f0a83a" : "#2a2434", dx: -1, dy: -1, line: 1.6 });
}

function tower(c: Ctx, x: number, base: number, w: number, h: number, roof: Pair, random: () => number): void {
  const body = rect(x, base - h, w, h);
  part(c, body, { base: STONE[0], shade: STONE[1], dx: w * 0.22, dy: 0, line: 2.2 });
  bricks(c, body, x, base - h, w, h);
  // Kragen unter dem Dach
  part(c, rect(x - 4, base - h - 6, w + 8, 9, 2), { base: STONE_DARK[0], shade: STONE_DARK[1], dx: 2, dy: 0, line: 2 });
  // Spitzdach mit Ziegelreihen
  const top = base - h - 6;
  const peak = top - w * 1.05;
  const shape = P(`M ${x - 8} ${top} Q ${x + w * 0.1} ${top - w * 0.2} ${x + w / 2} ${peak} Q ${x + w * 0.9} ${top - w * 0.2} ${x + w + 8} ${top} Z`);
  part(c, shape, { base: roof[0], shade: roof[1], dx: w * 0.25, dy: 0, line: 2.2, hi: [x + w * 0.25, top - w * 0.4, w * 0.4], light: 0.25 });
  within(c, shape, () => {
    for (let k = 1; k < 5; k += 1) {
      const ty = top - (top - peak) * (k / 5);
      line(c, `M ${x - 10} ${ty + 2} Q ${x + w / 2} ${ty + 6} ${x + w + 10} ${ty + 2}`, 0.9, "rgba(42,32,27,0.4)");
    }
  });
  // Fahne
  line(c, `M ${x + w / 2} ${peak} L ${x + w / 2} ${peak - 24}`, 2);
  part(c, P(`M ${x + w / 2} ${peak - 24} Q ${x + w / 2 + 12} ${peak - 26} ${x + w / 2 + 22} ${peak - 19} Q ${x + w / 2 + 12} ${peak - 16} ${x + w / 2} ${peak - 13} Z`), {
    base: "#f0b23e",
    shade: "#c27f1d",
    dx: 0,
    dy: -2,
    line: 1.6,
  });
  // Fenster
  const rows = Math.floor((h - 30) / 30);
  const cols = Math.max(1, Math.floor((w - 12) / 16));
  for (let r = 0; r < rows; r += 1) {
    for (let k = 0; k < cols; k += 1) {
      windowLit(c, x + (w - cols * 16 + 8) / 2 + k * 16, base - h + 18 + r * 30, 8, 13, random() < 0.75);
    }
  }
}

function castle(c: Ctx, fx: number, base: number, random: () => number): void {
  // Hintere Mauer mit Zinnen
  const wall = rect(fx - 160, base - 62, 320, 62);
  part(c, wall, { base: STONE[0], shade: STONE[1], dx: 0, dy: -10, line: 2.2 });
  bricks(c, wall, fx - 160, base - 62, 320, 62, 18, 10);
  battlements(c, fx - 160, base - 62, 320, 10);
  // Tuerme
  tower(c, fx - 182, base, 52, 132, ["#c4392f", "#922620"], random);
  tower(c, fx + 128, base, 52, 122, ["#3f5f9e", "#2b4374"], random);
  tower(c, fx - 66, base - 20, 60, 178, ["#3f5f9e", "#2b4374"], random);
  tower(c, fx + 22, base - 14, 46, 140, ["#c4392f", "#922620"], random);
  // Vordere Mauer mit Tor
  const front = rect(fx - 120, base - 40, 240, 40);
  part(c, front, { base: STONE_DARK[0], shade: STONE_DARK[1], dx: 0, dy: -6, line: 2.2 });
  bricks(c, front, fx - 120, base - 40, 240, 40, 18, 10);
  battlements(c, fx - 120, base - 40, 240, 9);
  const gate = new Path2D();
  gate.roundRect(fx - 20, base - 34, 40, 34, [20, 20, 0, 0]);
  const g = c.createRadialGradient(fx, base - 10, 2, fx, base - 10, 42);
  g.addColorStop(0, "rgba(255,200,100,0.5)");
  g.addColorStop(1, "rgba(255,200,100,0)");
  c.fillStyle = g;
  c.fillRect(fx - 42, base - 52, 84, 60);
  part(c, gate, { base: "#e8a84a", shade: "#c27f2a", dx: 0, dy: -6, line: 2.2 });
  for (let gx = fx - 14; gx <= fx + 14; gx += 7) {
    line(c, `M ${gx} ${base - 30} L ${gx} ${base}`, 1.6, "#3a2a24");
  }
  line(c, `M ${fx - 20} ${base - 18} L ${fx + 20} ${base - 18}`, 1.6, "#3a2a24");
}

/** Malt die ganze Landschaft (W x H in Entwurfspixeln; vorher skalieren fuer Schaerfe). */
export function paintLandscape(c: Ctx, W: number, H: number): void {
  const random = seeded(4321);
  const cx = W / 2;

  // Himmel: oben tiefes Schieferblau, am Horizont warmes Mauve
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#2e3850");
  sky.addColorStop(0.45, "#4d5c78");
  sky.addColorStop(0.75, "#86788c");
  sky.addColorStop(1, "#9a8790");
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);

  for (let i = 0; i < 110; i += 1) {
    const x = random() * W;
    const y = random() * H * 0.45;
    const r = 0.7 + random() * 1.3;
    fill(c, ell(x, y, r, r), `rgba(255,248,220,${0.3 + random() * 0.5})`);
    if (random() < 0.1) {
      line(c, `M ${x - 4} ${y} L ${x + 4} ${y} M ${x} ${y - 4} L ${x} ${y + 4}`, 0.8, "rgba(255,248,220,0.7)");
    }
  }

  // Mond mit Schein und Kratern
  const moonX = cx + 430;
  const glow = c.createRadialGradient(moonX, 92, 20, moonX, 92, 170);
  glow.addColorStop(0, "rgba(255,240,200,0.35)");
  glow.addColorStop(1, "rgba(255,240,200,0)");
  c.fillStyle = glow;
  c.fillRect(moonX - 170, -80, 340, 340);
  part(c, ell(moonX, 92, 40, 40), { base: "#f6eccf", shade: "#d9cba4", dx: -6, dy: -4, line: 2.4 });
  for (const [dx, dy, r] of [[-10, -8, 7], [12, 8, 5], [-4, 16, 4], [16, -14, 3]] as const) {
    part(c, ell(moonX + dx, 92 + dy, r, r * 0.9), { base: "#e2d4ad", shade: "#cbbb91", dx: -1, dy: -1, line: 1 });
  }

  cloud(c, cx - 420, 120, 220, ["#5f6c88", "#4f5b76"]);
  cloud(c, cx + 300, 150, 260, ["#6a7590", "#58637e"]);
  cloud(c, cx - 40, 70, 160, ["#56627e", "#48536d"]);

  // Berge in Schichten (je weiter weg, desto blasser die Kontur)
  ridge(c, W, H, H * 0.58, 120, 120, ["#6f7b95", "#5b6680"], random, true, "rgba(42,32,27,0.45)");
  ridge(c, W, H, H * 0.7, 80, 90, ["#5b6a80", "#4a586c"], random, false, "rgba(42,32,27,0.7)");

  // Bewaldete Huegel
  const hills = P(`M -20 ${H} L -20 ${H * 0.8} Q ${W * 0.15} ${H * 0.7} ${W * 0.32} ${H * 0.78} Q ${W * 0.5} ${H * 0.86} ${W * 0.62} ${H * 0.76} Q ${W * 0.8} ${H * 0.68} ${W + 20} ${H * 0.8} L ${W + 20} ${H} Z`);
  part(c, hills, { base: "#4f6a5c", shade: "#3f5649", dx: 0, dy: -8, line: 2.2 });
  for (let x = 10; x < W; x += 26 + random() * 30) {
    const y = H * 0.8 + Math.sin(x / 90) * 8 + 6;
    pine(c, x, y, 34 + random() * 22, random() < 0.5 ? ["#3f6a52", "#2f5240"] : ["#4a7458", "#365a44"], 1.6);
  }

  // Die Feste auf ihrem Huegel rechts der Mitte
  const fx = cx + 260;
  const hillTop = H * 0.74;
  const castleHill = P(`M ${fx - 280} ${H} Q ${fx - 180} ${hillTop - 34} ${fx} ${hillTop - 48} Q ${fx + 180} ${hillTop - 34} ${fx + 290} ${H} Z`);
  part(c, castleHill, { base: "#5d7d4c", shade: "#486a3c", dx: -20, dy: 0, line: 2.4, hi: [fx - 60, hillTop - 30, 120], light: 0.2 });
  castle(c, fx, hillTop - 38, random);

  // Weg zur Burg
  const path = P(`M ${fx - 60} ${H} Q ${fx - 30} ${H - 40} ${fx - 70} ${H - 66} Q ${fx - 100} ${H - 90} ${fx - 8} ${hillTop - 38} L ${fx + 8} ${hillTop - 38} Q ${fx - 70} ${H - 92} ${fx - 40} ${H - 66} Q ${fx + 10} ${H - 40} ${fx + 30} ${H} Z`);
  part(c, path, { base: "#a38d6a", shade: "#86714f", dx: 3, dy: 0, line: 1.8 });

  // Vordergrund: Wiese
  let d = `M -20 ${H} L -20 ${H - 52} `;
  for (let x = 0; x <= W + 60; x += 60) {
    d += `Q ${x - 30} ${H - 58 - random() * 10} ${x} ${H - 52 - Math.sin(x / 140) * 8} `;
  }
  d += `L ${W + 20} ${H} Z`;
  const meadow = P(d);
  part(c, meadow, { base: "#5c7d45", shade: "#4b6a37", dx: 0, dy: -10, line: 2.4 });
  for (let i = 0; i < 70; i += 1) {
    tuft(c, random() * W, H - 30 + random() * 32, 3 + random() * 3);
  }
  for (let i = 0; i < 40; i += 1) {
    const colors = ["#f4efe2", "#e9a0b0", "#f0c95a", "#a8c8f0"];
    const x = random() * W;
    const y = H - 34 + random() * 30;
    fill(c, ell(x, y, 2.2, 2.2), colors[i % colors.length]!);
  }
  for (const [x, s] of [[60, 18], [W - 90, 22], [cx - 520, 14], [cx + 560, 16]] as const) {
    rock(c, x, H - 30, s);
  }
  for (const [x, s] of [[150, 22], [W - 200, 26], [cx - 360, 18]] as const) {
    bush(c, x, H - 40, s, random);
  }
  // Grosse Tannen am Rand
  for (const x of [30, 110, W - 40, W - 130, cx - 640, cx + 680]) {
    pine(c, x, H - 34, 110 + random() * 40, ["#3f6a48", "#2f5238"], 2.2);
  }
  // Gluehwuermchen
  for (let i = 0; i < 24; i += 1) {
    const x = random() * W;
    const y = H * 0.6 + random() * H * 0.35;
    const g = c.createRadialGradient(x, y, 0, x, y, 8);
    g.addColorStop(0, "rgba(255,240,150,0.8)");
    g.addColorStop(1, "rgba(255,240,150,0)");
    c.fillStyle = g;
    c.fillRect(x - 8, y - 8, 16, 16);
    gloss(c, x, y, 1.4, 1.4, 0.95, 0);
  }

  // Leichte Vignette, damit die Mitte (Tafeln) ruhig bleibt
  const vignette = c.createRadialGradient(cx, H * 0.45, H * 0.4, cx, H * 0.45, W * 0.62);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(20,20,35,0.35)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, W, H);
}

/** Korn ueber das ganze Bild (Leinwand-Pixel). */
export function landscapeGrain(c: Ctx, width: number, height: number): void {
  grainOver(c, width, height, 0.045);
}
