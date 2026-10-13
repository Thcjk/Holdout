/**
 * Meldet alle Pixel-Bilder als Phaser-Texturen an - mit HARTEN Pixeln.
 *
 * Phaser glaettet Bilder beim Vergroessern normalerweise (das Spiel laeuft mit
 * `pixelArt: false`, damit Text weich bleibt). Pixel-Art soll aber knackig
 * bleiben: Jede Textur hier bekommt deshalb den Filter NEAREST - beim
 * Vergroessern wird aus einem Pixel ein Block, nichts verschwimmt.
 */

import Phaser from "phaser";
import { arenaKey, characterKey, enemyKey, itemIconKey, weaponIconKey } from "../../config/assets";
import { CHARACTER_IDS } from "../../game/data/characters";
import { ITEMS } from "../../game/data/items";
import { WEAPON_IDS } from "../../game/data/weapons";
import type { EnemyType, StatKey } from "../../game/types";
import { FORGE } from "../../meta/forge";
import { drawEnemyPixels } from "./enemies";
import { paintHero } from "./heroes";
import {
  drawCoin,
  drawCrystal,
  drawEnemyBullet,
  drawHeart,
  drawLock,
  drawRiftMarker,
  drawShotPixels,
  drawStatIcon,
  drawWeaponPixels,
} from "./items";
import { paintLogo } from "./logo";
import type { Pix } from "./pix";
import { paintArenaPixels, paintMenuWorld } from "./world";

export const MENU_BACKGROUND_KEY = "menu-background";
export const ENEMY_TYPES_DRAWN: readonly EnemyType[] = ["grunt", "swarmer", "charger", "spitter", "bruiser", "elite", "boss", "exploder", "splitter"];

/** Textur-Name des Symbols einer Schmiede-Stufe. */
export function forgeIconKey(id: string): string {
  return `forge-${id}`;
}

export function addPixelTexture(scene: Phaser.Scene, key: string, source: Pix | HTMLCanvasElement): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const canvas = source instanceof HTMLCanvasElement ? source : source.toCanvas();
  scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Hauptwert eines Gegenstands (bestimmt sein Symbol). */
function mainStat(mods: Partial<Record<StatKey, number>>): StatKey {
  const keys = Object.keys(mods) as StatKey[];
  return keys.find((key) => (mods[key] ?? 0) > 0) ?? keys[0] ?? "damage";
}

/** Weicher Schatten unter den Figuren (halbdurchsichtige Pixel-Ellipse). */
function shadowCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 6;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(8,6,16,0.45)";
    ctx.fillRect(3, 0, 10, 6);
    ctx.fillRect(1, 1, 14, 4);
    ctx.fillRect(0, 2, 16, 2);
  }
  return canvas;
}

/** Hintergrund hinter der Arena: tiefes Violett-Schwarz. */
function gameBackground(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#120e1c";
    ctx.fillRect(0, 0, 4, 4);
  }
  return canvas;
}

/** Malt alle Pixel-Texturen. Mehrfach aufrufen ist harmlos. */
export function createPixelTextures(scene: Phaser.Scene): void {
  for (const id of CHARACTER_IDS) {
    addPixelTexture(scene, characterKey(id), paintHero(id));
  }
  for (const type of ENEMY_TYPES_DRAWN) {
    addPixelTexture(scene, enemyKey(type), drawEnemyPixels(type));
  }
  for (const id of WEAPON_IDS) {
    addPixelTexture(scene, weaponIconKey(id), drawWeaponPixels(id));
  }
  for (let look = 1; look <= 10; look += 1) {
    addPixelTexture(scene, `shot-${look}`, drawShotPixels(look));
  }
  addPixelTexture(scene, "bullet", drawEnemyBullet());
  addPixelTexture(scene, "gem", drawCoin());
  addPixelTexture(scene, "crystal", drawCrystal());
  addPixelTexture(scene, "heart", drawHeart());
  addPixelTexture(scene, "lock", drawLock());
  addPixelTexture(scene, "marker", drawRiftMarker());
  addPixelTexture(scene, "shadow", shadowCanvas());
  for (const item of ITEMS) {
    addPixelTexture(scene, itemIconKey(item.id), drawStatIcon(mainStat(item.mods)));
  }
  for (const def of FORGE) {
    addPixelTexture(scene, forgeIconKey(def.id), drawStatIcon(def.stat ?? "harvesting"));
  }
  addPixelTexture(scene, arenaKey, paintArenaPixels());
  addPixelTexture(scene, "bg-game", gameBackground());
  addPixelTexture(scene, "logo", paintLogo());
  addPixelTexture(scene, MENU_BACKGROUND_KEY, paintMenuWorld());
}
