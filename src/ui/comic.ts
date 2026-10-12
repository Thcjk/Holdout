/**
 * Der Comic-Look: Texturen, die beim Start gezeichnet werden.
 *
 * Das Kenney-Paket liefert nur kleine, flache Pixelfiguren. Comic-Optik kommt
 * hier dazu: dicke schwarze Umrisse um jede Figur, eine bunte Arena mit
 * Rasterpunkten und Rissen, ein Logo mit Zacken-Stern, Muenzen und Geschosse
 * mit Glanzpunkt. Alles wird einmal auf Leinwaende gemalt (feste Startwerte,
 * damit es bei jedem Start gleich aussieht) und danach nur noch als Bild benutzt.
 */

import type Phaser from "phaser";
import { CHARACTER_TILES, ENEMY_TILES, SHEET_KEY, TILE, arenaKey, characterKey, enemyKey } from "../config/assets";
import { ARENA } from "../game/constants";
import type { CharacterId, EnemyType } from "../game/types";

/** Wie stark die 16-Pixel-Figuren beim Umzeichnen vergroessert werden. */
export const OUTLINE_UPSCALE = 4;
const OUTLINE_PAD = 7;
const OUTLINE_WIDTH = 5;

/** Breite des Mauerrands um die Arena in Entwurfseinheiten. */
export const ARENA_WALL = 18;

function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  return context ? { canvas, context } : null;
}

/** Ein Zufallsstrom mit festem Startwert: Die Arena sieht bei jedem Start gleich aus. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, smooth: boolean): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const texture = scene.textures.addCanvas(key, canvas);
  if (smooth && texture) {
    // Das Spiel stellt Pixel-Art auf harte Kanten; gemalte Flaechen sollen weich skalieren.
    texture.setFilter(1);
  }
}

// --- Figuren mit Umriss --------------------------------------------------------

function outlinedFigure(scene: Phaser.Scene, key: string, frameIndex: number, overlay?: string): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const frame = scene.textures.getFrame(SHEET_KEY, frameIndex);
  if (!frame) {
    return;
  }
  const image = frame.source.image as CanvasImageSource;
  const size = TILE * OUTLINE_UPSCALE + OUTLINE_PAD * 2;

  const sprite = canvasOf(size, size);
  const silhouette = canvasOf(size, size);
  const main = canvasOf(size, size);
  if (!sprite || !silhouette || !main) {
    return;
  }
  const draw = (context: CanvasRenderingContext2D): void => {
    context.imageSmoothingEnabled = false;
    context.drawImage(
      image,
      frame.cutX,
      frame.cutY,
      frame.cutWidth,
      frame.cutHeight,
      OUTLINE_PAD,
      OUTLINE_PAD,
      TILE * OUTLINE_UPSCALE,
      TILE * OUTLINE_UPSCALE,
    );
  };
  draw(sprite.context);
  if (overlay) {
    sprite.context.globalCompositeOperation = "source-atop";
    sprite.context.fillStyle = overlay;
    sprite.context.fillRect(0, 0, size, size);
  }

  draw(silhouette.context);
  silhouette.context.globalCompositeOperation = "source-in";
  silhouette.context.fillStyle = "#14101c";
  silhouette.context.fillRect(0, 0, size, size);

  for (let step = 0; step < 16; step += 1) {
    const angle = (step / 16) * Math.PI * 2;
    main.context.drawImage(silhouette.canvas, Math.cos(angle) * OUTLINE_WIDTH, Math.sin(angle) * OUTLINE_WIDTH);
  }
  main.context.drawImage(sprite.canvas, 0, 0);
  addTexture(scene, key, main.canvas, false);
}

// --- Arena ---------------------------------------------------------------------

function paintArena(context: CanvasRenderingContext2D): void {
  const wall = ARENA_WALL;
  const width = ARENA.width + wall * 2;
  const height = ARENA.height + wall * 2;
  const random = seeded(77);

  // Mauerrand: Steinbloecke mit schwarzen Fugen.
  context.fillStyle = "#6f5f8a";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#14101c";
  context.lineWidth = 2;
  for (let x = 0; x < width; x += 36) {
    for (const y of [0, height - wall]) {
      context.fillStyle = (x / 36) % 2 === 0 ? "#8776a4" : "#7a6a97";
      context.fillRect(x + 1, y + 1, 34, wall - 2);
      context.strokeRect(x + 1, y + 1, 34, wall - 2);
      context.fillStyle = "rgba(255,255,255,0.25)";
      context.fillRect(x + 4, y + 3, 28, 3);
    }
  }
  for (let y = wall; y < height - wall; y += 30) {
    for (const x of [0, width - wall]) {
      context.fillStyle = (y / 30) % 2 === 0 ? "#8776a4" : "#7a6a97";
      context.fillRect(x + 1, y + 1, wall - 2, 28);
      context.strokeRect(x + 1, y + 1, wall - 2, 28);
      context.fillStyle = "rgba(255,255,255,0.25)";
      context.fillRect(x + 3, y + 4, 3, 20);
    }
  }

  // Boden.
  context.save();
  context.beginPath();
  context.rect(wall, wall, ARENA.width, ARENA.height);
  context.clip();
  context.fillStyle = "#ecc47a";
  context.fillRect(wall, wall, ARENA.width, ARENA.height);

  // Grosse, weiche Flecken in zwei Sandtoenen.
  for (let i = 0; i < 46; i += 1) {
    context.fillStyle = random() < 0.5 ? "rgba(214,160,86,0.45)" : "rgba(255,227,160,0.55)";
    context.beginPath();
    context.ellipse(
      wall + random() * ARENA.width,
      wall + random() * ARENA.height,
      30 + random() * 90,
      20 + random() * 50,
      random() * Math.PI,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  // Rasterpunkte (Halbton) wie im Comicdruck: gross am Rand, klein zur Mitte.
  const cx = wall + ARENA.width / 2;
  const cy = wall + ARENA.height / 2;
  const maxDistance = Math.hypot(ARENA.width / 2, ARENA.height / 2);
  context.fillStyle = "rgba(168,104,44,0.55)";
  for (let y = wall + 6; y < wall + ARENA.height; y += 12) {
    for (let x = wall + 6 + (Math.floor(y / 12) % 2) * 6; x < wall + ARENA.width; x += 12) {
      const distance = Math.hypot(x - cx, y - cy) / maxDistance;
      const radius = Math.max(0, (distance - 0.55) * 5.5);
      if (radius > 0.4) {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  // Ring in der Mitte: die "Buehne".
  context.strokeStyle = "rgba(120,70,30,0.5)";
  context.lineWidth = 5;
  context.setLineDash([22, 16]);
  context.beginPath();
  context.ellipse(cx, cy, 190, 120, 0, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);

  // Risse.
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let i = 0; i < 14; i += 1) {
    let x = wall + 30 + random() * (ARENA.width - 60);
    let y = wall + 30 + random() * (ARENA.height - 60);
    context.beginPath();
    context.moveTo(x, y);
    const segments = 3 + Math.floor(random() * 3);
    for (let s = 0; s < segments; s += 1) {
      x += (random() - 0.5) * 46;
      y += (random() - 0.2) * 30;
      context.lineTo(x, y);
    }
    context.strokeStyle = "#14101c";
    context.lineWidth = 4;
    context.stroke();
    context.strokeStyle = "#9a6430";
    context.lineWidth = 1.6;
    context.stroke();
  }

  // Kiesel mit Umriss.
  for (let i = 0; i < 34; i += 1) {
    const x = wall + 14 + random() * (ARENA.width - 28);
    const y = wall + 14 + random() * (ARENA.height - 28);
    const r = 3 + random() * 4;
    context.fillStyle = random() < 0.5 ? "#b9a8c9" : "#d8cbe3";
    context.strokeStyle = "#14101c";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(x, y, r * 1.3, r, random() * 0.6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "rgba(255,255,255,0.7)";
    context.fillRect(x - r * 0.6, y - r * 0.5, r * 0.7, 1.6);
  }

  // Grasbueschel und Blumen.
  for (let i = 0; i < 40; i += 1) {
    const x = wall + 12 + random() * (ARENA.width - 24);
    const y = wall + 12 + random() * (ARENA.height - 24);
    context.strokeStyle = "#14101c";
    context.lineWidth = 3.4;
    for (const dx of [-4, 0, 4]) {
      context.beginPath();
      context.moveTo(x + dx, y);
      context.lineTo(x + dx * 1.6, y - 8 - Math.abs(dx));
      context.stroke();
    }
    context.strokeStyle = "#4fae3c";
    context.lineWidth = 1.8;
    for (const dx of [-4, 0, 4]) {
      context.beginPath();
      context.moveTo(x + dx, y);
      context.lineTo(x + dx * 1.6, y - 8 - Math.abs(dx));
      context.stroke();
    }
    if (random() < 0.3) {
      context.fillStyle = random() < 0.5 ? "#ff6fa5" : "#ffffff";
      context.strokeStyle = "#14101c";
      context.lineWidth = 1.6;
      context.beginPath();
      context.arc(x + 1, y - 14, 3.4, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }

  // Innerer Schatten an der Mauer.
  for (const [x0, y0, x1, y1] of [
    [0, wall, 0, wall + 22],
    [0, wall + ARENA.height, 0, wall + ARENA.height - 22],
  ] as const) {
    const gradient = context.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, "rgba(40,20,60,0.5)");
    gradient.addColorStop(1, "rgba(40,20,60,0)");
    context.fillStyle = gradient;
    context.fillRect(wall, Math.min(y0, y1), ARENA.width, 22);
  }
  for (const [x0, x1] of [
    [wall, wall + 22],
    [wall + ARENA.width, wall + ARENA.width - 22],
  ] as const) {
    const gradient = context.createLinearGradient(x0, 0, x1, 0);
    gradient.addColorStop(0, "rgba(40,20,60,0.4)");
    gradient.addColorStop(1, "rgba(40,20,60,0)");
    context.fillStyle = gradient;
    context.fillRect(Math.min(x0, x1), wall, 22, ARENA.height);
  }
  context.restore();

  // Dicke Konturen: innen und aussen.
  context.strokeStyle = "#14101c";
  context.lineWidth = 4;
  context.strokeRect(wall, wall, ARENA.width, ARENA.height);
  context.lineWidth = 5;
  context.strokeRect(1.5, 1.5, width - 3, height - 3);
}

function createArena(scene: Phaser.Scene): void {
  const scale = 2;
  const wall = ARENA_WALL;
  const target = canvasOf((ARENA.width + wall * 2) * scale, (ARENA.height + wall * 2) * scale);
  if (!target) {
    return;
  }
  target.context.scale(scale, scale);
  paintArena(target.context);
  addTexture(scene, arenaKey, target.canvas, true);
}

/** Dunkler Hintergrund hinter der Arena: Verlauf mit Rasterpunkten. */
function createGameBackground(scene: Phaser.Scene): void {
  const width = 1600;
  const height = 540;
  const target = canvasOf(width, height);
  if (!target) {
    return;
  }
  const { context } = target;
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#35235c");
  gradient.addColorStop(1, "#1a1230");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(255,255,255,0.06)";
  for (let y = 8; y < height; y += 16) {
    for (let x = 8 + (Math.floor(y / 16) % 2) * 8; x < width; x += 16) {
      context.beginPath();
      context.arc(x, y, 2.4 + (y / height) * 1.4, 0, Math.PI * 2);
      context.fill();
    }
  }
  addTexture(scene, "bg-game", target.canvas, true);
}

// --- Kleinteile ------------------------------------------------------------------

function createBullet(scene: Phaser.Scene): void {
  const target = canvasOf(32, 32);
  if (!target) {
    return;
  }
  const { context } = target;
  context.fillStyle = "#14101c";
  context.beginPath();
  context.arc(16, 16, 14, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(16, 16, 10, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(0,0,0,0.18)";
  context.beginPath();
  context.arc(19, 19, 6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(12, 12, 3, 0, Math.PI * 2);
  context.fill();
  addTexture(scene, "bullet", target.canvas, true);
}

/** Das Material: ein goldener Klumpen mit Glanzpunkt. */
function createGem(scene: Phaser.Scene): void {
  const target = canvasOf(48, 48);
  if (!target) {
    return;
  }
  const { context } = target;
  const polygon = [
    [24, 4],
    [40, 14],
    [40, 32],
    [24, 44],
    [8, 32],
    [8, 14],
  ] as const;
  context.lineJoin = "round";
  context.beginPath();
  polygon.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
  context.closePath();
  context.fillStyle = "#ffd23f";
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = "#14101c";
  context.stroke();
  context.fillStyle = "#ff9f1c";
  context.beginPath();
  context.moveTo(24, 24);
  context.lineTo(40, 32);
  context.lineTo(24, 44);
  context.lineTo(8, 32);
  context.closePath();
  context.fill();
  context.fillStyle = "#fff4a8";
  context.beginPath();
  context.moveTo(24, 8);
  context.lineTo(36, 15);
  context.lineTo(24, 24);
  context.lineTo(12, 15);
  context.closePath();
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.ellipse(18, 16, 4, 2.4, -0.6, 0, Math.PI * 2);
  context.fill();
  addTexture(scene, "gem", target.canvas, true);
}

// --- Logo ------------------------------------------------------------------------

function star(context: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, spikes: number, inner: number): void {
  context.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 === 0 ? 1 : inner;
    const x = cx + Math.cos(angle) * rx * k;
    const y = cy + Math.sin(angle) * ry * k;
    if (i === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
}

/** Das Logo: Zackenstern, dicker Schriftzug mit Umrissen, Banderole. Gross gemalt, klein angezeigt. */
function createLogo(scene: Phaser.Scene): void {
  const width = 900;
  const height = 320;
  const target = canvasOf(width, height);
  if (!target) {
    return;
  }
  const { context } = target;
  context.lineJoin = "round";
  context.lineCap = "round";
  const ink = "#14101c";

  // Zackenstern hinter dem Schriftzug.
  context.save();
  star(context, width / 2, 140, 430, 140, 16, 0.72);
  context.fillStyle = ink;
  context.lineWidth = 16;
  context.strokeStyle = ink;
  context.stroke();
  context.fill();
  star(context, width / 2, 140, 410, 128, 16, 0.72);
  context.fillStyle = "#e4572e";
  context.fill();
  star(context, width / 2, 140, 330, 104, 16, 0.74);
  context.fillStyle = "#ff9f1c";
  context.fill();
  context.restore();

  // Schriftzug, leicht schraeg und nach oben geneigt.
  context.save();
  context.translate(width / 2, 142);
  context.rotate(-0.045);
  context.transform(1, 0, -0.16, 1, 0, 0);
  let fontSize = 168;
  const family = `900 FONTpx "Arial Black", "Segoe UI Black", Impact, system-ui, sans-serif`;
  context.font = family.replace("FONT", String(fontSize));
  while (context.measureText("HOLDOUT").width > 640 && fontSize > 80) {
    fontSize -= 4;
    context.font = family.replace("FONT", String(fontSize));
  }
  context.textAlign = "center";
  context.textBaseline = "middle";
  // Harter Schlagschatten.
  context.strokeStyle = ink;
  context.lineWidth = 34;
  context.strokeText("HOLDOUT", 9, 13);
  context.fillStyle = ink;
  context.fillText("HOLDOUT", 9, 13);
  // Aeusserer Umriss, weisser Rand, Fuellung.
  context.lineWidth = 32;
  context.strokeText("HOLDOUT", 0, 0);
  context.strokeStyle = "#fffaf0";
  context.lineWidth = 17;
  context.strokeText("HOLDOUT", 0, 0);
  const fill = context.createLinearGradient(0, -fontSize / 2, 0, fontSize / 2);
  fill.addColorStop(0, "#fff27a");
  fill.addColorStop(0.5, "#ffc21f");
  fill.addColorStop(1, "#ff7a1a");
  context.fillStyle = fill;
  context.fillText("HOLDOUT", 0, 0);
  // Glanzstreifen oben.
  context.save();
  context.globalCompositeOperation = "source-atop";
  context.fillStyle = "rgba(255,255,255,0.35)";
  context.fillRect(-400, -fontSize / 2, 800, fontSize * 0.28);
  context.restore();
  context.restore();

  // Banderole.
  context.save();
  context.translate(width / 2, 282);
  context.rotate(-0.025);
  context.fillStyle = ink;
  context.fillRect(-250, -26, 500, 52);
  context.fillStyle = "#7c4dff";
  context.fillRect(-244, -20, 488, 40);
  context.fillStyle = "rgba(255,255,255,0.18)";
  context.fillRect(-244, -20, 488, 12);
  context.font = `900 30px "Arial Black", system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fffaf0";
  context.fillText("ÜBERLEBE 20 WELLEN!", 0, 2);
  context.restore();

  addTexture(scene, "logo", target.canvas, true);
}

// --- Einstieg --------------------------------------------------------------------

/** Malt alle Comic-Texturen. Mehrfach aufrufen ist harmlos. */
export function createComicTextures(scene: Phaser.Scene): void {
  for (const id of Object.keys(CHARACTER_TILES) as CharacterId[]) {
    outlinedFigure(scene, characterKey(id), CHARACTER_TILES[id]);
  }
  for (const type of Object.keys(ENEMY_TILES) as EnemyType[]) {
    // Der Elite teilt sich das Bild mit dem Sturmlaeufer - ein roter Schimmer trennt sie.
    outlinedFigure(scene, enemyKey(type), ENEMY_TILES[type], type === "elite" ? "rgba(255,40,70,0.5)" : undefined);
  }
  createArena(scene);
  createGameBackground(scene);
  createBullet(scene);
  createGem(scene);
  createLogo(scene);
}
