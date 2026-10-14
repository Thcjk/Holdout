/**
 * Malt beim Start alle Pixel-Bilder und legt sie als Phaser-Texturen ab.
 *
 * Alles ist Code (siehe `pix.ts`), es gibt keine Bilddateien. Gemalt wird in
 * Originalgroesse (1 Pixel = 1 Entwurfspixel); Phaser zeigt die Texturen mit
 * harten Kanten (`pixelArt: true` in main.ts).
 */

import type Phaser from "phaser";
import { CREW_IDS } from "../../game/data/crew";
import { MODULE_IDS } from "../../game/data/modules";
import { FIXED_MODULES, legPose } from "../../game/fortress";
import { ARMY, paintArmy } from "./armee";
import { paintChest, paintFortIcon, paintNodeIcon } from "./karte";
import { paintCrew } from "./crew";
import { paintFortressBody, paintLeg, paintModule } from "./festung";
import { GOLD, OUTLINE, STEEL } from "./palette";
import { ellipse, Pix, poly, rect } from "./pix";
import { paintDesert } from "./wueste";

/** Breite des kachelnden Bodens. */
export const GROUND_TILE_W = 1200;
export const GROUND_TILE_H = 540;
/** So viele Bilder hat ein Schrittzyklus eines Beins. */
export const LEG_FRAMES = 16;

export const TEX = {
  ground: "ground",
  fortress: "fortress-body",
  rivet: "rivet",
  shadow: "shadow",
  footprint: "footprint",
  dust: "dust",
  smoke: "smoke",
  spark: "spark",
  bone: "bone-shard",
  gear: "gear",
  glow: "glow",
  arrow: "arrow-up",
  bolt: "bolt",
  harpoon: "harpoon",
  shell: "shell",
  puddle: "oil-puddle",
  drop: "oil-drop",
  pip: "level-pip",
  warning: "warning",
  ballistaBolt: "ballista-bolt",
  fortIcon: "fort-icon",
  chest: "chest",
  chestOpen: "chest-open",
  fog: "fog",
  drone: "drone",
} as const;

export const crewKey = (id: string): string => `crew-${id}`;
export const armyKey = (id: string): string => `army-${id}`;
export const moduleKey = (id: string): string => `module-${id}`;
export const legKey = (side: "l" | "r", frame: number): string => `leg-${side}-${frame}`;
export const scrapKey = (kind: number): string => `scrap-${kind}`;
export const nodeKey = (type: string): string => `node-${type}`;

function add(scene: Phaser.Scene, key: string, pix: Pix): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, pix.toCanvas());
}

function scrapPiece(kind: number): Pix {
  const p = new Pix(12, 10, 5 + kind);
  const steel = STEEL;
  if (kind === 0) {
    p.shape(poly(1, 8, 4, 2, 10, 3, 11, 8), steel, { shade: 1 });
    p.line(3, 6, 9, 5, "#5a4a3a");
  } else if (kind === 1) {
    p.shape(rect(2, 3, 8, 5), ["#3a1606", "#a8481a", "#e8822e", "#ffc070"], { shade: 1 });
    p.px(4, 5, "#2a1008");
  } else {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      p.px(6 + Math.cos(a) * 4, 5 + Math.sin(a) * 4, steel[2]);
    }
    p.shape(ellipse(6, 5, 3.4, 3.4), steel, { shade: 1 });
    p.px(6, 5, OUTLINE);
  }
  p.outline(OUTLINE);
  return p;
}

function gear(size: number): Pix {
  const p = new Pix(size, size, 3);
  const c = size / 2;
  const r = size / 2 - 1.5;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    p.fill(ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, 1.6, 1.6), STEEL[1]);
  }
  p.shape(ellipse(c, c, r - 0.8, r - 0.8), STEEL, { shade: 1 });
  p.fill(ellipse(c, c, r * 0.35, r * 0.35), "#2a2636");
  p.outline(OUTLINE);
  return p;
}

/** Weicher Fleck aus Pixeln in einer Farbe (fuer Staub, Rauch, Glanz). */
function blob(size: number, color: string, alpha: number): Pix {
  const p = new Pix(size, size, 1);
  const c = size / 2;
  const hex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  p.fill(ellipse(c, c, c - 0.5, c - 0.5), color + hex);
  return p;
}

/**
 * Sandsturm: Bild mit klarem Fleck in der Mitte und dichtem Sand am Rand.
 * Wird ueber den Bildschirm gelegt und auf die Festung ausgerichtet.
 */
function addFog(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.fog)) {
    scene.textures.remove(TEX.fog);
  }
  const w = 480;
  const h = 270;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) {
    return;
  }
  const gradient = g.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, 170);
  gradient.addColorStop(0, "rgba(120, 88, 66, 0)");
  gradient.addColorStop(0.35, "rgba(120, 88, 66, 0.5)");
  gradient.addColorStop(1, "rgba(104, 74, 56, 0.97)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, w, h);
  scene.textures.addCanvas(TEX.fog, canvas);
}

export function createPixelTextures(scene: Phaser.Scene): void {
  // Boden: nahtlos kachelnd, damit er unter der laufenden Festung endlos vorbeizieht.
  add(scene, TEX.ground, paintDesert(GROUND_TILE_W, GROUND_TILE_H, { seed: 11, seamless: true }));
  add(scene, TEX.fortress, paintFortressBody());

  // Beine: je ein Bild pro Stelle im Schrittzyklus, links und rechts.
  for (let frame = 0; frame < LEG_FRAMES; frame += 1) {
    const { dx, lift } = legPose((frame + 0.5) / LEG_FRAMES);
    // Links laeuft die Festung vom Bein weg (+x = Laufrichtung = vom Koerper weg nach rechts).
    add(scene, legKey("l", frame), paintLeg(dx, lift));
    const right = paintLeg(-dx, lift);
    right.mirror();
    add(scene, legKey("r", frame), right);
  }
  for (const m of FIXED_MODULES) {
    add(scene, moduleKey(m.id), paintModule(m.id));
  }
  for (const id of MODULE_IDS) {
    add(scene, moduleKey(id), paintModule(id));
  }
  for (const id of CREW_IDS) {
    add(scene, crewKey(id), paintCrew(id));
  }
  for (const { id } of ARMY) {
    add(scene, armyKey(id), paintArmy(id));
  }

  // Kleinkram
  const rivet = new Pix(7, 4, 1);
  rivet.fill(rect(0, 0, 7, 4), OUTLINE);
  rivet.fill(rect(1, 1, 5, 2), GOLD[2]);
  rivet.px(5, 1, GOLD[3]);
  add(scene, TEX.rivet, rivet);
  const shadow = new Pix(32, 10, 1);
  shadow.fill(ellipse(16, 5, 15.5, 4.5), "#14080c70");
  add(scene, TEX.shadow, shadow);
  const print = new Pix(18, 8, 1);
  print.fill(rect(3, 1, 12, 4), "#2a141660");
  print.fill(rect(0, 4, 3, 2), "#2a141660");
  print.fill(rect(15, 4, 3, 2), "#2a141660");
  print.fill(rect(8, 5, 2, 2), "#2a141660");
  add(scene, TEX.footprint, print);
  add(scene, TEX.dust, blob(16, "#a8806e", 0.75));
  add(scene, TEX.smoke, blob(16, "#9a9098", 0.7));
  add(scene, TEX.glow, blob(64, "#ffb43c", 0.35));
  const spark = new Pix(4, 4, 1);
  spark.fill(rect(0, 0, 4, 4), "#ffd27a");
  spark.fill(rect(1, 1, 2, 2), "#fffbe0");
  add(scene, TEX.spark, spark);
  const bone = new Pix(5, 3, 1);
  bone.fill(rect(0, 0, 5, 3), OUTLINE);
  bone.fill(rect(1, 1, 3, 1), "#f6f1e2");
  add(scene, TEX.bone, bone);
  add(scene, TEX.gear, gear(18));
  for (let kind = 0; kind < 3; kind += 1) {
    add(scene, scrapKey(kind), scrapPiece(kind));
  }
  // Geschosse der Module
  const bolt = new Pix(8, 4, 1);
  bolt.fill(rect(0, 0, 8, 4), OUTLINE);
  bolt.fill(rect(1, 1, 6, 2), "#5ff2e0");
  bolt.fill(rect(4, 1, 3, 1), "#d0fff8");
  add(scene, TEX.bolt, bolt);
  const harpoon = new Pix(18, 5, 1);
  harpoon.fill(rect(0, 1, 13, 3), OUTLINE);
  harpoon.fill(rect(1, 2, 12, 1), "#86582c");
  harpoon.shape(poly(12, 0, 18, 2.5, 12, 5), STEEL, { shade: 0 });
  harpoon.outline(OUTLINE);
  add(scene, TEX.harpoon, harpoon);
  // Bolzen der Ballista: dicker Holzschaft mit goldener Spitze
  const ballistaBolt = new Pix(22, 5, 1);
  ballistaBolt.fill(rect(0, 1, 16, 3), OUTLINE);
  ballistaBolt.fill(rect(1, 2, 15, 1), "#a8743c");
  ballistaBolt.fill(rect(0, 0, 3, 5), "#6e1e22");
  ballistaBolt.shape(poly(15, 0, 22, 2.5, 15, 5), GOLD, { shade: 0 });
  ballistaBolt.outline(OUTLINE);
  add(scene, TEX.ballistaBolt, ballistaBolt);
  const shell = new Pix(7, 7, 1);
  shell.shape(ellipse(3.5, 3.5, 3, 3), ["#14141e", "#2c2d3c", "#45475c", "#8a8da8"], {
    shade: 1,
    edge: false,
  });
  shell.px(3, 2, "#ffd27a");
  shell.outline(OUTLINE);
  add(scene, TEX.shell, shell);
  const puddle = new Pix(44, 14, 1);
  puddle.fill(ellipse(22, 7, 21, 6), "#1a101088");
  puddle.fill(ellipse(22, 7, 17, 4), "#2a141088");
  for (const [x, y] of [
    [12, 6],
    [24, 5],
    [32, 8],
    [18, 9],
  ] as const) {
    puddle.px(x, y, "#f08a28");
    puddle.px(x + 1, y - 1, "#ffd27a");
  }
  add(scene, TEX.puddle, puddle);
  const drop = new Pix(3, 5, 1);
  drop.fill(rect(0, 0, 3, 5), "#1a1010");
  drop.px(1, 4, "#f08a28");
  add(scene, TEX.drop, drop);
  const pip = new Pix(5, 5, 1);
  pip.fill(rect(0, 0, 5, 5), OUTLINE);
  pip.fill(rect(1, 1, 3, 3), GOLD[2]);
  pip.px(1, 1, GOLD[3]);
  add(scene, TEX.pip, pip);
  // Warnung am Bildrand: roter Pfeil, zeigt nach rechts (wird gedreht)
  const warning = new Pix(18, 18, 1);
  warning.shape(poly(2, 1, 16, 9, 2, 17, 6, 9), ["#3c0e12", "#8e2028", "#ff4a3a", "#ffb0a0"], {
    shade: 1,
  });
  warning.outline(OUTLINE);
  add(scene, TEX.warning, warning);

  // Routenkarte und Ruinen
  for (const type of [
    "start",
    "ruine",
    "oase",
    "haendler",
    "schrott",
    "sturm",
    "ereignis",
    "boss",
    "station",
  ] as const) {
    add(scene, nodeKey(type), paintNodeIcon(type));
  }
  add(scene, TEX.fortIcon, paintFortIcon());
  // Drohne der Funkerin: kleiner Rumpf mit zwei Rotoren und Leuchtauge
  const drone = new Pix(14, 8, 2);
  drone.fill(rect(0, 1, 5, 1), "#a8aec0");
  drone.fill(rect(9, 1, 5, 1), "#a8aec0");
  drone.shape(rect(3, 2, 8, 5), STEEL, { shade: 1 });
  drone.px(7, 4, "#5ff2e0");
  drone.px(6, 4, "#d0fff8");
  drone.outline(OUTLINE);
  add(scene, TEX.drone, drone);
  add(scene, TEX.chest, paintChest(false));
  add(scene, TEX.chestOpen, paintChest(true));
  addFog(scene);

  const arrow = new Pix(15, 12, 1);
  arrow.shape(
    poly(7.5, 0, 15, 8, 10, 8, 10, 12, 5, 12, 5, 8, 0, 8),
    ["#0e2a2c", "#1f8f96", "#5ff2e0", "#d0fff8"],
    { shade: 1, edge: false },
  );
  arrow.outline(OUTLINE);
  add(scene, TEX.arrow, arrow);
}
