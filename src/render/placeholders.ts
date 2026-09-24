/**
 * Platzhalter-Formen und -Farben fuer die 3D-Welt.
 *
 * NUR BIS DIE GLB-MODELLE DA SIND. Dann ersetzt ein Modell die Kapsel, und
 * diese Datei schrumpft auf das, was ein Modell nicht mitbringt (Groesse,
 * Farbe fuer Team-Markierungen). Deshalb steht alles an einer Stelle: Wer die
 * Modelle einbaut, tauscht hier, nicht in `EntityView`.
 *
 * Die Masse sind aus der Simulation abgeleitet, nicht geschaetzt: Der
 * Durchmesser jeder Form ist der Trefferkreis. Was man sieht, ist das, was
 * getroffen wird - dieselbe Regel wie beim 2D-Sprite (`SPRITE_BODY_RADIUS`).
 */

import { PLAYER } from "../config/balance";
import { COLORS } from "../config/constants";
import type { CharacterId, EnemyType } from "../systems/types";
import { meters } from "./space3d";

/**
 * Spielfigur: Kapsel. Radius = Trefferradius (18 px = 0,375 m), Gesamthoehe
 * 1,65 m - ein Mensch mit leicht gebeugten Knien, wie in Top-down-Spielen
 * ueblich.
 */
export const PLAYER_SHAPE = {
  radius: meters(PLAYER.radius),
  height: 1.65,
};

/**
 * Charakterfarben - dieselben Farbfamilien wie die Kenney-Figuren in 2D
 * (Scout blau, Tank orange, Sniper gruen), damit man sie beim Umschalten
 * wiedererkennt.
 */
export const CHARACTER_COLORS: Record<CharacterId, number> = {
  scout: 0x3f8cff,
  tank: 0xf28c28,
  sniper: 0x4fa84a,
};

/** Farbe einer Figur am Boden - grau, wie die 2D-Darstellung (`playerDown`). */
export const DOWN_COLOR = COLORS.playerDown;

/** Gegnerfarben aus der Palette; der Boss ist violett wie sein Sprite. */
export const ENEMY_COLORS: Record<EnemyType, number> = {
  runner: COLORS.runner,
  brute: COLORS.brute,
  shooter: COLORS.shooter,
  boss: 0x8e5bd6,
};

/**
 * Hoehe eines Gegnerquaders zu seinem Durchmesser (Meter). Mindestens einen
 * Meter, sonst verschwindet ein Laeufer hinter jeder Deckung.
 */
export function enemyHeight(diameter: number): number {
  return Math.max(1, diameter * 1.3);
}

/** Wandhoehen in Metern, nach Art der Wand. */
export const WALL_HEIGHT = {
  /** Aussenmauer: hoch genug, dass man nicht an "drueber hinweg" denkt. */
  outer: 3,
  /** Hauswand. */
  building: 2.4,
  /** Deckung: halbhoch - man sieht dahinter noch Koepfe. */
  cover: 1.2,
  /** Busch: knapp unter der Figur, damit man sie darin noch ahnt. */
  bush: 0.9,
} as const;

export const WALL_COLORS = {
  /** Aussenmauer: Bruchstein. */
  outer: 0x7d766a,
  /** Hauswand: heller Putz. */
  building: 0xd9b784,
  cover: 0x8a8f99,
  bush: 0x3f8f4f,
} as const;

/** Mauerkrone obendrauf - nur Haus- und Aussenwaende haben eine. */
export const WALL_CAP_COLORS: Partial<Record<keyof typeof WALL_COLORS, number>> = {
  outer: 0x5e584e,
  building: 0xa5533a,
};

