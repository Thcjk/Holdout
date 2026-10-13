/**
 * Die neun Monster - nach der Vorlage (Chibi-Monster-Bogen) gezeichnet.
 *
 * Monsteraugen sind weiss, ohne Pupille und oben schraeg abgeschnitten (boese);
 * die Muender weit offen mit Fangzaehnen. Raster wie bei den Helden: 100 x 100,
 * Fuesse bei y = 96. Wie gross ein Monster im Spiel ist, bestimmt sein Radius.
 */

import type { EnemyType } from "../../game/types";
import {
  belt,
  claw,
  type Ctx,
  ell,
  eyes,
  fill,
  fist,
  folds,
  gloss,
  line,
  LINE,
  mouth,
  P,
  part,
  rect,
  squintEyes,
  tube,
  within,
} from "./kit";

type Pair = readonly [string, string];

// --- Bausteine -----------------------------------------------------------------------

/** Nackter Fuss mit drei Zehen; `dir` = Richtung der Zehen. */
function foot(ctx: Ctx, x: number, y: number, skin: Pair, dir: -1 | 1, size = 6): void {
  const s = size;
  const shape = P(
    `M ${x - dir * s * 0.7} ${y - s * 0.9} Q ${x + dir * s * 0.2} ${y - s * 1.1} ${x + dir * s * 0.7} ${y - s * 0.5} ` +
      `Q ${x + dir * s * 1.25} ${y - s * 0.4} ${x + dir * s * 1.2} ${y} L ${x - dir * s * 0.8} ${y} ` +
      `Q ${x - dir * s * 1.05} ${y - s * 0.5} ${x - dir * s * 0.7} ${y - s * 0.9} Z`,
  );
  part(ctx, shape, { base: skin[0], shade: skin[1], dx: dir * -0.6, dy: 1 });
  for (const k of [0.15, 0.6]) {
    line(ctx, `M ${x + dir * s * k} ${y} L ${x + dir * s * (k + 0.05)} ${y - s * 0.35}`, 0.8);
  }
}

/** Spitzes Ohr zur Seite; `len` = wie weit es absteht. */
function pointyEar(ctx: Ctx, side: -1 | 1, cx: number, cy: number, len: number, skin: Pair, rise = 8): void {
  const x0 = cx + side * 1;
  const tip = cx + side * len;
  const ear = P(
    `M ${x0} ${cy - 5} Q ${cx + side * len * 0.55} ${cy - rise * 0.8} ${tip} ${cy - rise} ` +
      `Q ${cx + side * len * 0.8} ${cy + 1} ${cx + side * len * 0.45} ${cy + 6} Q ${cx + side * len * 0.2} ${cy + 8} ${x0} ${cy + 6} Z`,
  );
  part(ctx, ear, { base: skin[0], shade: skin[1], dx: side * -0.8, dy: 1.2 });
  fill(ctx, P(`M ${cx + side * len * 0.2} ${cy - 1} Q ${cx + side * len * 0.55} ${cy - rise * 0.5} ${cx + side * len * 0.8} ${cy - rise * 0.75} Q ${cx + side * len * 0.55} ${cy + 1} ${cx + side * len * 0.3} ${cy + 4} Z`), "rgba(60,30,30,0.22)");
}

/** Zerfranster Lendenschurz. */
function loincloth(ctx: Ctx, y: number, left: number, right: number, color: Pair, depth = 9): void {
  const n = 6;
  let d = `M ${left} ${y} L ${right} ${y} `;
  for (let i = 0; i <= n; i += 1) {
    const x = right - ((right - left) * i) / n;
    const down = i % 2 === 0 ? depth : depth - 3.4;
    d += `L ${x} ${y + down} `;
  }
  d += "Z";
  part(ctx, P(d), { base: color[0], shade: color[1], dx: 0.8, dy: 1.4 });
}

/** Schwanz mit Pfeilspitze (Teufel, Fledermaus). */
function devilTail(ctx: Ctx, d: string, tipX: number, tipY: number, skin: Pair, angle = 0): void {
  tube(ctx, d, 3.2, skin[0], skin[1], 1.1);
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);
  part(ctx, P("M 0 -5 L 4.6 2.6 L 0 0.8 L -4.6 2.6 Z"), { base: skin[0], shade: skin[1], dx: 0.4, dy: 0.8, line: 1.1 });
  ctx.restore();
}

/** Fledermausfluegel; `side` = -1 links, 1 rechts. */
function batWing(ctx: Ctx, side: -1 | 1, color: Pair, span = 42, top = 22): void {
  const m = (x: number): number => 50 + side * x;
  const wing = P(
    `M ${m(10)} ${top + 34} Q ${m(span * 0.45)} ${top + 4} ${m(span)} ${top} ` +
      `Q ${m(span - 1)} ${top + 12} ${m(span - 4)} ${top + 22} ` +
      `Q ${m(span * 0.82)} ${top + 18} ${m(span * 0.72)} ${top + 26} ` +
      `Q ${m(span * 0.6)} ${top + 22} ${m(span * 0.5)} ${top + 31} ` +
      `Q ${m(span * 0.38)} ${top + 28} ${m(span * 0.3)} ${top + 38} Z`,
  );
  part(ctx, wing, { base: color[0], shade: color[1], dx: side * 1.4, dy: 1.6 });
  // Knochen
  for (const [tx, ty] of [[span - 4, top + 22], [span * 0.72, top + 26], [span * 0.5, top + 31]] as const) {
    line(ctx, `M ${m(span * 0.42)} ${top + 9} Q ${m((tx + span * 0.42) / 2)} ${(ty + top + 9) / 2 - 2} ${m(tx)} ${ty}`, 0.9, "rgba(25,18,25,0.75)");
  }
  line(ctx, `M ${m(12)} ${top + 30} Q ${m(span * 0.4)} ${top + 6} ${m(span)} ${top}`, 1.3);
}

/** Nackter Oberkoerper mit angedeuteter Brust und Bauch. */
function bareTorso(ctx: Ctx, d: string, skin: Pair, chest = true): Path2D {
  const torso = P(d);
  part(ctx, torso, { base: skin[0], shade: skin[1], dx: 2.4, dy: 1.8 });
  within(ctx, torso, () => fill(ctx, ell(50, 55, 17, 6), "rgba(30,20,20,0.25)"));
  if (chest) {
    folds(ctx, ["M 42 62 Q 46 64.5 49.5 63", "M 58 62 Q 54 64.5 50.5 63", "M 47 69 Q 50 70 53 69", "M 47.6 73 Q 50 74 52.4 73"], "rgba(42,32,27,0.55)", 0.8);
  }
  return torso;
}

function head(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, skin: Pair): Path2D {
  const shape = ell(cx, cy, rx, ry);
  part(ctx, shape, { base: skin[0], shade: skin[1], dx: 2.6, dy: 2.4, hi: [cx - rx * 0.4, cy - ry * 0.45, rx * 0.8], light: 0.25 });
  return shape;
}

/** Dicke Stirnfalten ueber der Nase (boeser Blick). */
function scowl(ctx: Ctx, cx: number, cy: number, color = "rgba(42,32,27,0.6)"): void {
  line(ctx, `M ${cx - 2.6} ${cy} Q ${cx} ${cy + 1.4} ${cx + 2.6} ${cy}`, 0.8, color);
  line(ctx, `M ${cx - 1.6} ${cy - 2.4} Q ${cx} ${cy - 1.4} ${cx + 1.6} ${cy - 2.4}`, 0.7, color);
}

// --- Goblin --------------------------------------------------------------------------

const GOBLIN: Pair = ["#6f8b45", "#536a31"];
const LEATHER: Pair = ["#6e4b2e", "#4f331d"];

function drawGoblin(ctx: Ctx): void {
  tube(ctx, "M 45 77 L 43 88", 8, GOBLIN[0], GOBLIN[1]);
  tube(ctx, "M 55 77 L 57 88", 8, GOBLIN[0], GOBLIN[1]);
  foot(ctx, 41.5, 95, GOBLIN, -1, 6.4);
  foot(ctx, 58.5, 95, GOBLIN, 1, 6.4);
  bareTorso(ctx, "M 39 56 Q 50 53 61 56 Q 65 68 63.5 80 Q 50 83 36.5 80 Q 35 68 39 56 Z", GOBLIN, false);
  // Offene Lederweste
  part(ctx, P("M 39 56.5 Q 45 55.5 47 58 L 46.4 78.5 Q 40.5 79.5 36.6 78.4 Q 35.4 67 39 56.5 Z"), { base: LEATHER[0], shade: LEATHER[1], dx: 1, dy: 1 });
  part(ctx, P("M 61 56.5 Q 55 55.5 53 58 L 53.6 78.5 Q 59.5 79.5 63.4 78.4 Q 64.6 67 61 56.5 Z"), { base: LEATHER[0], shade: LEATHER[1], dx: 1, dy: 1 });
  belt(ctx, 74.5, 37, 63, "#5a3a22", "#3f2716", "#b8913f", 1.6);
  loincloth(ctx, 79.5, 38.5, 61.5, ["#7b5634", "#5a3c22"], 8);
  // Linker Arm greift, rechter macht eine Faust
  tube(ctx, "M 40 59 Q 30 63 23.5 64.5", 8, GOBLIN[0], GOBLIN[1]);
  claw(ctx, 20.5, 66, GOBLIN[0], GOBLIN[1], -1, 5.4);
  tube(ctx, "M 60 59 Q 69 64 70.5 72", 8, GOBLIN[0], GOBLIN[1]);
  fist(ctx, 71, 75, GOBLIN[0], GOBLIN[1], -1, 5.2);
  part(ctx, rect(66.4, 66.4, 8.6, 4.4, 1.2), { base: LEATHER[0], shade: LEATHER[1], dx: 0.4, dy: 0.6, line: 1 });

  pointyEar(ctx, -1, 31, 36, 21, GOBLIN, 12);
  pointyEar(ctx, 1, 69, 36, 21, GOBLIN, 12);
  head(ctx, 50, 37, 20.5, 18, GOBLIN);
  squintEyes(ctx, 50, 37.5, 8.6, 4.4);
  line(ctx, "M 35.5 30 Q 41 30.5 46 33.5", 1.8);
  line(ctx, "M 64.5 30 Q 59 30.5 54 33.5", 1.8);
  scowl(ctx, 50, 31.5);
  line(ctx, "M 49 40.4 Q 50.6 42.2 52 40.8", 0.9, "#3f5426");
  mouth(ctx, 50, 46.5, "wail", 8);
}

// --- Fledermaus (kleiner Nachtgeist mit Fluegeln) -----------------------------------

const BAT: Pair = ["#4a4651", "#2f2c35"];

function drawFledermaus(ctx: Ctx): void {
  batWing(ctx, -1, BAT, 47, 20);
  batWing(ctx, 1, BAT, 47, 20);
  devilTail(ctx, "M 58 80 Q 70 88 78 84", 80, 82.5, BAT, 1.2);
  tube(ctx, "M 45 78 L 43 87", 7.4, BAT[0], BAT[1]);
  tube(ctx, "M 55 78 L 57 87", 7.4, BAT[0], BAT[1]);
  foot(ctx, 41.5, 94, BAT, -1, 6);
  foot(ctx, 58.5, 94, BAT, 1, 6);
  bareTorso(ctx, "M 39.5 57 Q 50 54 60.5 57 Q 65 70 61 81 Q 50 84 39 81 Q 35 70 39.5 57 Z", BAT);
  tube(ctx, "M 40 60 Q 31 65 27 71", 7.4, BAT[0], BAT[1]);
  claw(ctx, 25, 73.5, BAT[0], BAT[1], -1, 5);
  tube(ctx, "M 60 60 Q 69 64 72 70", 7.4, BAT[0], BAT[1]);
  claw(ctx, 74, 72.5, BAT[0], BAT[1], 1, 5);

  // Kleine Spitzohren oben am Kopf
  part(ctx, P("M 34 34 L 31 16 L 44 27 Z"), { base: BAT[0], shade: BAT[1], dx: 0.6, dy: 1 });
  part(ctx, P("M 66 34 L 69 16 L 56 27 Z"), { base: BAT[0], shade: BAT[1], dx: 0.6, dy: 1 });
  head(ctx, 50, 40, 19, 17, BAT);
  eyes(ctx, 50, 39, 7.6, { blank: true, w: 5, h: 5, brow: 3 });
  mouth(ctx, 50, 48, "roar", 6.5);
}

// --- Teufelchen --------------------------------------------------------------------

const DEVIL: Pair = ["#c04b3b", "#8c3027"];
const HORN: Pair = ["#4d3c35", "#2f2420"];

function horn(ctx: Ctx, side: -1 | 1): void {
  const m = (x: number): number => 50 + side * x;
  const shape = P(`M ${m(9)} 27 Q ${m(19)} 21 ${m(17)} 8 Q ${m(25)} 15 ${m(21)} 27.5 Q ${m(17)} 32 ${m(13)} 31.5 Z`);
  part(ctx, shape, { base: HORN[0], shade: HORN[1], dx: side * -0.8, dy: 1 });
  line(ctx, `M ${m(13.6)} 24.5 Q ${m(17)} 23.5 ${m(19.4)} 21`, 0.8, "rgba(20,14,12,0.8)");
  line(ctx, `M ${m(14.6)} 19.4 Q ${m(17)} 18.4 ${m(18.8)} 16`, 0.8, "rgba(20,14,12,0.8)");
}

function drawTeufelchen(ctx: Ctx): void {
  devilTail(ctx, "M 58 80 Q 72 92 82 86 Q 88 82 86 76", 86, 75.4, DEVIL, -0.3);
  tube(ctx, "M 45 77 L 42.5 88", 8.2, DEVIL[0], DEVIL[1]);
  tube(ctx, "M 55 77 L 57.5 88", 8.2, DEVIL[0], DEVIL[1]);
  foot(ctx, 41, 95, ["#7e2e24", "#5c1f18"], -1, 6.4);
  foot(ctx, 59, 95, ["#7e2e24", "#5c1f18"], 1, 6.4);
  bareTorso(ctx, "M 38.5 56 Q 50 53 61.5 56 Q 66 68 63.5 80 Q 50 83 36.5 80 Q 34 68 38.5 56 Z", DEVIL);
  loincloth(ctx, 77.5, 37, 63, ["#3a2c28", "#231a17"], 10);
  // Beide Krallen hoch
  tube(ctx, "M 39.5 59 Q 28 65 24.5 58", 8, DEVIL[0], DEVIL[1]);
  claw(ctx, 23, 55.5, DEVIL[0], DEVIL[1], -1, 5.4);
  tube(ctx, "M 60.5 59 Q 72 65 75.5 58", 8, DEVIL[0], DEVIL[1]);
  claw(ctx, 77, 55.5, DEVIL[0], DEVIL[1], 1, 5.4);

  horn(ctx, -1);
  horn(ctx, 1);
  pointyEar(ctx, -1, 31.5, 39, 13, DEVIL, 5);
  pointyEar(ctx, 1, 68.5, 39, 13, DEVIL, 5);
  head(ctx, 50, 38.5, 20, 17.5, DEVIL);
  eyes(ctx, 50, 37.5, 8, { blank: true, w: 5.2, h: 5.4, brow: 3.4 });
  scowl(ctx, 50, 30.5);
  mouth(ctx, 50, 47, "roar", 8);
}

// --- Schleim ----------------------------------------------------------------------------

const SLIME: Pair = ["#a6c250", "#7c9933"];

function drawSchleim(ctx: Ctx): void {
  const blob = P(
    "M 20 94 Q 11 94 13 86 Q 16 79 21 75 Q 21 50 29 34 Q 37 18 50 18 Q 63 18 71 34 Q 79 50 79 75 Q 84 79 87 86 Q 89 94 80 94 " +
      "Q 74 96 68 93 Q 62 96 56 93.5 Q 50 96.5 44 93.5 Q 38 96 32 93 Q 26 96 20 94 Z",
  );
  part(ctx, blob, { base: SLIME[0], shade: SLIME[1], dx: 3.2, dy: 2.4, hi: [38, 34, 20], light: 0.45 });
  // Schleimfaeden an den Seiten (nur Schattenlinien, keine eigene Kontur)
  folds(ctx, ["M 24 60 Q 22.5 68 24 74", "M 75.5 56 Q 77.5 64 76 72", "M 30 82 Q 30 86 31.5 89"], "#6a8a2a", 1.4);
  gloss(ctx, 36, 30, 5, 2.6, 0.55);
  gloss(ctx, 31, 40, 1.8, 1.4, 0.5);
  gloss(ctx, 66, 74, 3, 1.6, 0.3);
  eyes(ctx, 50.5, 47, 9.6, { sleepy: true, w: 5, h: 4.4, lid: SLIME[0] });
  // Missmutiger Mund
  const lip = P("M 41 60 Q 50 52.5 59 60 Q 59.5 63.5 56 62.5 Q 50 59.5 44 62.5 Q 40.5 63.5 41 60 Z");
  part(ctx, lip, { base: "#4f6a22", shade: "#3a521a", dx: 0.4, dy: 0.6, line: 1.2 });
}

// --- Oger -----------------------------------------------------------------------------

const OGRE: Pair = ["#9c613b", "#72452a"];
const FUR: Pair = ["#6e4628", "#4d2f1a"];

function drawOger(ctx: Ctx): void {
  tube(ctx, "M 42.5 78 L 40 87.5", 11, OGRE[0], OGRE[1]);
  tube(ctx, "M 57.5 78 L 60 87.5", 11, OGRE[0], OGRE[1]);
  foot(ctx, 38.5, 95.5, OGRE, -1, 8);
  foot(ctx, 61.5, 95.5, OGRE, 1, 8);
  bareTorso(ctx, "M 31 54 Q 50 48 69 54 Q 77 66 72 81 Q 50 87 28 81 Q 23 66 31 54 Z", OGRE);
  folds(ctx, ["M 36 62 Q 42 66 48 63", "M 64 62 Q 58 66 52 63"], "rgba(42,32,27,0.6)", 0.9);
  // Lendenschurz mit Herzschnalle
  loincloth(ctx, 76, 31, 69, FUR, 11);
  part(ctx, P("M 30 74 Q 50 79 70 74 L 70.5 79 Q 50 84 29.5 79 Z"), { base: "#5a3820", shade: "#3f2615", dx: 0.4, dy: 1, line: 1.1 });
  part(ctx, P("M 50 84 L 45.6 79.4 Q 44.6 76 47.4 75.6 Q 49.4 75.4 50 77.4 Q 50.6 75.4 52.6 75.6 Q 55.4 76 54.4 79.4 Z"), { base: "#8f6a3a", shade: "#6a4b26", dx: 0.4, dy: 0.6, line: 1 });
  // Dicke Arme mit Faeusten
  tube(ctx, "M 32 57 Q 22 64 21 75", 12, OGRE[0], OGRE[1]);
  tube(ctx, "M 68 57 Q 78 64 79 75", 12, OGRE[0], OGRE[1]);
  fist(ctx, 21, 79, OGRE[0], OGRE[1], 1, 7);
  fist(ctx, 79, 79, OGRE[0], OGRE[1], -1, 7);
  // Fellkragen
  const fur = P("M 26 56 Q 30 47 40 49 Q 50 44 60 49 Q 70 47 74 56 Q 71 60 67 58 Q 64 62 59.5 58.5 Q 55 62 50 58.5 Q 45 62 40.5 58.5 Q 36 62 33 58 Q 29 60 26 56 Z");
  part(ctx, fur, { base: FUR[0], shade: FUR[1], dx: 1, dy: 1.6 });

  pointyEar(ctx, -1, 33, 34, 13, OGRE, 7);
  pointyEar(ctx, 1, 67, 34, 13, OGRE, 7);
  head(ctx, 50, 34.5, 18.5, 16.5, OGRE);
  // Haarbueschel
  part(ctx, P("M 44 21 Q 44 11 53 8 Q 51 13 57 15 Q 53 17 56.5 21 Q 50 19 44 21 Z"), { base: "#7a4a2a", shade: "#56321b", dx: 0.6, dy: 0.8, line: 1.1 });
  // Wulstige Brauen
  part(ctx, P("M 36 28 Q 43 26 49 31 L 48 33 Q 42 30 37 31.4 Z"), { base: OGRE[1], line: 1 });
  part(ctx, P("M 64 28 Q 57 26 51 31 L 52 33 Q 58 30 63 31.4 Z"), { base: OGRE[1], line: 1 });
  eyes(ctx, 50, 35, 7.4, { blank: true, w: 4.2, h: 4.2, brow: 2.4 });
  part(ctx, ell(50.5, 39.6, 3.2, 2.4), { base: OGRE[0], shade: OGRE[1], dx: 0.6, dy: 0.6, line: 1 });
  mouth(ctx, 50, 44, "roar", 8.6);
}

// --- Skelettritter (Elite) ----------------------------------------------------------

const BONE: Pair = ["#e5d6b2", "#bfac86"];
const IRON: Pair = ["#5c5b60", "#3c3b40"];

function shortSword(ctx: Ctx, x: number, y: number): void {
  part(ctx, P(`M ${x - 2.4} ${y - 2} L ${x - 2.4} ${y - 30} L ${x} ${y - 35} L ${x + 2.4} ${y - 30} L ${x + 2.4} ${y - 2} Z`), { base: "#c3c6ca", shade: "#868a90", dx: -0.6, dy: 0, line: 1.15 });
  line(ctx, `M ${x} ${y - 4} L ${x} ${y - 31}`, 0.7, "rgba(42,32,27,0.45)");
  part(ctx, rect(x - 6.4, y - 2.6, 12.8, 3, 1), { base: "#7a5236", shade: "#583925", dx: 0.3, dy: 0.6, line: 1.05 });
  part(ctx, rect(x - 1.5, y, 3, 8, 1), { base: "#5e3b22", line: 1 });
  part(ctx, ell(x, y + 9, 2.2, 2.2), { base: "#7a5236", line: 1 });
}

function drawSkelettritter(ctx: Ctx): void {
  tube(ctx, "M 44 79 L 42.5 89", 8.6, IRON[0], IRON[1]);
  tube(ctx, "M 56 79 L 57.5 89", 8.6, IRON[0], IRON[1]);
  part(ctx, P("M 34 89.5 Q 34 86.5 38 86.5 L 46.5 86.5 Q 48.5 86.5 48.5 89.5 L 48.5 96 L 33 96 Q 31 96 31 93.5 Z"), { base: "#4a3a30", shade: "#30251e", dx: 0.6, dy: 1 });
  part(ctx, P("M 66 89.5 Q 66 86.5 62 86.5 L 53.5 86.5 Q 51.5 86.5 51.5 89.5 L 51.5 96 L 67 96 Q 69 96 69 93.5 Z"), { base: "#4a3a30", shade: "#30251e", dx: 0.6, dy: 1 });
  const torso = P("M 37.5 57 Q 50 53.5 62.5 57 Q 66 69 66 84 Q 50 87.5 34 84 Q 34 69 37.5 57 Z");
  part(ctx, torso, { base: IRON[0], shade: IRON[1], dx: 2.4, dy: 1.6 });
  folds(ctx, ["M 50 59 L 50 72", "M 41 64 Q 45 67 49 66", "M 59 64 Q 55 67 51 66"], "rgba(20,18,22,0.7)", 0.9);
  belt(ctx, 73, 35, 65, "#6b4428", "#4e2f1a", "#c99a45", 2);
  // Schwert in der linken Hand, Arm rechts haengt
  shortSword(ctx, 23, 70);
  tube(ctx, "M 39 60 Q 29 64 24.5 69", 9, IRON[0], IRON[1]);
  fist(ctx, 23, 71.5, LEATHER[0], LEATHER[1], 1, 5.4);
  tube(ctx, "M 61 60 Q 71 67 72.5 74", 9, IRON[0], IRON[1]);
  fist(ctx, 73, 77.5, LEATHER[0], LEATHER[1], -1, 5.4);
  // Schulterplatten
  part(ctx, P("M 26 67 Q 25 57 34.5 55.5 Q 42 55.5 43 60 Q 37 60.5 33 65 Q 29.5 69.5 26 67 Z"), { base: "#6e6d73", shade: IRON[1], dx: 1, dy: 1.6, hi: [32, 58, 6] });
  part(ctx, P("M 74 67 Q 75 57 65.5 55.5 Q 58 55.5 57 60 Q 63 60.5 67 65 Q 70.5 69.5 74 67 Z"), { base: "#6e6d73", shade: IRON[1], dx: 1.2, dy: 1.6, hi: [66, 58, 6] });

  // Schaedel
  const skull = ell(50, 44, 17, 15.5);
  part(ctx, skull, { base: BONE[0], shade: BONE[1], dx: 2, dy: 2, hi: [44, 44, 11], light: 0.25 });
  within(ctx, skull, () => fill(ctx, P("M 30 30 L 70 30 L 70 40 Q 50 36 30 40 Z"), "rgba(60,40,30,0.4)"));
  // Augenhoehlen mit irren Augen
  for (const x of [43, 58]) {
    fill(ctx, ell(x, 44.5, 6, 6.2), "#3d3330");
  }
  eyes(ctx, 50.5, 44.5, 7.5, { w: 4.6, h: 4.8, pupil: 0.32, lookX: 0.4, lookY: 0.4 });
  fill(ctx, P("M 49 50 L 50.4 52.4 L 48 52.4 Z"), "#3d3330");
  fill(ctx, P("M 52 50 L 53.4 52.4 L 51 52.4 Z"), "#3d3330");
  mouth(ctx, 50.5, 56, "grit", 6.4);
  // Eisenhut
  const helmet = P("M 28 43 Q 26 17 50 15.5 Q 74 17 72 43 L 70.5 39 Q 50 34 29.5 39 Z");
  part(ctx, helmet, { base: IRON[0], shade: IRON[1], dx: 2.4, dy: 2, hi: [38, 22, 15], light: 0.35 });
  part(ctx, P("M 25.5 36 Q 50 29 74.5 36 L 75.5 42 Q 50 35 24.5 42 Z"), { base: "#4a494e", shade: "#2f2e33", dx: 0.5, dy: 1.2, line: 1.2 });
  part(ctx, P("M 48.4 16 Q 50 15.4 51.6 16 L 52.2 30.6 Q 50 30.2 47.8 30.6 Z"), { base: "#4a494e", line: 1 });
  part(ctx, ell(50, 37.4, 1.8, 1.8), { base: "#8a8a90", shade: "#4a494e", dx: 0.3, dy: 0.3, line: 0.9 });
}

// --- Lich (Boss) ------------------------------------------------------------------------

const LICH: Pair = ["#5f4c79", "#423457"];
const LICH_WING: Pair = ["#4d3e63", "#33294a"];

function drawLich(ctx: Ctx): void {
  batWing(ctx, -1, LICH_WING, 49, 14);
  batWing(ctx, 1, LICH_WING, 49, 14);
  // Gewand mit zerfetztem Saum
  const robe = P("M 33 48 Q 50 41 67 48 Q 76 70 82 92 L 75 88.5 L 69 95 L 61 89.5 L 53 96 L 46 89.5 L 38.5 95 L 31.5 88.5 L 18 92 Q 24 70 33 48 Z");
  part(ctx, robe, { base: LICH[0], shade: LICH[1], dx: 2.8, dy: 1.8 });
  folds(ctx, ["M 42 62 Q 40 75 38 88", "M 58 62 Q 60 75 62 88", "M 50 66 L 50 90"], "#2f2540", 1.1);
  // Schaedelschliesse
  part(ctx, ell(50, 60.5, 4, 3.6), { base: BONE[0], shade: BONE[1], dx: 0.6, dy: 0.8, line: 1 });
  fill(ctx, ell(48.6, 60.2, 1, 1.1), LINE);
  fill(ctx, ell(51.4, 60.2, 1, 1.1), LINE);
  // Weite Aermel mit Klauen
  tube(ctx, "M 36 54 Q 25 60 21 68", 11, LICH[0], LICH[1]);
  tube(ctx, "M 64 54 Q 75 60 79 68", 11, LICH[0], LICH[1]);
  claw(ctx, 19.5, 72, "#9a8fab", "#6f6582", -1, 5.6);
  claw(ctx, 80.5, 72, "#9a8fab", "#6f6582", 1, 5.6);
  // Leuchtende Kugel ueber der rechten Klaue
  const glow = ctx.createRadialGradient(83, 60, 1, 83, 60, 12);
  glow.addColorStop(0, "rgba(200,140,255,0.6)");
  glow.addColorStop(1, "rgba(160,100,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(70, 47, 26, 26);
  part(ctx, ell(83, 60, 5, 5), { base: "#c99af0", shade: "#8f5bc4", dx: -1, dy: -1, line: 1.1 });
  gloss(ctx, 81.4, 58.2, 1.6, 1, 0.9);

  // Kapuze
  const hood = P("M 26 55 Q 19 25 40 12 Q 50 6 60 12 Q 81 25 74 55 Q 50 63 26 55 Z");
  part(ctx, hood, { base: LICH[0], shade: LICH[1], dx: 2.6, dy: 2, hi: [38, 20, 15], light: 0.25 });
  folds(ctx, ["M 50 9 Q 47 15 48 21", "M 32 30 Q 29 40 30 50", "M 68 30 Q 71 40 70 50"], "#2f2540", 1);
  const opening = ell(50, 40, 16.5, 15);
  fill(ctx, opening, "#151019");
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "#7a6694";
  ctx.stroke(opening);
  outline(ctx, ell(50, 40, 17.6, 16.1), 1.2);
  eyes(ctx, 50, 38, 7, { blank: true, w: 4.8, h: 4.6, brow: 3 });
  // Zackiger Mund
  fill(ctx, P("M 41 46.5 L 44 49.5 L 47 46.8 L 50 50 L 53 46.8 L 56 49.5 L 59 46.5 L 58 51.5 L 55 50 L 52.5 53 L 50 51.2 L 47.5 53 L 45 50 L 42 51.5 Z"), "#f4efe2");
}

function outline(ctx: Ctx, shape: Path2D, width: number): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = LINE;
  ctx.stroke(shape);
}

// --- Bombenkobold -----------------------------------------------------------------------

const BLUE_GOB: Pair = ["#7ea0b9", "#5b7c95"];

function bomb(ctx: Ctx, x: number, y: number): void {
  part(ctx, ell(x, y, 8.4, 8.4), { base: "#3b3a40", shade: "#222126", dx: 1.4, dy: 1.6, hi: [x - 3, y - 3, 5], light: 0.4 });
  part(ctx, rect(x - 2.6, y - 11.4, 5.2, 3.6, 0.8), { base: "#6e6d73", line: 1 });
  line(ctx, `M ${x} ${y - 11.4} Q ${x + 2} ${y - 16} ${x + 5.6} ${y - 16.4}`, 1.3, "#6b4428");
  const glow = ctx.createRadialGradient(x + 6, y - 17, 0.5, x + 6, y - 17, 7);
  glow.addColorStop(0, "rgba(255,220,120,0.9)");
  glow.addColorStop(1, "rgba(255,160,60,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 2, y - 25, 16, 16);
  fill(ctx, P(`M ${x + 6} ${y - 21} L ${x + 7} ${y - 18} L ${x + 10} ${y - 17} L ${x + 7} ${y - 16} L ${x + 6} ${y - 13} L ${x + 5} ${y - 16} L ${x + 2} ${y - 17} L ${x + 5} ${y - 18} Z`), "#ffe27a");
  gloss(ctx, x - 3, y - 3.6, 2.2, 1.3, 0.5);
}

function drawBombenkobold(ctx: Ctx): void {
  tube(ctx, "M 45 78 L 43 88", 7.6, BLUE_GOB[0], BLUE_GOB[1]);
  tube(ctx, "M 55 78 L 57 88", 7.6, BLUE_GOB[0], BLUE_GOB[1]);
  foot(ctx, 41.5, 95, BLUE_GOB, -1, 6.2);
  foot(ctx, 58.5, 95, BLUE_GOB, 1, 6.2);
  bareTorso(ctx, "M 39.5 57 Q 50 54 60.5 57 Q 64 69 62.5 80 Q 50 83 37.5 80 Q 36 69 39.5 57 Z", BLUE_GOB);
  loincloth(ctx, 77.5, 38, 62, ["#7b5634", "#5a3c22"], 10);
  tube(ctx, "M 40 60 Q 30 66 26 61", 7.6, BLUE_GOB[0], BLUE_GOB[1]);
  claw(ctx, 24, 58.5, BLUE_GOB[0], BLUE_GOB[1], -1, 5);
  // Rechts traegt er die Bombe
  tube(ctx, "M 60 60 Q 70 64 72 70", 7.6, BLUE_GOB[0], BLUE_GOB[1]);
  bomb(ctx, 76, 70);
  claw(ctx, 72, 74, BLUE_GOB[0], BLUE_GOB[1], 1, 4.6);

  pointyEar(ctx, -1, 31.5, 38, 20, BLUE_GOB, 10);
  pointyEar(ctx, 1, 68.5, 38, 20, BLUE_GOB, 10);
  head(ctx, 50, 39, 19.5, 17.5, BLUE_GOB);
  eyes(ctx, 50, 38.5, 7.8, { blank: true, w: 4.8, h: 5, brow: 3.2 });
  scowl(ctx, 50, 31.5);
  // Traenen der Wut
  for (const x of [38.5, 61.5]) {
    part(ctx, P(`M ${x} 42.5 Q ${x - 2} 46.5 ${x} 47.6 Q ${x + 2} 46.5 ${x} 42.5 Z`), { base: "#a8d4f0", line: 0.8 });
  }
  mouth(ctx, 50, 48, "wail", 7);
}

// --- Mumie --------------------------------------------------------------------------------

const WRAP: Pair = ["#ddd0b0", "#b5a784"];

/** Binden: schraege Linien quer ueber eine Form. */
function bandages(ctx: Ctx, shape: Path2D, top: number, bottom: number, step = 4.2): void {
  within(ctx, shape, () => {
    let tilt = 1;
    for (let y = top; y < bottom; y += step) {
      line(ctx, `M 0 ${y} Q 50 ${y + tilt * 2.4} 100 ${y + tilt}`, 0.8, "rgba(80,64,44,0.75)");
      tilt = -tilt;
    }
  });
}

function drawMumie(ctx: Ctx): void {
  tube(ctx, "M 44.5 78 L 42.5 89", 9, WRAP[0], WRAP[1]);
  tube(ctx, "M 55.5 78 L 57.5 89", 9, WRAP[0], WRAP[1]);
  for (const y of [81, 84.5, 88]) {
    line(ctx, `M 38.5 ${y} L 47.5 ${y + 1}`, 0.8, "rgba(80,64,44,0.75)");
    line(ctx, `M 52.5 ${y + 1} L 61.5 ${y}`, 0.8, "rgba(80,64,44,0.75)");
  }
  foot(ctx, 41.5, 95.5, WRAP, -1, 6.6);
  foot(ctx, 58.5, 95.5, WRAP, 1, 6.6);
  const torso = P("M 38.5 56 Q 50 53 61.5 56 Q 65 68 63.5 80 Q 50 83 36.5 80 Q 35 68 38.5 56 Z");
  part(ctx, torso, { base: WRAP[0], shade: WRAP[1], dx: 2.4, dy: 1.8 });
  bandages(ctx, torso, 58, 82, 4);
  // Arme vor der Brust angewinkelt (wie in der Vorlage)
  tube(ctx, "M 39.5 59 Q 29 66 35 71.5", 8.6, WRAP[0], WRAP[1]);
  tube(ctx, "M 60.5 59 Q 71 66 65 71.5", 8.6, WRAP[0], WRAP[1]);
  fist(ctx, 39.5, 71.5, WRAP[0], WRAP[1], 1, 5);
  fist(ctx, 60.5, 71.5, WRAP[0], WRAP[1], -1, 5);
  // Lose Binde
  part(ctx, P("M 62 62 Q 70 70 68 82 L 65.5 81 Q 67 71 60 64 Z"), { base: WRAP[0], shade: WRAP[1], dx: 0.5, dy: 0.6, line: 1 });

  const skull = head(ctx, 50, 38, 19, 17, WRAP);
  bandages(ctx, skull, 22, 56, 4.4);
  // Dunkles Augenband
  const band = P("M 31.5 34 Q 50 31 68.5 34 L 68.5 43.5 Q 50 41 31.5 43.5 Z");
  within(ctx, skull, () => fill(ctx, band, "#2f2622"));
  eyes(ctx, 50, 38.6, 8, { blank: true, w: 4.8, h: 3.8, brow: 2.4 });
  mouth(ctx, 50, 49.5, "open", 5.4);
}

export function drawMonster(ctx: Ctx, type: EnemyType): void {
  switch (type) {
    case "grunt":
      drawGoblin(ctx);
      break;
    case "swarmer":
      drawFledermaus(ctx);
      break;
    case "charger":
      drawTeufelchen(ctx);
      break;
    case "spitter":
      drawSchleim(ctx);
      break;
    case "bruiser":
      drawOger(ctx);
      break;
    case "elite":
      drawSkelettritter(ctx);
      break;
    case "boss":
      drawLich(ctx);
      break;
    case "exploder":
      drawBombenkobold(ctx);
      break;
    case "splitter":
      drawMumie(ctx);
      break;
  }
}
