/**
 * Zentrale Stelle fuer alle Grafiken - als ein einziger Texture Atlas.
 *
 * "Texture Atlas" heisst: alle Bilder liegen in einer Grafik nebeneinander, und
 * jedes bekommt einen Namen ("Frame"). Phaser laedt dann ein Bild statt fuenfzig,
 * was auf dem Handy deutlich Ladezeit spart (Briefing, Abschnitt 7).
 *
 * ABWEICHUNG VOM BRIEFING: Dort sind Kenney-Sprites vorgesehen. Die liessen sich
 * in dieser Umgebung nicht herunterladen, deshalb werden die Sprites hier beim
 * Start gezeichnet. Der Punkt dieser Datei bleibt derselbe und ist der eigentlich
 * wichtige: Im Spielcode steht nur `FRAMES.runner`, nie eine Form oder Farbe.
 * Auf echte Sprites zu wechseln heisst, `buildAtlas` durch ein `scene.load.atlas`
 * zu ersetzen - eine Datei, nicht fuenfzig Fundstellen.
 */

import Phaser from "phaser";

export const ATLAS_KEY = "game-atlas";

/** Kantenlaenge einer Zelle im Atlas. */
const CELL = 80;

/**
 * Radius des Koerpers innerhalb einer Zelle. Der Spielcode skaliert ein Sprite
 * mit `radius / BODY_RADIUS`, damit Kollisionsradius und Bild zusammenpassen.
 */
export const BODY_RADIUS = 30;

export const FRAMES = {
  scout: "scout",
  tank: "tank",
  sniper: "sniper",
  bulletPlayer: "bullet-player",
  runner: "runner",
  brute: "brute",
  shooter: "shooter",
  bulletEnemy: "bullet-enemy",
  dot: "dot",
  spark: "spark",
} as const;

export type FrameName = (typeof FRAMES)[keyof typeof FRAMES];

/** Rasterplatz jedes Frames: [Spalte, Zeile]. */
const LAYOUT: Record<FrameName, [number, number]> = {
  [FRAMES.scout]: [0, 0],
  [FRAMES.tank]: [1, 0],
  [FRAMES.sniper]: [2, 0],
  [FRAMES.bulletPlayer]: [3, 0],
  [FRAMES.runner]: [0, 1],
  [FRAMES.brute]: [1, 1],
  [FRAMES.shooter]: [2, 1],
  [FRAMES.bulletEnemy]: [3, 1],
  [FRAMES.dot]: [0, 2],
  [FRAMES.spark]: [1, 2],
};

const COLUMNS = 4;
const ROWS = 3;

export function buildAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(ATLAS_KEY)) {
    return;
  }

  const texture = scene.textures.createCanvas(ATLAS_KEY, CELL * COLUMNS, CELL * ROWS);
  const context = texture?.getContext();
  if (!texture || !context) {
    return;
  }

  drawPlayer(context, cell(FRAMES.scout), "#4cc2ff", "slim");
  drawPlayer(context, cell(FRAMES.tank), "#2f81c9", "heavy");
  drawPlayer(context, cell(FRAMES.sniper), "#9ee3ff", "long");

  drawRunner(context, cell(FRAMES.runner));
  drawBrute(context, cell(FRAMES.brute));
  drawShooter(context, cell(FRAMES.shooter));

  drawBullet(context, cell(FRAMES.bulletPlayer), "#fff2a8", "#fffbe0");
  drawBullet(context, cell(FRAMES.bulletEnemy), "#ff7a5c", "#ffd2c4");

  drawSolidCircle(context, cell(FRAMES.dot), 10, "#ffffff");
  drawSolidCircle(context, cell(FRAMES.spark), 8, "#fff2a8");

  for (const [name, [column, row]] of Object.entries(LAYOUT)) {
    texture.add(name, 0, column * CELL, row * CELL, CELL, CELL);
  }

  texture.refresh();
}

interface Cell {
  x: number;
  y: number;
}

function cell(frame: FrameName): Cell {
  const [column, row] = LAYOUT[frame];
  return { x: column * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

/**
 * Alle Figuren schauen im Atlas nach rechts. Das Spiel dreht das Sprite dann in
 * die Blickrichtung - so braucht es nur ein Bild statt acht Richtungen.
 */
function drawPlayer(
  context: CanvasRenderingContext2D,
  center: Cell,
  color: string,
  weapon: "slim" | "heavy" | "long",
): void {
  context.save();
  context.translate(center.x, center.y);

  // Waffe zuerst, damit sie hinter dem Koerper endet.
  context.fillStyle = "#e8f6ff";
  if (weapon === "slim") {
    context.fillRect(BODY_RADIUS - 6, -5, 22, 10);
  } else if (weapon === "heavy") {
    context.fillRect(BODY_RADIUS - 8, -9, 18, 18);
  } else {
    context.fillRect(BODY_RADIUS - 6, -4, 34, 8);
  }

  context.beginPath();
  context.arc(0, 0, BODY_RADIUS, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = "#e8f6ff";
  context.stroke();

  // Kleine helle Kappe oben: gibt der Kugel Form, ohne dass es aufwendig wird.
  context.beginPath();
  context.arc(-4, -8, BODY_RADIUS * 0.45, 0, Math.PI * 2);
  context.fillStyle = "rgba(255,255,255,0.28)";
  context.fill();

  context.restore();
}

/** Laeufer: spitze Form, die in Laufrichtung zeigt - schnell lesbar. */
function drawRunner(context: CanvasRenderingContext2D, center: Cell): void {
  context.save();
  context.translate(center.x, center.y);

  context.beginPath();
  context.moveTo(BODY_RADIUS + 4, 0);
  context.lineTo(-BODY_RADIUS * 0.7, -BODY_RADIUS * 0.85);
  context.lineTo(-BODY_RADIUS * 0.35, 0);
  context.lineTo(-BODY_RADIUS * 0.7, BODY_RADIUS * 0.85);
  context.closePath();
  context.fillStyle = "#ff6b4a";
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = "#2a1720";
  context.stroke();

  context.restore();
}

/** Brocken: schweres Sechseck, dicke Kontur - sieht langsam und hart aus. */
function drawBrute(context: CanvasRenderingContext2D, center: Cell): void {
  context.save();
  context.translate(center.x, center.y);

  context.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.cos(angle) * BODY_RADIUS;
    const y = Math.sin(angle) * BODY_RADIUS;
    if (i === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.fillStyle = "#c94f7c";
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = "#2a1720";
  context.stroke();

  context.beginPath();
  context.arc(0, 0, BODY_RADIUS * 0.4, 0, Math.PI * 2);
  context.fillStyle = "rgba(0,0,0,0.25)";
  context.fill();

  context.restore();
}

/** Schuetze: runder Koerper mit Lauf - zeigt auf den ersten Blick, was er tut. */
function drawShooter(context: CanvasRenderingContext2D, center: Cell): void {
  context.save();
  context.translate(center.x, center.y);

  context.fillStyle = "#2a1720";
  context.fillRect(BODY_RADIUS - 10, -6, 28, 12);

  context.beginPath();
  context.arc(0, 0, BODY_RADIUS * 0.92, 0, Math.PI * 2);
  context.fillStyle = "#ffa62b";
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = "#2a1720";
  context.stroke();

  context.restore();
}

function drawBullet(
  context: CanvasRenderingContext2D,
  center: Cell,
  core: string,
  glow: string,
): void {
  context.save();
  context.translate(center.x, center.y);

  context.beginPath();
  context.arc(0, 0, BODY_RADIUS * 0.72, 0, Math.PI * 2);
  context.fillStyle = glow;
  context.globalAlpha = 0.35;
  context.fill();

  context.globalAlpha = 1;
  context.beginPath();
  context.arc(0, 0, BODY_RADIUS * 0.46, 0, Math.PI * 2);
  context.fillStyle = core;
  context.fill();

  context.restore();
}

function drawSolidCircle(
  context: CanvasRenderingContext2D,
  center: Cell,
  radius: number,
  color: string,
): void {
  context.save();
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.restore();
}
