/**
 * Die Welt in Pixel-Art: das Menuebild und die Arena.
 *
 * Die Geschichte: Mech-Piloten aus der Zukunft wurden durch einen Zeitriss in
 * eine antike Stadt gezogen. Ueber dem alten Kolosseum klafft der Riss am
 * Himmel, und aus ihm erwacht die goldene Armee der Toten. Gekaempft wird
 * unten in der Arena, wo der Riss den dunklen Steinboden aufgesprengt hat.
 */

import { ARENA } from "../../game/constants";
import { seeded } from "../theme";
import { BRONZE, CYAN, CYAN_HOT, FIRE, GOLD, MARBLE, MECH, MECH_DARK, OUT, RED, VIOLET } from "./palette";
import { oval, Pix, poly, rect, thick, union, type Ramp } from "./pix";

// --- gemeinsame Bausteine -----------------------------------------------------------------

/** Waagerechte Farbbaender mit Schachbrett-Uebergang (Pixel-Himmel). */
function bands(p: Pix, colors: readonly string[], y0: number, y1: number): void {
  const step = (y1 - y0) / colors.length;
  for (let y = y0; y < y1; y += 1) {
    const t = (y - y0) / step;
    const i = Math.min(colors.length - 1, Math.floor(t));
    const frac = t - i;
    for (let x = 0; x < p.w; x += 1) {
      // Im letzten Viertel eines Bandes jedes zweite Pixel schon in der naechsten Farbe.
      const next = i + 1 < colors.length && frac > 0.75 && (x + y) % 2 === 0;
      p.px(x, y, colors[next ? i + 1 : i] as string);
    }
  }
}

/** Gezackter Riss als Linienzug mit Leuchten. */
function riftCrack(p: Pix, points: readonly (readonly [number, number])[], glow = true): void {
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [x0, y0] = points[i] as readonly [number, number];
    const [x1, y1] = points[i + 1] as readonly [number, number];
    if (glow) {
      p.line(x0 + 1, y0, x1 + 1, y1, VIOLET[1]);
      p.line(x0 - 1, y0, x1 - 1, y1, VIOLET[1]);
    }
    p.line(x0, y0, x1, y1, VIOLET[3]);
  }
}

/** Zufaelliger Zickzack von a nach b. */
function zigzag(random: () => number, x0: number, y0: number, x1: number, y1: number, steps: number, jitter: number): [number, number][] {
  const points: [number, number][] = [[x0, y0]];
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    points.push([Math.round(x0 + (x1 - x0) * t + (random() - 0.5) * jitter), Math.round(y0 + (y1 - y0) * t + (random() - 0.5) * jitter)]);
  }
  points.push([x1, y1]);
  return points;
}

/** Saeule (Marmor) mit Kanneluren; `broken` = oben abgebrochen. */
function column(p: Pix, x: number, base: number, height: number, width: number, broken: boolean, ramp: Ramp = MARBLE): void {
  p.shape(rect(x - 1, base - 3, width + 2, 3), ramp, { shade: 1 });
  if (broken) {
    p.shape(poly(x, base - 3, x + width, base - 3, x + width, base - height + 2, x + width * 0.6, base - height - 1, x + width * 0.3, base - height + 3, x, base - height), ramp, { shade: 1 });
  } else {
    p.shape(rect(x, base - height, width, height - 3), ramp, { shade: 1 });
    p.shape(rect(x - 2, base - height - 3, width + 4, 3), ramp, { shade: 1 });
  }
  for (let cx = x + 2; cx < x + width - 1; cx += 2) {
    for (let y = base - height + 2; y < base - 4; y += 1) {
      p.pxOn(cx, y, ramp[1]);
    }
  }
}

/** Feuerschale (Bronze) mit Flamme. */
function brazier(p: Pix, x: number, y: number): void {
  p.shape(thick(x, y + 2, x, y + 9, 2), BRONZE, { shade: 0 });
  p.shape(rect(x - 3, y + 9, 7, 2), BRONZE, { shade: 0 });
  p.shape(poly(x - 5, y - 1, x + 5, y - 1, x + 3, y + 3, x - 3, y + 3), BRONZE, { shade: 1 });
  p.fill(poly(x - 4, y - 1, x - 2, y - 5, x, y - 3, x + 1, y - 8, x + 3, y - 3, x + 4, y - 1), FIRE[2]);
  p.fill(poly(x - 2, y - 1, x, y - 4, x + 2, y - 1), FIRE[3]);
}

// --- Menuebild ----------------------------------------------------------------------------

export const MENU_W = 534;
export const MENU_H = 180;

/** Ein Ring aus Bogengaengen (Kolosseum), `ruined` = rechte obere Ecke eingestuerzt. */
function colosseum(p: Pix, cx: number, base: number, w: number): void {
  const stone: Ramp = ["#241c30", "#4a3e5a", "#6e5e80", "#9a88aa"];
  const tiers = 3;
  const tierH = 13;
  const left = cx - w / 2;
  // Ruine: Oberkante faellt rechts ab
  const topAt = (x: number): number => {
    const t = (x - left) / w;
    return base - tierH * tiers - 4 + (t > 0.62 ? Math.round((t - 0.62) * 70) : 0) + (t > 0.62 && Math.floor(x) % 5 === 0 ? 2 : 0);
  };
  for (let x = Math.floor(left); x < left + w; x += 1) {
    const top = topAt(x);
    for (let y = top; y < base; y += 1) {
      p.px(x, y, stone[2]);
    }
    p.px(x, top, stone[3]);
  }
  // Gesimse zwischen den Stockwerken
  for (let t = 0; t <= tiers; t += 1) {
    const y = base - t * tierH;
    for (let x = Math.floor(left); x < left + w; x += 1) {
      if (y > topAt(x)) {
        p.px(x, y, stone[1]);
        p.px(x, y - 1, stone[3]);
      }
    }
  }
  // Boegen mit violettem Schein aus dem Inneren
  for (let t = 0; t < tiers; t += 1) {
    const y0 = base - (t + 1) * tierH + 3;
    for (let x = Math.floor(left) + 3; x < left + w - 8; x += 11) {
      if (y0 - 1 <= topAt(x + 4)) {
        continue;
      }
      p.fill(union(rect(x, y0 + 3, 7, tierH - 5), oval(x + 3.5, y0 + 3, 3.5, 3)), stone[0]);
      if ((x + t * 7) % 3 === 0) {
        p.fill(rect(x + 2, y0 + 5, 3, tierH - 7), VIOLET[1]);
      }
      p.px(x - 1, y0 + 2, stone[3]);
    }
  }
}

export function paintMenuWorld(): Pix {
  const p = new Pix(MENU_W, MENU_H, 31);
  const random = seeded(4321);
  // Nachthimmel: oben tief, zum Riss hin violett
  bands(p, ["#0e0b1a", "#141026", "#1c1532", "#261a40", "#33204e", "#43285a", "#4e2f62"], 0, 150);
  // Sterne
  for (let i = 0; i < 140; i += 1) {
    const x = Math.floor(random() * MENU_W);
    const y = Math.floor(random() * 110);
    p.px(x, y, random() < 0.2 ? "#d0a6ff" : random() < 0.5 ? "#ffffff" : "#8c84b0");
  }
  // Der Zeitriss am Himmel (rechts der Mitte): Schein, Rand, heller Kern
  const rx = 370;
  for (let y = 4; y < 112; y += 1) {
    const t = (y - 4) / 108;
    const width = Math.sin(t * Math.PI) * 26 + 2;
    const wobble = Math.round(Math.sin(y * 0.45) * 3 + Math.sin(y * 0.13) * 5);
    for (let x = rx - width * 2.4; x < rx + width * 2.4; x += 1) {
      const d = Math.abs(x - rx - wobble) / (width * 2.4);
      if (d < 1 && (d < 0.55 || (Math.floor(x) + y) % 2 === 0)) {
        p.px(x, y, d < 0.3 ? "#5e2a8c" : "#3e1e66");
      }
    }
  }
  const core = zigzag(random, rx, 6, rx + 4, 110, 18, 16);
  for (let i = 0; i + 1 < core.length; i += 1) {
    const [x0, y0] = core[i] as [number, number];
    const [x1, y1] = core[i + 1] as [number, number];
    for (let k = -3; k <= 3; k += 1) {
      p.line(x0 + k, y0, x1 + k, y1, Math.abs(k) <= 1 ? "#f0e0ff" : VIOLET[2]);
    }
  }
  // Truemmer, die in den Riss gesogen werden
  for (const [x, y, s] of [[340, 30, 3], [405, 46, 2], [352, 78, 2], [396, 20, 2], [330, 62, 1]] as const) {
    p.shape(rect(x, y, s + 2, s + 1), MARBLE, { shade: 1 });
  }
  // Ferne Berge
  for (let x = 0; x < MENU_W; x += 1) {
    const h = 118 + Math.round(Math.sin(x * 0.021) * 8 + Math.sin(x * 0.067) * 4);
    for (let y = h; y < 150; y += 1) {
      p.px(x, y, y === h ? "#3a2a50" : "#2a1e3c");
    }
  }
  // Das Kolosseum
  colosseum(p, 360, 150, 190);
  // Tempelruine links
  p.shape(rect(40, 112, 110, 6), MARBLE, { shade: 1 });
  p.shape(poly(38, 112, 95, 92, 152, 112), MARBLE, { shade: 1 });
  p.fill(poly(55, 110, 95, 97, 135, 110), MARBLE[1]);
  for (const [x, broken] of [[48, false], [70, false], [92, true], [114, false], [136, true]] as const) {
    column(p, x, 150, broken ? 26 : 32, 7, broken);
  }
  // Nebelband am Horizont
  for (let y = 140; y < 152; y += 1) {
    for (let x = 0; x < MENU_W; x += 1) {
      if ((x * 7 + y * 3) % 5 === 0) {
        p.px(x, y, "#5a4070");
      }
    }
  }
  // Vordergrund: dunkler Boden mit Steinen, Knochen, Schilden
  for (let x = 0; x < MENU_W; x += 1) {
    const top = 150 + Math.round(Math.sin(x * 0.05) * 2);
    for (let y = top; y < MENU_H; y += 1) {
      p.px(x, y, y === top ? "#3e3450" : (x + y) % 7 === 0 ? "#231c30" : "#1b1626");
    }
  }
  // Abgestuerzte Mech-Kapsel links vorn, noch leuchtend
  p.shape(poly(6, 172, 14, 154, 38, 150, 50, 160, 46, 176, 10, 178), MECH, { shade: 2 });
  p.shape(rect(20, 158, 14, 5), MECH_DARK, { shade: 0, light: 0 });
  p.line(22, 160, 31, 160, CYAN);
  p.px(32, 160, CYAN_HOT);
  for (let y = 120; y < 150; y += 3) {
    p.px(30 + Math.round(Math.sin(y) * 3), y, "#6a5a80");
  }
  // Verstreute Bronzeschilde, Helme und Knochen
  for (const [x, y] of [[170, 168], [250, 172], [470, 166], [515, 174], [110, 170]] as const) {
    p.shape(oval(x, y, 4, 3), BRONZE, { shade: 1 });
    p.px(x, y, GOLD[3]);
  }
  for (let i = 0; i < 30; i += 1) {
    p.px(Math.floor(random() * MENU_W), 158 + Math.floor(random() * 20), random() < 0.5 ? "#dcd2bc" : "#4a3e5a");
  }
  // Feuerschalen am Kolosseum
  brazier(p, 268, 140);
  brazier(p, 452, 140);
  return p;
}

// --- Arena --------------------------------------------------------------------------------

/** Rand des Arenabilds um die Spielflaeche (Entwurfspixel). */
export const ARENA_WALL = 44;
/** Die Arena wird in halber Aufloesung gemalt: 1 Pixel = 2 Entwurfspixel. */
export const ARENA_PIXEL = 2;

const FLOOR: readonly string[] = ["#363042", "#3a3446", "#3e384c", "#38324a"];
const JOINT = "#221e2c";

export function paintArenaPixels(): Pix {
  const wall = ARENA_WALL / ARENA_PIXEL;
  const W = (ARENA.width + ARENA_WALL * 2) / ARENA_PIXEL;
  const H = (ARENA.height + ARENA_WALL * 2) / ARENA_PIXEL;
  const p = new Pix(W, H, 77);
  const random = seeded(77);
  const x0 = wall;
  const y0 = wall;
  const x1 = W - wall;
  const y1 = H - wall;

  // Boden: dunkle Steinplatten in versetzten Reihen
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      p.px(x, y, JOINT);
    }
  }
  let row = 0;
  for (let y = y0; y < y1; y += 14) {
    let x = x0 - (row % 2) * 11;
    while (x < x1) {
      const w = 18 + Math.floor(random() * 10);
      const color = FLOOR[Math.floor(random() * FLOOR.length)] as string;
      for (let yy = y + 1; yy < Math.min(y + 14, y1); yy += 1) {
        for (let xx = Math.max(x0, x + 1); xx < Math.min(x + w, x1); xx += 1) {
          // Lichtkante oben, Schattenkante rechts
          const top = yy === y + 1;
          const right = xx === x + w - 1;
          p.px(xx, yy, top ? "#4a445a" : right ? "#2c2838" : (xx * 3 + yy * 5) % 23 === 0 ? "#302a3c" : color);
        }
      }
      // gelegentlich ein Riss in der Platte
      if (random() < 0.25) {
        const cx = x + 3 + Math.floor(random() * (w - 6));
        p.line(cx, y + 2, cx + 2, y + 7, JOINT);
        p.line(cx + 2, y + 7, cx + 1, y + 12, JOINT);
      }
      x += w;
    }
    row += 1;
  }
  // Sandverwehungen in den Ecken
  for (const [cx, cy] of [[x0 + 8, y0 + 6], [x1 - 10, y0 + 8], [x0 + 10, y1 - 8], [x1 - 8, y1 - 6]] as const) {
    for (let y = cy - 10; y < cy + 10; y += 1) {
      for (let x = cx - 18; x < cx + 18; x += 1) {
        const d = ((x - cx) / 18) ** 2 + ((y - cy) / 10) ** 2;
        if (d < 1 && x >= x0 && x < x1 && y >= y0 && y < y1 && (d < 0.5 || (x + y) % 2 === 0)) {
          p.px(x, y, d < 0.3 ? "#8a7458" : "#6a5844");
        }
      }
    }
  }
  // Der Platz in der Mitte: Marmorring mit goldenem Maeanderband
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);
  p.shape(oval(cx, cy, 62, 40), MARBLE, { shade: 1, edge: false });
  p.fill(oval(cx, cy, 56, 35), GOLD[1]);
  p.fill(oval(cx, cy, 54, 33), "#2c2638");
  for (let a = 0; a < 120; a += 1) {
    const angle = (a / 120) * Math.PI * 2;
    const x = cx + Math.cos(angle) * 59;
    const y = cy + Math.sin(angle) * 37.5;
    p.px(x, y, a % 3 === 0 ? GOLD[3] : GOLD[2]);
  }
  // Der Riss im Boden: violetter Spalt mit Schein, Risse laufen nach aussen
  for (let y = cy - 16; y <= cy + 16; y += 1) {
    for (let x = cx - 40; x <= cx + 40; x += 1) {
      const d = ((x - cx) / 40) ** 2 + ((y - cy) / 16) ** 2;
      if (d < 1 && (d < 0.35 || (x + y) % 2 === 0)) {
        p.px(x, y, d < 0.35 ? "#3e1e66" : "#33205a");
      }
    }
  }
  const main = zigzag(random, cx - 34, cy + 3, cx + 34, cy - 3, 12, 6);
  for (let i = 0; i + 1 < main.length; i += 1) {
    const [ax, ay] = main[i] as [number, number];
    const [bx, by] = main[i + 1] as [number, number];
    for (let k = -2; k <= 2; k += 1) {
      p.line(ax, ay + k, bx, by + k, Math.abs(k) === 0 ? "#f0e0ff" : Math.abs(k) === 1 ? VIOLET[3] : VIOLET[2]);
    }
  }
  for (const [tx, ty] of [[x0 + 30, y0 + 20], [x1 - 40, y0 + 26], [x0 + 60, y1 - 18], [x1 - 70, y1 - 24], [cx + 10, y0 + 6], [cx - 30, y1 - 4]] as const) {
    riftCrack(p, zigzag(random, cx + (tx < cx ? -30 : 30), cy, tx, ty, 9, 8));
  }
  // Truemmer am Rand: Saeulenstuempfe, Schilde, Speere, Schaedel, Mech-Platten
  column(p, x0 + 16, y0 + 30, 12, 8, true);
  column(p, x1 - 24, y0 + 32, 14, 8, true);
  column(p, x0 + 22, y1 - 10, 10, 8, true);
  column(p, x1 - 30, y1 - 12, 12, 8, true);
  for (const [sx, sy] of [[x0 + 52, y0 + 14], [x1 - 64, y1 - 14], [x0 + 140, y1 - 10]] as const) {
    p.shape(oval(sx, sy, 5, 3.5), BRONZE, { shade: 1 });
    p.px(sx, sy, GOLD[3]);
  }
  p.line(x0 + 96, y0 + 10, x0 + 112, y0 + 4, BRONZE[1]);
  p.line(x1 - 120, y1 - 6, x1 - 100, y1 - 14, BRONZE[1]);
  for (let i = 0; i < 26; i += 1) {
    const edge = random();
    const bx = edge < 0.5 ? x0 + 6 + Math.floor(random() * (x1 - x0 - 12)) : random() < 0.5 ? x0 + 4 + Math.floor(random() * 30) : x1 - 34 + Math.floor(random() * 30);
    const by = edge < 0.5 ? (random() < 0.5 ? y0 + 4 + Math.floor(random() * 12) : y1 - 16 + Math.floor(random() * 12)) : y0 + 10 + Math.floor(random() * (y1 - y0 - 20));
    p.px(bx, by, "#cfc4ae");
    p.px(bx + 1, by, "#9a8c74");
  }
  for (const [mx, my] of [[x1 - 46, y0 + 12], [x0 + 70, y1 - 22]] as const) {
    p.shape(poly(mx, my, mx + 10, my - 2, mx + 12, my + 4, mx + 2, my + 6), MECH, { shade: 1 });
    p.px(mx + 5, my + 2, CYAN);
  }

  // Obere Wand: Bogengaenge des Kolosseums mit Bannern und Feuerschalen
  const stone: Ramp = ["#1a1424", "#3a3048", "#564a68", "#7a6c8e"];
  p.shape(rect(0, 0, W, y0), stone, { shade: 1, edge: false });
  for (let x = 4; x < W - 10; x += 16) {
    p.fill(union(rect(x, 8, 10, y0 - 9), oval(x + 5, 8, 5, 4)), stone[0]);
    p.fill(rect(x + 3, 12, 4, y0 - 13), "#2e1c48");
  }
  p.line(0, 2, W, 2, stone[3]);
  p.line(0, y0 - 1, W, y0 - 1, OUT);
  for (const bx of [Math.floor(W * 0.18), Math.floor(W * 0.4), Math.floor(W * 0.6), Math.floor(W * 0.82)]) {
    p.shape(poly(bx - 5, 3, bx + 5, 3, bx + 5, 17, bx, 14, bx - 5, 17), RED, { shade: 1 });
    p.fill(oval(bx, 8, 2, 2), GOLD[2]);
  }
  for (const fx of [Math.floor(W * 0.08), Math.floor(W * 0.29), Math.floor(W * 0.71), Math.floor(W * 0.92)]) {
    brazier(p, fx, 9);
  }
  // Seitenwaende: Pfeiler
  for (const sx of [0, x1]) {
    p.shape(rect(sx, y0, wall, y1 - y0), stone, { shade: 1, edge: false });
    for (let y = y0 + 6; y < y1; y += 18) {
      p.shape(rect(sx + 4, y, wall - 8, 14), stone, { shade: 1 });
    }
  }
  // Untere Bruestung aus Marmor mit Bronzeband
  p.shape(rect(0, y1, W, wall), MARBLE, { shade: 1, edge: false });
  p.fill(rect(0, y1 + 3, W, 2), BRONZE[2]);
  for (let x = 6; x < W; x += 14) {
    p.fill(rect(x, y1 + 7, 6, wall - 9), MARBLE[1]);
  }
  // Kante der Spielflaeche
  for (let x = x0 - 1; x <= x1; x += 1) {
    p.px(x, y0, OUT);
    p.px(x, y1, OUT);
  }
  for (let y = y0; y <= y1; y += 1) {
    p.px(x0 - 1, y, OUT);
    p.px(x1, y, OUT);
  }
  return p;
}
