/**
 * Die Comic-Figuren: alle Spieler und Gegner werden hier von Hand gezeichnet.
 *
 * Duester und kantig: fast schwarze Tinte, harte Zweiton-Schatten, schmale leuchtende Augen.
 * Dicke Tinten-Kontur, wenig Farbe, Blutrot und Bernstein als Akzent - dieselbe
 * Handschrift wie Waffen, Arena, Logo und Oberflaeche.
 *
 * Jede Figur steht auf einer Leinwand von 78 x 78 Pixeln und schaut nach RECHTS
 * (das Spiel spiegelt sie, wenn sie nach links laeuft).
 */

import type Phaser from "phaser";
import { characterKey, enemyKey } from "../config/assets";
import { CHARACTER_IDS } from "../game/data/characters";
import type { CharacterId, EnemyType } from "../game/types";
import { NOIR } from "./noir";

const SIZE = 78;
const INK: string = NOIR.ink;

type Ctx = CanvasRenderingContext2D;

// --- Zeichenhilfen -----------------------------------------------------------------

/** Fuellt eine Form und zieht die dicke Kontur darum (Kontur zuerst, Flaeche darueber). */
export function shape(ctx: Ctx, build: () => void, fill: string, lineWidth = 6): void {
  ctx.beginPath();
  build();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, lineWidth = 6): void {
  shape(ctx, () => ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2), fill, lineWidth);
}

export function polygon(ctx: Ctx, points: readonly (readonly [number, number])[], fill: string, lineWidth = 6): void {
  shape(
    ctx,
    () => {
      points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
    },
    fill,
    lineWidth,
  );
}

/** Heller Glanzfleck oben links. */
export function shine(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.4, y - ry * 0.55, rx * 0.32, ry * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
}

/** Dicke schwarze Linie - Augenbraue, Mund, Riss. */
export function stroke(ctx: Ctx, points: readonly (readonly [number, number])[], width = 4, color = INK): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function star(ctx: Ctx, cx: number, cy: number, outer: number, inner: number, points: number, fill: string, lineWidth = 4): void {
  shape(
    ctx,
    () => {
      for (let i = 0; i < points * 2; i += 1) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
    },
    fill,
    lineWidth,
  );
}

// --- Duestere Bausteine ---------------------------------------------------------------

type Pts = readonly (readonly [number, number])[];

/** Flaeche mit harter Zweitonschattung: unten rechts liegt eine dunklere Haelfte. */
function cel(ctx: Ctx, build: () => void, fill: string, shadow: string, box: [number, number, number, number], lineWidth = 5): void {
  shape(ctx, build, fill, lineWidth);
  const [x, y, w, h] = box;
  ctx.save();
  ctx.beginPath();
  build();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.58, y - 2);
  ctx.lineTo(x + w + 2, y - 2);
  ctx.lineTo(x + w + 2, y + h + 2);
  ctx.lineTo(x - 2, y + h + 2);
  ctx.lineTo(x - 2, y + h * 0.72);
  ctx.closePath();
  ctx.fillStyle = shadow;
  ctx.fill();
  ctx.restore();
  // Kontur noch einmal ueber den Rand, damit der Schatten sie nicht anknabbert.
  ctx.beginPath();
  build();
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function boundsOf(points: Pts): [number, number, number, number] {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}

function poly(ctx: Ctx, points: Pts, fill: string, shadow: string, lineWidth = 5): void {
  cel(
    ctx,
    () => {
      points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
    },
    fill,
    shadow,
    boundsOf(points),
    lineWidth,
  );
}

/** Ein leuchtendes, schmales Auge - schraeg, hart, ohne Niedlichkeit. */
function slit(ctx: Ctx, x: number, y: number, w: number, color: string, tilt = 0.35): void {
  const h = w * 0.34;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h * tilt * 2);
  ctx.lineTo(x + w / 2, y + h * tilt * 2 - h * 0.2);
  ctx.lineTo(x + w / 2 - 1, y + h * 0.9);
  ctx.lineTo(x - w / 2 + 1, y + h * 0.7 - h * tilt);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** Weicher Leuchtschein um ein Auge. */
function glow(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/** Zornfalte ueber dem Auge. */
function scowl(ctx: Ctx, x1: number, y1: number, x2: number, y2: number): void {
  stroke(ctx, [[x1, y1], [x2, y2]], 4.5);
}

// --- Spieler -------------------------------------------------------------------------

interface Hero {
  coat: string;
  coatDark: string;
  skin?: string;
  skinDark?: string;
  broad?: boolean;
}

const SKIN = "#d9b48f";
const SKIN_DARK = "#a47c5a";

/** Stiefel, Rumpf, Arme und Haende - die Grundform jedes Helden. */
function heroBody(ctx: Ctx, hero: Hero): void {
  const w = hero.broad ? 5 : 0;
  // Stiefel
  poly(ctx, [[28 - w, 62], [38, 62], [38, 72], [25 - w, 72]], "#23262f", "#14161c", 4);
  poly(ctx, [[42, 62], [52 + w, 62], [55 + w, 72], [42, 72]], "#23262f", "#14161c", 4);
  // Arme
  poly(ctx, [[14 - w, 42], [24, 41], [25, 58], [14 - w, 59]], hero.coat, hero.coatDark, 4);
  poly(ctx, [[56, 41], [66 + w, 42], [66 + w, 59], [55, 58]], hero.coat, hero.coatDark, 4);
  poly(ctx, [[14 - w, 58], [25, 58], [24, 65], [15 - w, 65]], hero.skin ?? SKIN, hero.skinDark ?? SKIN_DARK, 3.5);
  poly(ctx, [[55, 58], [66 + w, 58], [65 + w, 65], [56, 65]], hero.skin ?? SKIN, hero.skinDark ?? SKIN_DARK, 3.5);
  // Rumpf
  poly(ctx, [[22 - w, 40], [58 + w, 40], [55 + w, 64], [25 - w, 64]], hero.coat, hero.coatDark, 5);
}

/** Kantiger Kopf mit hartem Kinn. */
function heroHead(ctx: Ctx, skin = SKIN, skinDark = SKIN_DARK): void {
  poly(ctx, [[29, 17], [51, 17], [53, 31], [47, 41], [33, 41], [27, 31]], skin, skinDark, 5);
}

function drawHero(ctx: Ctx, id: CharacterId): void {
  switch (id) {
    case "soeldner": {
      heroBody(ctx, { coat: "#58613f", coatDark: "#3b4229" });
      // Munitionsgurt und Schulterstreifen
      stroke(ctx, [[26, 42], [54, 62]], 5, "#2a2218");
      stroke(ctx, [[26, 42], [54, 62]], 2, NOIR.amber);
      heroHead(ctx);
      // Stoppeln und Narbe
      stroke(ctx, [[34, 38], [46, 38]], 3, "#6b5238");
      stroke(ctx, [[44, 22], [49, 32]], 2, "#7a2a22");
      slit(ctx, 36, 29, 9, NOIR.bone);
      slit(ctx, 46, 29, 9, NOIR.bone);
      // Helm
      poly(ctx, [[25, 28], [26, 14], [40, 8], [54, 14], [55, 28], [51, 22], [29, 22]], "#3d4730", "#262d1d", 5);
      stroke(ctx, [[40, 9], [40, 21]], 3, "#262d1d");
      scowl(ctx, 31, 23, 39, 27);
      scowl(ctx, 50, 23, 43, 27);
      break;
    }
    case "raufbold": {
      heroBody(ctx, { coat: "#c9a98a", coatDark: "#8d7258", broad: true });
      // Brust mit Narben
      stroke(ctx, [[34, 48], [40, 56]], 2.5, "#7a2a22");
      stroke(ctx, [[46, 50], [42, 58]], 2.5, "#7a2a22");
      heroHead(ctx);
      slit(ctx, 36, 29, 9, NOIR.bone);
      slit(ctx, 46, 29, 9, NOIR.bone);
      // Stirnband
      poly(ctx, [[27, 22], [53, 22], [53, 27], [27, 27]], NOIR.blood, NOIR.bloodDark, 4);
      poly(ctx, [[27, 23], [14, 18], [18, 26], [13, 31], [27, 27]], NOIR.blood, NOIR.bloodDark, 3.5);
      scowl(ctx, 30, 28, 38, 31);
      scowl(ctx, 51, 28, 44, 31);
      stroke(ctx, [[38, 37], [46, 36]], 3);
      // bandagierte Faeuste
      poly(ctx, [[8, 56], [24, 56], [25, 68], [9, 68]], NOIR.bone, NOIR.boneDark, 4);
      poly(ctx, [[56, 56], [72, 56], [71, 68], [55, 68]], NOIR.bone, NOIR.boneDark, 4);
      stroke(ctx, [[10, 62], [23, 62]], 2, NOIR.blood);
      stroke(ctx, [[57, 62], [70, 62]], 2, NOIR.blood);
      break;
    }
    case "jaeger": {
      heroBody(ctx, { coat: "#2f4a3a", coatDark: "#1d3026" });
      // Koecherriemen
      stroke(ctx, [[54, 41], [28, 63]], 4, "#3a2a1c");
      // Kapuze, Gesicht liegt im Schatten
      poly(ctx, [[24, 38], [24, 18], [34, 8], [46, 8], [56, 18], [56, 38], [48, 42], [32, 42]], "#2f4a3a", "#1d3026", 5);
      poly(ctx, [[31, 20], [49, 20], [51, 33], [45, 40], [35, 40], [29, 33]], "#16181f", "#0d0e13", 3);
      glow(ctx, 36, 29, 9, NOIR.amber);
      glow(ctx, 45, 29, 9, NOIR.amber);
      slit(ctx, 36, 29, 7, NOIR.amber);
      slit(ctx, 45, 29, 7, NOIR.amber);
      // Pfeilspitzen ueber der Schulter
      polygon(ctx, [[58, 28], [62, 18], [66, 28]], NOIR.steel3, 3);
      polygon(ctx, [[64, 30], [68, 20], [72, 30]], NOIR.steel3, 3);
      break;
    }
    case "panzer": {
      heroBody(ctx, { coat: "#4d596d", coatDark: "#2f3848", broad: true });
      // Schulterplatten
      poly(ctx, [[8, 38], [26, 36], [27, 48], [10, 50]], NOIR.steel3, NOIR.steel1, 4);
      poly(ctx, [[54, 36], [72, 38], [70, 50], [53, 48]], NOIR.steel3, NOIR.steel1, 4);
      ellipse(ctx, 40, 52, 5, 5, NOIR.blood, 3);
      // Helm mit T-Visier
      poly(ctx, [[25, 36], [25, 16], [35, 8], [45, 8], [55, 16], [55, 36], [49, 42], [31, 42]], "#6a7589", "#3d4658", 5);
      poly(ctx, [[28, 22], [52, 22], [52, 29], [44, 29], [44, 40], [36, 40], [36, 29], [28, 29]], "#0e0f15", "#0e0f15", 3);
      glow(ctx, 40, 25.5, 14, NOIR.blood);
      stroke(ctx, [[31, 25.5], [49, 25.5]], 3.5, "#ff4a4a");
      for (const x of [29, 51]) {
        ellipse(ctx, x, 14, 1.8, 1.8, NOIR.bone, 1.5);
      }
      break;
    }
    case "glueckspilz": {
      heroBody(ctx, { coat: "#1f2230", coatDark: "#11131c" });
      // Weste, Krawatte
      poly(ctx, [[34, 40], [46, 40], [43, 58], [37, 58]], NOIR.bone, NOIR.boneDark, 3);
      poly(ctx, [[38, 41], [42, 41], [43, 56], [40, 60], [37, 56]], NOIR.teal, "#27807a", 3);
      // Gluecksmuenze an der Brust
      ellipse(ctx, 29, 52, 3.5, 3.5, NOIR.amber, 2.5);
      heroHead(ctx);
      slit(ctx, 36, 30, 8, NOIR.bone);
      slit(ctx, 46, 30, 8, NOIR.bone);
      scowl(ctx, 31, 25, 39, 28);
      scowl(ctx, 50, 25, 43, 28);
      // schiefes Grinsen mit Goldzahn
      stroke(ctx, [[37, 37], [43, 38], [48, 35]], 3);
      ellipse(ctx, 45, 37.5, 1.5, 1.5, NOIR.amber, 1);
      // Schlapphut
      poly(ctx, [[12, 22], [28, 20], [52, 20], [68, 22], [66, 26], [14, 26]], "#2a2f40", "#171a26", 4.5);
      poly(ctx, [[28, 22], [29, 8], [51, 8], [52, 22]], "#2a2f40", "#171a26", 4.5);
      poly(ctx, [[28, 17], [52, 17], [52, 21], [28, 21]], NOIR.amber, NOIR.amberDark, 3);
      break;
    }
    case "schatten": {
      heroBody(ctx, { coat: "#1a1526", coatDark: "#0d0a15", skin: "#1a1526", skinDark: "#0d0a15" });
      // Guertel und Klingenschaft
      stroke(ctx, [[24, 54], [56, 54]], 4, "#2d2640");
      poly(ctx, [[54, 30], [58, 28], [60, 50], [56, 52]], NOIR.steel3, NOIR.steel1, 3);
      // Kapuze
      poly(ctx, [[24, 40], [23, 18], [33, 8], [47, 8], [57, 18], [56, 40], [48, 44], [32, 44]], "#241c38", "#120d1e", 5);
      poly(ctx, [[29, 21], [51, 21], [52, 31], [28, 31]], "#0b0912", "#0b0912", 3);
      glow(ctx, 36, 26, 9, NOIR.violet);
      glow(ctx, 45, 26, 9, NOIR.violet);
      slit(ctx, 36, 26, 8, "#c9a8ff", 0.45);
      slit(ctx, 45, 26, 8, "#c9a8ff", 0.45);
      // roter Schal mit wehendem Ende
      poly(ctx, [[26, 38], [54, 38], [52, 46], [28, 46]], NOIR.blood, NOIR.bloodDark, 4);
      poly(ctx, [[27, 40], [8, 36], [4, 44], [12, 46], [10, 54], [28, 46]], NOIR.blood, NOIR.bloodDark, 3.5);
      break;
    }
  }
}

// --- Gegner --------------------------------------------------------------------------

function mandibles(ctx: Ctx, x: number, y: number, flip = 1): void {
  polygon(ctx, [[x, y], [x + 8 * flip, y + 3], [x + 4 * flip, y + 11]], NOIR.bone, 2.5);
}

function larvaBody(ctx: Ctx, skin: string, dark: string, band: string, eye: string): void {
  // Segmente von hinten nach vorn
  poly(ctx, [[6, 56], [14, 42], [30, 40], [32, 62], [14, 64]], skin, dark, 5);
  poly(ctx, [[22, 52], [28, 36], [46, 34], [48, 62], [30, 66]], skin, dark, 5);
  stroke(ctx, [[30, 36], [32, 64]], 3.5, band);
  stroke(ctx, [[17, 42], [20, 62]], 3.5, band);
  // Kopf
  poly(ctx, [[42, 40], [48, 24], [64, 22], [72, 34], [66, 54], [48, 56]], skin, dark, 5);
  glow(ctx, 59, 34, 14, eye);
  slit(ctx, 55, 32, 11, eye, 0.5);
  slit(ctx, 67, 35, 9, eye, 0.5);
  scowl(ctx, 51, 27, 60, 33);
  mandibles(ctx, 62, 48, 1);
  mandibles(ctx, 50, 50, -1);
  // Stacheln auf dem Ruecken
  for (const [x, y] of [[18, 40], [34, 34], [46, 24]] as const) {
    polygon(ctx, [[x - 3, y + 2], [x, y - 5], [x + 3, y + 2]], band, 2.5);
  }
}

function drawEnemy(ctx: Ctx, type: EnemyType): void {
  switch (type) {
    case "grunt": {
      larvaBody(ctx, "#7d8a6a", "#4d5842", "#2f3628", NOIR.amber);
      break;
    }
    case "swarmer": {
      // Beine
      for (const [x1, y1, x2, y2] of [
        [24, 46, 8, 36], [24, 52, 6, 56], [28, 58, 14, 70],
        [56, 46, 72, 36], [56, 52, 74, 56], [52, 58, 66, 70],
      ] as const) {
        stroke(ctx, [[x1, y1], [x2, y2]], 3.5);
      }
      poly(ctx, [[22, 40], [40, 28], [58, 40], [58, 58], [40, 66], [22, 58]], "#7c2d2a", "#4a1614", 5);
      // Stacheln
      for (const [x, y, dx, dy] of [[40, 28, 0, -10], [28, 34, -7, -8], [52, 34, 7, -8]] as const) {
        polygon(ctx, [[x - 3, y + 2], [x + dx, y + dy], [x + 3, y + 2]], NOIR.boneDark, 2.5);
      }
      glow(ctx, 40, 46, 14, NOIR.blood);
      ellipse(ctx, 40, 46, 8, 8, "#ff4a3a", 3);
      ellipse(ctx, 41, 46, 2.5, 5, INK, 1);
      break;
    }
    case "charger": {
      // Hoerner
      poly(ctx, [[18, 30], [8, 6], [30, 22]], NOIR.bone, NOIR.boneDark, 4);
      poly(ctx, [[62, 30], [72, 6], [50, 22]], NOIR.bone, NOIR.boneDark, 4);
      poly(ctx, [[10, 42], [24, 26], [56, 26], [70, 42], [64, 66], [40, 72], [16, 66]], "#9c2c2a", "#5e1514", 5);
      // Schultermuskeln
      stroke(ctx, [[24, 54], [34, 62]], 3, "#5e1514");
      stroke(ctx, [[56, 54], [46, 62]], 3, "#5e1514");
      glow(ctx, 30, 42, 10, NOIR.amber);
      glow(ctx, 50, 42, 10, NOIR.amber);
      slit(ctx, 30, 42, 11, "#ffd45a", 0.6);
      slit(ctx, 50, 42, 11, "#ffd45a", 0.6);
      scowl(ctx, 20, 33, 36, 40);
      scowl(ctx, 60, 33, 44, 40);
      // Hauer und Maul
      poly(ctx, [[27, 62], [32, 52], [36, 62]], NOIR.bone, NOIR.boneDark, 3);
      poly(ctx, [[44, 62], [48, 52], [53, 62]], NOIR.bone, NOIR.boneDark, 3);
      break;
    }
    case "spitter": {
      poly(ctx, [[12, 46], [20, 24], [40, 16], [60, 24], [68, 46], [58, 66], [40, 72], [22, 66]], "#5b7a34", "#364a1e", 5);
      // Adern
      stroke(ctx, [[22, 34], [30, 44], [26, 56]], 2.5, "#364a1e");
      stroke(ctx, [[58, 34], [52, 44], [56, 56]], 2.5, "#364a1e");
      // viele kleine Augen
      for (const [x, y, w] of [[30, 30, 7], [42, 26, 8], [53, 31, 7], [36, 38, 5]] as const) {
        glow(ctx, x, y, 8, NOIR.toxic);
        slit(ctx, x, y, w, "#d6ff6a", 0.4);
      }
      // Schlund mit Gift
      poly(ctx, [[28, 48], [52, 48], [50, 62], [30, 62]], "#14160e", "#14160e", 4);
      glow(ctx, 40, 56, 12, NOIR.toxic);
      for (let x = 31; x < 50; x += 6) {
        polygon(ctx, [[x, 48], [x + 3, 55], [x + 6, 48]], NOIR.bone, 1.5);
      }
      poly(ctx, [[34, 62], [37, 62], [37, 74], [34, 74]], "#9be03a", "#5f9420", 2.5);
      poly(ctx, [[44, 62], [47, 62], [47, 71], [44, 71]], "#9be03a", "#5f9420", 2.5);
      break;
    }
    case "bruiser": {
      poly(ctx, [[10, 56], [6, 34], [18, 14], [40, 8], [62, 14], [74, 34], [70, 58], [58, 70], [22, 70]], "#5d5249", "#3a322c", 6);
      // Glutrisse
      stroke(ctx, [[18, 24], [28, 32], [24, 44], [32, 52]], 5, INK);
      stroke(ctx, [[18, 24], [28, 32], [24, 44], [32, 52]], 2, NOIR.amber);
      stroke(ctx, [[62, 26], [54, 36], [60, 48], [52, 60]], 5, INK);
      stroke(ctx, [[62, 26], [54, 36], [60, 48], [52, 60]], 2, NOIR.amber);
      // Kopf unter der Stirn
      glow(ctx, 40, 36, 12, NOIR.blood);
      slit(ctx, 33, 36, 9, "#ff5a3a", 0.6);
      slit(ctx, 47, 36, 9, "#ff5a3a", 0.6);
      scowl(ctx, 26, 29, 37, 34);
      scowl(ctx, 54, 29, 43, 34);
      stroke(ctx, [[30, 54], [35, 51], [40, 55], [45, 51], [50, 54]], 4);
      break;
    }
    case "elite": {
      larvaBody(ctx, "#4d5a46", "#2c3527", "#161b13", NOIR.blood);
      // Dornenkrone
      poly(ctx, [[44, 30], [44, 10], [51, 22], [56, 4], [62, 20], [68, 6], [70, 22], [72, 12], [72, 30]], "#2a2f3a", "#14171d", 4);
      stroke(ctx, [[46, 28], [70, 28]], 3, NOIR.blood);
      break;
    }
    case "boss": {
      // Panzerplatten und Beine
      for (const x of [14, 28, 52, 66]) {
        poly(ctx, [[x - 6, 52], [x + 6, 52], [x + 4, 74], [x - 4, 74]], "#3a2554", "#21143a", 4);
      }
      // Hoerner
      poly(ctx, [[20, 24], [6, 4], [30, 16]], NOIR.bone, NOIR.boneDark, 4);
      poly(ctx, [[60, 24], [74, 4], [50, 16]], NOIR.bone, NOIR.boneDark, 4);
      poly(ctx, [[10, 40], [18, 18], [40, 10], [62, 18], [70, 40], [62, 62], [18, 62]], "#4a2d6e", "#2a1745", 5);
      // Rippen
      stroke(ctx, [[22, 52], [58, 52]], 3, "#2a1745");
      stroke(ctx, [[26, 58], [54, 58]], 3, "#2a1745");
      // vier Augen
      for (const [x, y, w] of [[26, 34, 9], [54, 34, 9], [36, 24, 8], [44, 24, 8]] as const) {
        glow(ctx, x, y, 10, NOIR.blood);
        slit(ctx, x, y, w, "#ff5a5a", 0.5);
      }
      scowl(ctx, 18, 26, 30, 31);
      scowl(ctx, 62, 26, 50, 31);
      // Kiefer
      poly(ctx, [[24, 44], [56, 44], [52, 56], [28, 56]], "#0e0a16", "#0e0a16", 3.5);
      for (let x = 27; x < 53; x += 6) {
        polygon(ctx, [[x, 44], [x + 3, 51], [x + 6, 44]], NOIR.bone, 1.5);
      }
      break;
    }
  }
}

// --- Einstieg ----------------------------------------------------------------------

function paint(scene: Phaser.Scene, key: string, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  draw(ctx);
  const texture = scene.textures.addCanvas(key, canvas);
  // Gemalte Flaechen sollen weich skalieren, nicht in harte Pixel zerfallen.
  texture?.setFilter(1);
}

/** Malt alle Spieler- und Gegnerfiguren. Mehrfach aufrufen ist harmlos. */
export function createFigureTextures(scene: Phaser.Scene): void {
  for (const id of CHARACTER_IDS) {
    paint(scene, characterKey(id), (ctx) => drawHero(ctx, id));
  }
  const types: EnemyType[] = ["grunt", "swarmer", "charger", "spitter", "bruiser", "elite", "boss"];
  for (const type of types) {
    paint(scene, enemyKey(type), (ctx) => drawEnemy(ctx, type));
  }
}
