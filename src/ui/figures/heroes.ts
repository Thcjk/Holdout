/**
 * Die sechs Helden - nach der Vorlage (Chibi-Fantasy-Bogen) gezeichnet.
 *
 * Aufbau jeder Figur, von hinten nach vorn:
 *   Dinge auf dem Ruecken (Umhang, Koecher, lange Haare) -> Beine und Stiefel ->
 *   Rumpf, Guertel, Arme -> Kopf (Gesicht, Haare, Hut/Helm) -> Augen und Mund.
 *
 * Raster: 100 x 100, Fuesse bei y = 96, Kopfmitte etwa bei (50, 41).
 * Die Figur schaut leicht nach rechts (Pupillen rechts); das Spiel spiegelt sie.
 */

import type { CharacterId } from "../../game/types";
import {
  belt,
  blush,
  boot,
  brow,
  type Ctx,
  ell,
  eyes,
  fill,
  fist,
  folds,
  gloss,
  happyEyes,
  line,
  mouth,
  P,
  part,
  rect,
  tube,
  within,
} from "./kit";

type Pair = readonly [string, string];

const SKIN: Pair = ["#f3c7a2", "#d99c7b"];

/** Ein Arm: Schulter -> Ellbogen -> Hand (je x, y). */
export type Arm = readonly [number, number, number, number, number, number];

/** Arme haengen leicht abgespreizt, die Faeuste etwas vom Koerper weg. */
const LEFT_ARM: Arm = [39, 60, 29.5, 68, 26.5, 78];
const RIGHT_ARM: Arm = [61, 60, 70.5, 68, 73.5, 78];

interface BodyStyle {
  tunic: Pair;
  sleeve: Pair;
  hand: Pair;
  pants: Pair;
  boots: Pair;
  /** Guertel: Band, Schatten, Schnalle. null = keiner. */
  belt?: readonly [string, string, string] | null;
  beltY?: number;
  /** Langes Gewand bis zu den Fuessen (Magier). */
  robe?: boolean;
  /** Breiter, staemmiger Koerper (Zwerg). */
  stout?: boolean;
  /** Aermel enden in einem Aufschlag dieser Farbe. */
  cuff?: Pair;
  /** Eigene Armhaltung; `null` = Arm wird spaeter mit `drawArm` gemalt (vor dem Kopf). */
  left?: Arm | null;
  right?: Arm | null;
  /** Wird zwischen Rumpf und Armen gemalt (Riemen, Kragen ...). */
  over?: () => void;
}

function armPath(arm: Arm, toWrist = 1): string {
  const [sx, sy, ex, ey, hx, hy] = arm;
  const wx = ex + (hx - ex) * toWrist;
  const wy = ey + (hy - ey) * toWrist;
  return `M ${sx} ${sy} Q ${ex} ${ey} ${wx} ${wy}`;
}

/** Beine, Stiefel, Rumpf, Guertel und Arme - der gemeinsame Koerper aller Helden. */
function body(ctx: Ctx, style: BodyStyle): void {
  const wide = style.stout ? 3.5 : 0;
  // Beine als runde Schlaeuche, die Stiefel zeigen nach aussen.
  if (!style.robe) {
    tube(ctx, `M ${44 - wide} 80 L ${42.5 - wide} 90`, 8.6 + wide * 0.6, style.pants[0], style.pants[1]);
    tube(ctx, `M ${56 + wide} 80 L ${57.5 + wide} 90`, 8.6 + wide * 0.6, style.pants[0], style.pants[1]);
  }
  boot(ctx, 42 - wide, 96.5, style.boots[0], style.boots[1], -1, style.stout ? 9 : 7.8, style.robe ? 6.5 : 8.5);
  boot(ctx, 58 + wide, 96.5, style.boots[0], style.boots[1], 1, style.stout ? 9 : 7.8, style.robe ? 6.5 : 8.5);

  // Rumpf: Kittel, schmal an den Schultern, unten ausgestellt.
  const bottom = style.robe ? 92 : 84.5;
  const flare = style.robe ? 5 : 1.5;
  const torso = P(
    `M ${38 - wide} 58 Q 50 55 ${62 + wide} 58 ` +
      `Q ${65 + wide + flare * 0.4} 70 ${66.5 + wide + flare} ${bottom} ` +
      `Q 50 ${bottom + 3.5} ${33.5 - wide - flare} ${bottom} ` +
      `Q ${35 - wide - flare * 0.4} 70 ${38 - wide} 58 Z`,
  );
  part(ctx, torso, { base: style.tunic[0], shade: style.tunic[1], dx: 2.6, dy: 1.6 });
  // Schatten unter dem Kopf.
  within(ctx, torso, () => fill(ctx, ell(50, 57, 17 + wide, 6), "rgba(30,20,20,0.28)"));

  if (style.belt !== null) {
    const [band, shade, buckle] = style.belt ?? ["#6b4428", "#4e2f1a", "#c99a45"];
    belt(ctx, style.beltY ?? 72, 35 - wide - (style.robe ? 1.5 : 0), 65 + wide + (style.robe ? 1.5 : 0), band, shade, buckle);
  }
  style.over?.();

  if (style.left !== null) {
    drawArm(ctx, style.left ?? LEFT_ARM, -1, style);
  }
  if (style.right !== null) {
    drawArm(ctx, style.right ?? RIGHT_ARM, 1, style);
  }
}

/** Ein Arm mit Aermel, Aufschlag und Faust. */
function drawArm(ctx: Ctx, given: Arm, side: -1 | 1, style: BodyStyle): void {
  const wide = style.stout ? 3.5 : 0;
  const arm: Arm = [given[0] + side * wide, given[1], given[2] + side * wide * 1.4, given[3], given[4] + side * wide * 1.4, given[5]];
  const width = style.stout ? 9.4 : 8.4;
  tube(ctx, armPath(arm, 0.8), width, style.sleeve[0], style.sleeve[1]);
  if (style.cuff) {
    const [, , ex, ey, hx, hy] = arm;
    tube(ctx, `M ${ex + (hx - ex) * 0.45} ${ey + (hy - ey) * 0.45} L ${ex + (hx - ex) * 0.78} ${ey + (hy - ey) * 0.78}`, width + 1.2, style.cuff[0], style.cuff[1]);
  }
  fist(ctx, arm[4], arm[5], style.hand[0], style.hand[1], side === -1 ? 1 : -1, style.stout ? 5.6 : 5.1);
}

/** Gesicht (Hautflaeche) mit Ohren und Schatten am Kinn. */
function face(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, skin: Pair = SKIN, ears = true): void {
  if (ears) {
    part(ctx, ell(cx - rx + 0.6, cy + 3, 3.2, 4.2), { base: skin[0], shade: skin[1], dx: 0.6, dy: 0.8 });
    part(ctx, ell(cx + rx - 0.6, cy + 3, 3.2, 4.2), { base: skin[0], shade: skin[1], dx: 0.8, dy: 0.8 });
  }
  part(ctx, ell(cx, cy, rx, ry), { base: skin[0], shade: skin[1], dx: 2.6, dy: 2.2, hi: [cx - rx * 0.4, cy - ry * 0.3, rx * 0.8], light: 0.25 });
}

/** Schatten, den Haare/Helm auf die Stirn werfen. */
function foreheadShadow(ctx: Ctx, faceShape: Path2D, d: string, color = "rgba(150,80,60,0.35)"): void {
  within(ctx, faceShape, () => fill(ctx, P(d), color));
}

// --- Ritter --------------------------------------------------------------------------

const STEEL: Pair = ["#a5a8ac", "#71757a"];
const STEEL_DARK: Pair = ["#8c9095", "#5f6368"];
const MAIL: Pair = ["#8b8d8f", "#626467"];

function drawRitter(ctx: Ctx): void {
  body(ctx, {
    tunic: ["#7a756d", "#58534c"],
    sleeve: MAIL,
    hand: ["#7a4e30", "#57351f"],
    pants: ["#5e5a55", "#433f3b"],
    boots: ["#6a4630", "#4a2f1e"],
    beltY: 73,
  });
  // Kettenhemd-Saum unten am Kittel.
  for (let x = 33; x <= 65; x += 4) {
    line(ctx, `M ${x} 84.4 Q ${x + 2} 87 ${x + 4} 84.4`, 0.9, "#3f3c38");
  }
  // Kniekacheln
  part(ctx, ell(42.5, 87.5, 4, 2.6), { base: STEEL[0], shade: STEEL[1], dx: 0.4, dy: 0.8, line: 1.1 });
  part(ctx, ell(57.5, 87.5, 4, 2.6), { base: STEEL[0], shade: STEEL[1], dx: 0.4, dy: 0.8, line: 1.1 });

  // Kettenhaube um Gesicht und Hals (hinter dem Gesicht).
  const coif = P("M 27 42 Q 26 60 38 64 Q 50 67 62 64 Q 74 60 73 42 Z");
  part(ctx, coif, { base: MAIL[0], shade: MAIL[1], dx: 2, dy: 1.6 });
  within(ctx, coif, () => {
    for (let y = 46; y < 66; y += 3) {
      for (let x = 27 + ((y / 3) % 2) * 1.5; x < 74; x += 3) {
        line(ctx, `M ${x} ${y} Q ${x + 1.5} ${y + 1.6} ${x + 3} ${y}`, 0.55, "rgba(40,40,44,0.55)");
      }
    }
  });
  // Schulterstuecke
  const leftPauldron = P("M 24 68 Q 23 58 33 56.5 Q 41 56.5 42 61 Q 36 61.5 32 66 Q 28 70.5 24 68 Z");
  const rightPauldron = P("M 76 68 Q 77 58 67 56.5 Q 59 56.5 58 61 Q 64 61.5 68 66 Q 72 70.5 76 68 Z");
  part(ctx, leftPauldron, { base: STEEL[0], shade: STEEL[1], dx: 1, dy: 1.6, hi: [30, 59, 6] });
  part(ctx, rightPauldron, { base: STEEL[0], shade: STEEL[1], dx: 1.2, dy: 1.6, hi: [66, 59, 6] });
  line(ctx, "M 26 64 Q 31 59.5 39 59.6", 0.8, "rgba(40,40,44,0.6)");
  line(ctx, "M 74 64 Q 69 59.5 61 59.6", 0.8, "rgba(40,40,44,0.6)");

  // Gesicht im Helm
  const faceShape = ell(50, 45, 17.5, 15);
  part(ctx, faceShape, { base: SKIN[0], shade: SKIN[1], dx: 2.2, dy: 2, hi: [44, 44, 12], light: 0.25 });
  foreheadShadow(ctx, faceShape, "M 30 30 L 70 30 L 70 39 Q 50 35 30 39 Z", "rgba(120,70,60,0.4)");
  blush(ctx, 51, 50.5, 11);

  // Helm: Glocke mit Gesichtsoeffnung, Stirnband, Grat und Nieten.
  const helmet = P("M 25 49 Q 22 15 50 13 Q 78 15 75 49 Q 72 51.5 69 49.5 L 68.5 38 Q 50 33 31.5 38 L 31 49.5 Q 28 51.5 25 49 Z");
  part(ctx, helmet, { base: STEEL[0], shade: STEEL[1], dx: 2.6, dy: 2, hi: [38, 22, 16], light: 0.45 });
  const band = P("M 24.6 31 Q 50 24.5 75.4 31 L 75.6 37.5 Q 50 31 24.4 37.5 Z");
  part(ctx, band, { base: STEEL_DARK[0], shade: STEEL_DARK[1], dx: 0.6, dy: 1.2, line: 1.2 });
  part(ctx, P("M 48 13.6 Q 50 13 52 13.6 L 52.6 28 Q 50 27.4 47.4 28 Z"), { base: STEEL_DARK[0], shade: STEEL_DARK[1], dx: 0.5, dy: 0.5, line: 1 });
  for (const x of [30, 39, 61, 70]) {
    const y = 33.6 - (x < 50 ? (50 - x) : (x - 50)) * -0.06;
    part(ctx, ell(x, y, 1.15, 1.15), { base: "#c2c5c8", shade: "#7d8186", dx: 0.3, dy: 0.3, line: 0.7 });
  }
  gloss(ctx, 36, 20, 4, 2, 0.45);

  eyes(ctx, 51.5, 46.5, 7.6, { w: 4, h: 5, lookX: 1.3, brow: -1, browLift: 1.8 });
  mouth(ctx, 53, 54, "o", 3.2);
}

// --- Feuermagierin -----------------------------------------------------------------

const HAIR_RED: Pair = ["#d9632c", "#a5421b"];
const HAT_BROWN: Pair = ["#8e512f", "#663720"];

function torch(ctx: Ctx, x: number, y: number): void {
  // Stiel
  part(ctx, P(`M ${x - 0.4} ${y + 7} L ${x + 2.4} ${y + 7} L ${x - 1.6} ${y - 18} L ${x - 4.2} ${y - 18} Z`), { base: "#7d5432", shade: "#57381f", dx: 0.6, dy: 0.4, line: 1.1 });
  part(ctx, P(`M ${x - 5.2} ${y - 17} L ${x - 0.8} ${y - 17} L ${x - 1} ${y - 21} L ${x - 5.4} ${y - 21} Z`), { base: "#5e4a3a", line: 1 });
  // Leuchten
  const fx = x - 3.2;
  const fy = y - 26;
  const glow = ctx.createRadialGradient(fx, fy, 1, fx, fy, 14);
  glow.addColorStop(0, "rgba(255,200,90,0.5)");
  glow.addColorStop(1, "rgba(255,160,60,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(fx - 14, fy - 14, 28, 28);
  // Flamme
  const flame = P(`M ${fx} ${fy - 11} Q ${fx + 7} ${fy - 2} ${fx + 4.6} ${fy + 4} Q ${fx + 2} ${fy + 6.4} ${fx} ${fy + 6} Q ${fx - 5} ${fy + 6} ${fx - 5} ${fy + 1} Q ${fx - 5} ${fy - 4} ${fx} ${fy - 11} Z`);
  part(ctx, flame, { base: "#f3a43a", shade: "#d9622a", dx: -1, dy: -1.4, line: 1.1 });
  fill(ctx, P(`M ${fx} ${fy - 3} Q ${fx + 3} ${fy + 1} ${fx + 1.6} ${fy + 3.6} Q ${fx} ${fy + 4.6} ${fx - 1.8} ${fy + 3.4} Q ${fx - 2.4} ${fy} ${fx} ${fy - 3} Z`), "#ffe7a0");
}

const MAGIERIN_BODY: BodyStyle = {
  tunic: ["#a5442f", "#78291c"],
  sleeve: ["#a5442f", "#78291c"],
  hand: SKIN,
  pants: ["#5a3a2a", "#3e271b"],
  boots: ["#5c3a26", "#3f2617"],
  belt: ["#5e3a22", "#43281a", "#c99a45"],
  beltY: 70,
  robe: true,
  left: null,
};

function drawMagierin(ctx: Ctx): void {
  // Lange Haare hinter dem Koerper
  part(ctx, P("M 30 36 Q 17 52 20 73 Q 24 77 30 74 Q 29 62 33 50 Z"), { base: HAIR_RED[0], shade: HAIR_RED[1], dx: -1.2, dy: 1.2 });
  part(ctx, P("M 70 36 Q 85 50 81 72 Q 76 77 70 72 Q 71 60 67 50 Z"), { base: HAIR_RED[0], shade: HAIR_RED[1], dx: 1.6, dy: 1.2 });

  body(ctx, MAGIERIN_BODY);
  // Helle Stoffbahn vorn am Gewand und Kragen.
  part(ctx, P("M 46.5 75 L 53.5 75 L 55.5 94 L 44.5 94 Z"), { base: "#c99260", shade: "#a1703f", dx: 0.6, dy: 0.4, line: 1.1 });
  part(ctx, P("M 35 58 Q 50 72 65 58 Q 64 65 50 68 Q 36 65 35 58 Z"), { base: "#8c3626", shade: "#6a2318", dx: 0.6, dy: 1, line: 1.1 });
  folds(ctx, ["M 38 78 Q 37 85 36 91", "M 62 78 Q 63 85 64 91"], "#6a2318", 1.1);


  const faceShape = ell(50, 41.5, 20.5, 18);
  face(ctx, 50, 41.5, 20.5, 18);
  foreheadShadow(ctx, faceShape, "M 28 26 L 72 26 L 72 37 Q 50 32 28 37 Z");
  blush(ctx, 51, 50, 12.5);

  // Seitliche Straehnen und Pony
  part(ctx, P("M 31 34 Q 25 48 28.5 62 Q 32 58 33.5 51 Q 33 44 35 38 Z"), { base: HAIR_RED[0], shade: HAIR_RED[1], dx: -0.8, dy: 1 });
  part(ctx, P("M 69 34 Q 75 48 71.5 62 Q 68 58 66.5 51 Q 67 44 65 38 Z"), { base: HAIR_RED[0], shade: HAIR_RED[1], dx: 0.8, dy: 1 });
  const bangs = P(
    "M 29 41 Q 27 26 50 24.5 Q 73 26 71 41 Q 68.5 36 65.5 34 L 64 39.5 Q 60.5 33.5 56.5 32.5 L 55 37.5 Q 51.5 32 46.5 32.5 L 44 38 Q 40.5 33.5 37 34.5 L 34.5 40 Q 31.5 36.5 29 41 Z",
  );
  part(ctx, bangs, { base: HAIR_RED[0], shade: HAIR_RED[1], dx: 1, dy: 1.6, hi: [42, 28, 10] });
  folds(ctx, ["M 40 28 Q 38 31 37.5 34", "M 58 28 Q 60 31 61 33.5"], "#a5421b", 0.9);

  // Hexenhut: breite Krempe, Spitze knickt nach hinten rechts.
  const brim = P("M 11 33 Q 28 21.5 51 20.5 Q 76 20.5 91 29 Q 93.5 33.5 87 34.5 Q 71 29.5 51 29.5 Q 30 30.5 16.5 37.5 Q 9 38 11 33 Z");
  part(ctx, brim, { base: HAT_BROWN[0], shade: HAT_BROWN[1], dx: 1.2, dy: 2.2, hi: [30, 24, 14], light: 0.25 });
  const cone = P("M 31 27 Q 33 11 49 5 Q 61 1 72 4 Q 81 6.5 86 13 Q 78 9.5 72.5 12.5 Q 67.5 16 69 26.5 Q 50 21.5 31 27 Z");
  part(ctx, cone, { base: HAT_BROWN[0], shade: HAT_BROWN[1], dx: 2.6, dy: 1.6, hi: [42, 14, 12], light: 0.3 });
  part(ctx, P("M 31.4 24.5 Q 50 19 68.8 24 L 69 28 Q 50 23 31 28.6 Z"), { base: "#5e3420", shade: "#472616", dx: 0.4, dy: 0.8, line: 1.1 });
  folds(ctx, ["M 50 9 Q 46 15 46 21", "M 72 8 Q 70 11 70.5 14"], "#5a301c", 0.9);

  // Erhobener Arm mit Fackel vor den Haaren
  torch(ctx, 19.5, 63);
  drawArm(ctx, [38, 60, 27, 71, 19.5, 63], -1, MAGIERIN_BODY);

  eyes(ctx, 51.5, 44.5, 8.6, { w: 4.4, h: 5.8, lookX: 1, brow: -0.8, browLift: 2.4, browWidth: 4.2 });
  line(ctx, "M 53.4 47.8 Q 54.4 49.3 53 50", 0.9, "#b9775c");
  mouth(ctx, 52, 51.5, "grin", 5);
}

// --- Schurke ---------------------------------------------------------------------------

const CLOAK: Pair = ["#5b5350", "#3d3634"];

function drawSchurke(ctx: Ctx): void {
  // Umhang hinten
  part(ctx, P("M 33 55 Q 22 74 23 90 Q 28 94 34 91 Q 50 95 66 91 Q 72 94 77 90 Q 78 74 67 55 Z"), { base: "#4a4342", shade: "#332d2c", dx: 1.4, dy: 1 });

  body(ctx, {
    tunic: ["#5f5653", "#433c3a"],
    sleeve: ["#5f5653", "#433c3a"],
    hand: ["#4d4542", "#342e2c"],
    pants: ["#48413f", "#322d2b"],
    boots: ["#3f3431", "#2a2220"],
    belt: ["#6b4428", "#4e2f1a", "#b98a45"],
    beltY: 72,
    cuff: ["#6b4b33", "#4c3422"],
  });
  // Guerteltasche
  part(ctx, rect(59.5, 76.5, 7, 6.5, 1.4), { base: "#7a5236", shade: "#583925", dx: 0.6, dy: 0.8, line: 1.1 });
  // Dolchgriff am Guertel
  part(ctx, rect(36.4, 72.5, 2.2, 8, 0.8), { base: "#3b302c", line: 0.9 });
  part(ctx, rect(34.2, 76.6, 6.6, 1.8, 0.6), { base: "#b98a45", line: 0.9 });

  // Schal unter der Kapuze
  part(ctx, P("M 31 54 Q 50 67 69 54 Q 72 62 65 66.5 Q 50 72 35 66.5 Q 28 62 31 54 Z"), { base: "#57504d", shade: "#3d3735", dx: 1, dy: 1.2 });
  folds(ctx, ["M 40 64 Q 45 67 50 67.5", "M 56 67 Q 61 66 64 63"], "#2f2a28", 0.9);

  // Kapuze aussen
  const hood = P("M 23.5 57 Q 17 32 32 15 Q 42 5.5 51 5.5 Q 61 6 66 11 Q 84 25 76.5 57 Q 50 64 23.5 57 Z");
  part(ctx, hood, { base: CLOAK[0], shade: CLOAK[1], dx: 2.6, dy: 2, hi: [36, 18, 16], light: 0.25 });
  folds(ctx, ["M 51 6 Q 48 14 49 21", "M 30 30 Q 27 40 28 50", "M 70 30 Q 73 40 72 50"], "#332d2c", 1);
  // Oeffnung: helle Innenkante, dunkles Inneres
  const opening = ell(50.5, 43, 18, 16.5);
  fill(ctx, opening, "#2a2423");
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#7d7470";
  ctx.stroke(opening);
  const faceShape = ell(50.5, 46, 15, 13);
  part(ctx, faceShape, { base: "#ecc6a6", shade: "#c99b7c", dx: 2, dy: 1.6, hi: [46, 48, 10], light: 0.2 });
  // Schatten der Kapuze auf der Stirn
  within(ctx, faceShape, () => fill(ctx, ell(50.5, 34, 20, 8.6), "rgba(50,38,40,0.55)"));
  // Innere Kante der Kapuze nochmals konturieren
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#2a201b";
  ctx.stroke(ell(50.5, 43, 19.2, 17.7));

  eyes(ctx, 51, 45, 7, { blank: true, w: 4.4, h: 4.4, brow: 2.4 });
  line(ctx, "M 52 48.4 Q 53.6 50.4 51.6 51.2", 0.9, "#a5735a");
  mouth(ctx, 51.5, 54.4, "frown", 2.8);
}

// --- Elfe ------------------------------------------------------------------------------

const ELF_SKIN: Pair = ["#cfd39b", "#a8ad72"];
const ELF_GREEN: Pair = ["#7d9a57", "#5a733e"];
const ELF_HAIR: Pair = ["#a1b47f", "#7b8f5c"];

function drawElfe(ctx: Ctx): void {
  // Koecher auf dem Ruecken, Pfeile ragen ueber die Schulter.
  for (const [x, c] of [[66, "#e8e2cf"], [70, "#9fb27c"], [74, "#e8e2cf"]] as const) {
    line(ctx, `M ${x + 2} 58 L ${x - 1} 42`, 1.2, "#5d4030");
    part(ctx, P(`M ${x - 1} 42 L ${x - 3.4} 37 L ${x - 0.6} 38.4 L ${x + 1.4} 36.6 L ${x + 0.8} 42 Z`), { base: c, line: 0.9 });
  }
  part(ctx, P("M 62 52 L 72 47 L 81 70 L 72 75 Z"), { base: "#7a5236", shade: "#583925", dx: 1, dy: 1, line: 1.2 });
  line(ctx, "M 64 56 L 74 51", 0.9, "#4a2f1e");
  // Umhang hinten
  part(ctx, P("M 33 56 Q 24 75 27 91 L 73 91 Q 76 75 67 56 Z"), { base: ELF_GREEN[0], shade: ELF_GREEN[1], dx: 1.4, dy: 1 });

  body(ctx, {
    tunic: ["#86a05e", "#627b44"],
    sleeve: ["#86a05e", "#627b44"],
    hand: ELF_SKIN,
    pants: ["#6a4b33", "#4c3422"],
    boots: ["#5d4030", "#40291c"],
    belt: ["#6b4428", "#4e2f1a", "#c99a45"],
    beltY: 72,
    cuff: ["#7a5236", "#583925"],
    // Riemen des Koechers quer ueber die Brust
    over: () => part(ctx, P("M 37 59.5 L 40.5 58 L 65 79 L 61 80.5 Z"), { base: "#6b4428", shade: "#4e2f1a", dx: 0.4, dy: 0.6, line: 1 }),
  });

  // Kapuzenkragen ueber den Schultern
  part(ctx, P("M 30 55 Q 50 68 70 55 Q 75 63 68 67.5 Q 50 74 32 67.5 Q 25 63 30 55 Z"), { base: ELF_GREEN[0], shade: ELF_GREEN[1], dx: 1, dy: 1.4 });

  // Spitze Ohren weit zur Seite
  for (const side of [-1, 1] as const) {
    const ear = P(
      `M ${50 + side * 18} 41 Q ${50 + side * 30} 35 ${50 + side * 40} 31 ` +
        `Q ${50 + side * 35} 41 ${50 + side * 28} 47 Q ${50 + side * 23} 50.5 ${50 + side * 18} 49 Z`,
    );
    part(ctx, ear, { base: ELF_SKIN[0], shade: ELF_SKIN[1], dx: side * -0.8, dy: 1.2 });
    line(ctx, `M ${50 + side * 22} 44.5 Q ${50 + side * 29} 40 ${50 + side * 35} 35.5`, 0.9, "#8f945e");
  }

  const faceShape = ell(50, 42, 19.5, 17.5);
  part(ctx, faceShape, { base: ELF_SKIN[0], shade: ELF_SKIN[1], dx: 2.4, dy: 2.2, hi: [43, 40, 13], light: 0.22 });
  foreheadShadow(ctx, faceShape, "M 28 26 L 72 26 L 72 38 Q 50 34 28 38 Z", "rgba(90,100,50,0.35)");
  blush(ctx, 51, 50.5, 12, "rgba(210,120,90,0.25)");

  // Haar unter der Kapuze, Pony zur Seite gekaemmt
  const bangs = P("M 30.5 42 Q 30 28 50 26 Q 69 27 70 40 Q 66 34.5 60 33.5 L 57 38 Q 54 33.5 48 33.6 Q 42 34.4 37.5 39.6 L 36 35.5 Q 33 38 30.5 42 Z");
  part(ctx, bangs, { base: ELF_HAIR[0], shade: ELF_HAIR[1], dx: 0.8, dy: 1.4 });
  // Kapuze
  const hood = P("M 25.5 52 Q 20 22 50 13 Q 80 22 74.5 52 Q 72.5 45 70.6 40 Q 68 26 50 24.4 Q 32 26 29.4 40 Q 27.5 45 25.5 52 Z");
  part(ctx, hood, { base: ELF_GREEN[0], shade: ELF_GREEN[1], dx: 2, dy: 2, hi: [38, 20, 14], light: 0.28 });
  // Kapuzenzipfel nach hinten
  part(ctx, P("M 46 14 Q 38 8 28 9 Q 36 12 40 17 Z"), { base: ELF_GREEN[0], shade: ELF_GREEN[1], dx: 0.6, dy: 0.8, line: 1.1 });
  folds(ctx, ["M 42 17 Q 40 21 40.6 25", "M 63 18 Q 66 22 67 27"], "#4a6034", 0.9);

  eyes(ctx, 51.5, 45, 8.4, { w: 4.2, h: 5.4, lookX: 1.1, brow: 1.9, browLift: 2.2 });
  line(ctx, "M 53.2 48.4 Q 54.2 49.9 52.8 50.6", 0.9, "#8f945e");
  mouth(ctx, 52, 53.6, "frown", 3);
}

// --- Zwerg -----------------------------------------------------------------------------

const BEARD: Pair = ["#b9632e", "#8a4519"];

function drawZwerg(ctx: Ctx): void {
  body(ctx, {
    tunic: MAIL,
    sleeve: MAIL,
    hand: ["#7a4e30", "#57351f"],
    pants: ["#6a4630", "#4a2f1e"],
    boots: ["#5c3a26", "#3f2617"],
    belt: ["#6b4428", "#4e2f1a", "#d8a83f"],
    beltY: 74,
    stout: true,
  });
  // Lederwams ueber dem Kettenhemd
  part(ctx, P("M 36 60 Q 50 66 64 60 L 67 74 Q 50 78 33 74 Z"), { base: "#7a5236", shade: "#583925", dx: 1.4, dy: 1, line: 1.15 });
  line(ctx, "M 50 64 L 50 75", 0.9, "#4a2f1e");
  // Schulterpolster
  part(ctx, P("M 22 67 Q 21 58 31 56.5 Q 38 57 38.5 61 Q 33 61.5 29.5 65.5 Q 26 69.5 22 67 Z"), { base: STEEL[0], shade: STEEL[1], dx: 1, dy: 1.4, hi: [28, 59, 6] });
  part(ctx, P("M 78 67 Q 79 58 69 56.5 Q 62 57 61.5 61 Q 67 61.5 70.5 65.5 Q 74 69.5 78 67 Z"), { base: STEEL[0], shade: STEEL[1], dx: 1.2, dy: 1.4, hi: [68, 59, 6] });

  const faceShape = ell(50, 41.5, 21, 17.5);
  face(ctx, 50, 41.5, 21, 17.5, ["#f2bf9a", "#d69a77"]);
  foreheadShadow(ctx, faceShape, "M 28 28 L 72 28 L 72 39 Q 50 35 28 39 Z");
  blush(ctx, 51, 48.5, 13.5, "rgba(232,112,96,0.4)");

  // Vollbart
  const beard = P("M 28 43 Q 25 58 31.5 68 Q 39 77.5 50.5 78.5 Q 62 77.5 69 68 Q 75.5 58 72.5 43 Q 69 51 62.5 54 Q 56.5 56.5 50.5 56.5 Q 44.5 56.5 38.5 54 Q 32 51 28 43 Z");
  part(ctx, beard, { base: BEARD[0], shade: BEARD[1], dx: 2.4, dy: 2, hi: [40, 60, 12], light: 0.25 });
  folds(ctx, ["M 36 60 Q 37 66 40 70", "M 44 62 Q 44 69 46 74", "M 57 62 Q 57 69 55 74", "M 64 60 Q 64 66 61 70"], "#7a3a14", 0.9);
  mouth(ctx, 51, 59, "grin", 5);
  // Schnurrbart in zwei Locken
  for (const side of [-1, 1] as const) {
    const m = P(
      `M ${51} 53.5 Q ${51 + side * 8} 50 ${51 + side * 15} 54 ` +
        `Q ${51 + side * 17} 58 ${51 + side * 13.5} 59 Q ${51 + side * 7} 57 ${51} 57.5 Z`,
    );
    part(ctx, m, { base: "#c46c33", shade: BEARD[1], dx: side * -0.6, dy: 1.2, line: 1.15 });
  }
  // Knollennase
  part(ctx, ell(51.5, 50, 4.6, 3.9), { base: "#eb9b7d", shade: "#c8735a", dx: 1, dy: 1, hi: [50, 48.4, 2.6], light: 0.6 });
  happyEyes(ctx, 51, 44.5, 8.8, 4.2);
  // Buschige Brauen
  brow(ctx, 42.2, 38.6, -1, -0.6, 5, "#8a4519");
  brow(ctx, 59.8, 38.6, 1, -0.6, 5, "#8a4519");

  // Rundhelm mit Rippen und Nieten
  const helmet = P("M 27 40 Q 25.5 13.5 50.5 12 Q 75.5 13.5 74 40 Q 50.5 34 27 40 Z");
  part(ctx, helmet, { base: STEEL[0], shade: STEEL[1], dx: 2.4, dy: 2, hi: [38, 20, 15], light: 0.45 });
  folds(ctx, ["M 40.5 15 Q 37 24 37.4 33.5", "M 50.5 12.4 L 50.5 32", "M 60.5 15 Q 64 24 63.6 33.5"], "#5f6368", 1.1);
  const band = P("M 26 33.5 Q 50.5 27.5 75 33.5 L 75.4 40.5 Q 50.5 34.5 25.6 40.5 Z");
  part(ctx, band, { base: STEEL_DARK[0], shade: STEEL_DARK[1], dx: 0.5, dy: 1.2, line: 1.2 });
  for (const x of [31, 40.5, 50.5, 60.5, 70]) {
    const y = 36.2 - (12 - Math.abs(x - 50.5)) * 0.08;
    part(ctx, ell(x, y, 1.3, 1.3), { base: "#c2c5c8", shade: "#7d8186", dx: 0.3, dy: 0.3, line: 0.75 });
  }
  gloss(ctx, 36, 20, 4.2, 2.1, 0.45);
}

// --- Zauberer --------------------------------------------------------------------------

const WIZ_BLUE: Pair = ["#4f6592", "#37496f"];
const WIZ_BEARD: Pair = ["#5a6890", "#3e4a6c"];

function orb(ctx: Ctx, x: number, y: number): void {
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 13);
  glow.addColorStop(0, "rgba(190,235,255,0.55)");
  glow.addColorStop(1, "rgba(160,215,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 13, y - 13, 26, 26);
  part(ctx, ell(x, y, 6, 6), { base: "#c9ebf7", shade: "#86bcd6", dx: -1.2, dy: -1.4, line: 1.1 });
  gloss(ctx, x - 2, y - 2.4, 1.8, 1.1, 0.95);
  fill(ctx, ell(x - 4, y - 9, 0.9, 0.9), "#c9ebf7");
  fill(ctx, ell(x + 6, y - 7, 0.7, 0.7), "#c9ebf7");
}

const ZAUBERER_BODY: BodyStyle = {
  tunic: WIZ_BLUE,
  sleeve: WIZ_BLUE,
  hand: SKIN,
  pants: ["#3e4a6c", "#2c3650"],
  boots: ["#5c3a26", "#3f2617"],
  belt: ["#7a4e2e", "#57351f", "#c99a45"],
  beltY: 75,
  robe: true,
  cuff: ["#8a5a36", "#634024"],
  left: null,
};

function drawZauberer(ctx: Ctx): void {
  body(ctx, ZAUBERER_BODY);
  folds(ctx, ["M 40 81 Q 39 87 37.5 92", "M 60 81 Q 61 87 62.5 92", "M 50 81 L 50 93"], "#2c3a5a", 1);

  const faceShape = ell(50, 41.5, 20, 17);
  face(ctx, 50, 41.5, 20, 17);
  foreheadShadow(ctx, faceShape, "M 28 26 L 72 26 L 72 37 Q 50 32 28 37 Z");

  // Langer Bart bis auf die Brust
  const beard = P("M 29 44 Q 26 60 34 71 Q 42 79 51 77.5 Q 61 77.5 67.5 69 Q 74.5 59 71.5 44 Q 67 51.5 59 53.5 Q 51 55.5 43 53.5 Q 34 51.5 29 44 Z");
  part(ctx, beard, { base: WIZ_BEARD[0], shade: WIZ_BEARD[1], dx: 2.4, dy: 2, hi: [40, 58, 12], light: 0.22 });
  folds(ctx, ["M 36 58 Q 37 65 41 70", "M 45 60 Q 45 68 47 74", "M 56 60 Q 56 68 54 74", "M 64 57 Q 64 64 61 69"], "#2f3a58", 0.9);
  for (const side of [-1, 1] as const) {
    const m = P(
      `M 51.5 51 Q ${51.5 + side * 8} 48 ${51.5 + side * 14} 52.4 ` +
        `Q ${51.5 + side * 15} 56.5 ${51.5 + side * 11} 57 Q ${51.5 + side * 6} 55 51.5 55.6 Z`,
    );
    part(ctx, m, { base: "#66749c", shade: WIZ_BEARD[1], dx: side * -0.6, dy: 1.2, line: 1.15 });
  }
  part(ctx, ell(52.5, 48.6, 3.2, 2.7), { base: SKIN[0], shade: SKIN[1], dx: 0.8, dy: 0.8, line: 1 });
  eyes(ctx, 51.5, 43.5, 8.2, { w: 3.8, h: 4.8, lookX: 0.9, pupil: 0.72 });
  // Buschige, zornige Brauen
  brow(ctx, 43.3, 37.4, -1, 2, 5, "#3e4a6c");
  brow(ctx, 59.7, 37.4, 1, 2, 5, "#3e4a6c");

  // Spitzhut mit Lederband, die Spitze faellt nach rechts
  const brim = P("M 9 33.5 Q 28 21.5 51 20.5 Q 77 20.5 93 30 Q 95 35 87.5 35.5 Q 71 30 51 29.8 Q 29 30.8 15 38.6 Q 7 38.6 9 33.5 Z");
  part(ctx, brim, { base: WIZ_BLUE[0], shade: WIZ_BLUE[1], dx: 1.2, dy: 2.2, hi: [30, 24, 14], light: 0.25 });
  const cone = P("M 29.5 27.5 Q 31 12 45 6 Q 55 2 64.5 4 Q 74 6 83.5 2.6 Q 82 9.5 74.5 12 Q 69 15 70.5 27 Q 50 21.5 29.5 27.5 Z");
  part(ctx, cone, { base: WIZ_BLUE[0], shade: WIZ_BLUE[1], dx: 2.6, dy: 1.6, hi: [40, 14, 12], light: 0.28 });
  part(ctx, P("M 30 24.6 Q 50 19 70.2 24 L 70.4 29 Q 50 23.4 29.6 29.4 Z"), { base: "#8a5a36", shade: "#634024", dx: 0.4, dy: 0.8, line: 1.1 });
  folds(ctx, ["M 47 9 Q 43 15 44 21"], "#2c3a5a", 0.9);

  // Erhobene Hand mit leuchtender Kugel
  drawArm(ctx, [38, 60, 27, 71, 19.5, 65], -1, ZAUBERER_BODY);
  orb(ctx, 18.5, 56.5);
}

export function drawHero(ctx: Ctx, id: CharacterId): void {
  switch (id) {
    case "ritter":
      drawRitter(ctx);
      break;
    case "magierin":
      drawMagierin(ctx);
      break;
    case "schurke":
      drawSchurke(ctx);
      break;
    case "elfe":
      drawElfe(ctx);
      break;
    case "zwerg":
      drawZwerg(ctx);
      break;
    case "zauberer":
      drawZauberer(ctx);
      break;
  }
}
