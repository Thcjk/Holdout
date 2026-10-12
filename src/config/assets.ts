/**
 * Alle Grafiken und Toene an einer Stelle.
 *
 * Grundlage ist "Topdown Shooter Pixel" von Kenney (CC0, siehe
 * `public/assets/License.txt`): ein Sheet mit 16x16-Kacheln und 1 Pixel
 * Abstand, 34 Spalten. Im Spielcode steht nur `CHARACTER_TILES.soeldner` -
 * nie eine Nummer. Wer das Paket wechselt, aendert diese Datei und sonst nichts.
 *
 * Die Figuren auf dem Sheet schauen nach RECHTS. Spalte 28 ist die Figur ohne
 * Waffe - die Waffen im Spiel werden separat gezeichnet, weil ein Spieler bis
 * zu sechs gleichzeitig traegt.
 */

import type { CharacterId, EnemyType, WeaponId } from "../game/types";

export const SHEET_KEY = "topdown-pixel";
export const SHEET_PATH = `${import.meta.env.BASE_URL}assets/Tilesheet/tilesheet_transparent.png`;

export const TILE = 16;
export const SPACING = 1;
export const COLUMNS = 34;

/** Rechnet Spalte und Reihe in die Kachelnummer um, die Phaser benutzt. */
export function tile(column: number, row: number): number {
  return row * COLUMNS + column;
}

/** Hoehe des Koerpers auf der Kachel in Pixeln (gemessen: 12 von 16). */
export const SPRITE_BODY = 12;

/** Spielfiguren: Spalte 28 (ohne Waffe), die Reihe ist die Farbe. */
export const CHARACTER_TILES: Record<CharacterId, number> = {
  soeldner: tile(28, 5),
  raufbold: tile(28, 2),
  jaeger: tile(28, 3),
  panzer: tile(28, 10),
  glueckspilz: tile(28, 1),
  schatten: tile(28, 4),
};

/** Gegner: dieselbe Menschenfigur in "verwilderten" Farben, unterschieden durch Groesse. */
export const ENEMY_TILES: Record<EnemyType, number> = {
  grunt: tile(28, 7),
  swarmer: tile(28, 6),
  charger: tile(28, 8),
  spitter: tile(28, 9),
  bruiser: tile(28, 14),
  elite: tile(28, 8),
  boss: tile(28, 15),
};

/** Boden: warmer Sand, zwei Varianten fuers Schachbrettmuster. */
export const FLOOR_TILES: readonly number[] = [tile(4, 0), tile(5, 0)];

/** Das schmale Geschoss (liegt waagerecht, zeigt nach rechts). */
export const BULLET_TILE = tile(30, 16);

/** Material, das Gegner fallen lassen: zwei graue Metallstuecke. */
export const MATERIAL_TILE = tile(18, 9);

export function weaponIconKey(id: WeaponId): string {
  return `weapon-${id}`;
}

export function itemIconKey(id: string): string {
  return `item-${id}`;
}

/** Musik: ruhig im Menue, treibend im Gefecht. */
export const MUSIC_MENU = `${import.meta.env.BASE_URL}assets/audio/menu.ogg`;
export const MUSIC_WAVE = `${import.meta.env.BASE_URL}assets/audio/wave.ogg`;

/** Texturen, die beim Start gemalt werden (`ui/comic.ts`): Figuren mit dickem Umriss, Arena. */
export const arenaKey = "arena";
export function characterKey(id: CharacterId): string {
  return `ch-${id}`;
}
export function enemyKey(type: EnemyType): string {
  return `en-${type}`;
}
