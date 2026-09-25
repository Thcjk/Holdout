/**
 * ALLE 3D-Modelle: Dateien, Zuordnung zu Rollen, Groessen.
 *
 * Wie `config/assets.ts` fuer die Pixel-Sprites: Im Spielcode steht nur
 * `CHARACTER_LOOKS.scout`, nie ein Dateiname. Wer eine Haut oder ein Modell
 * tauscht, aendert diese Datei und sonst nichts.
 *
 * ================================================================
 * WOHER DIE DATEIEN KOMMEN
 * ================================================================
 *
 * Das hochgeladene Kenney-Paket hatte KEINE GLB-Dateien: Figuren und
 * Animationen nur als Blender-Dateien, Kisten und Waffen als FBX. Umgewandelt
 * hat `tools/convert-models.py` (Blender als Python-Modul), die Haeute
 * `tools/rasterize-skins.mjs`. Beides einmalig beim Entwickeln; hier liegen
 * nur die Ergebnisse unter `public/models/`.
 *
 * ================================================================
 * EIN KOERPER, VIELE HAEUTE
 * ================================================================
 *
 * Kenneys "Animated Characters" ist EIN Menschmodell in vier Statur-
 * Varianten mit gemeinsamem Skelett. Das Aussehen macht die Haut - eine
 * Textur, die ueber das Modell gelegt wird. Deshalb gibt es hier keine
 * "Zombie-Datei": Ein Zombie ist der kleine Koerper mit der Zombie-Haut.
 * Alle Animationen passen auf alle Koerper, weil die Knochen gleich heissen.
 */

import type { CharacterId, EnemyType } from "../systems/types";

const BASE = `${import.meta.env.BASE_URL}models/`;

export type BodyId = "medium" | "small" | "largeMale" | "largeFemale";
export type ClipId = "idle" | "run" | "walk" | "shoot" | "death" | "punch";

export const BODY_URLS: Record<BodyId, string> = {
  medium: `${BASE}body-medium.glb`,
  small: `${BASE}body-small.glb`,
  largeMale: `${BASE}body-large-male.glb`,
  largeFemale: `${BASE}body-large-female.glb`,
};

export const CLIP_URLS: Record<ClipId, string> = {
  idle: `${BASE}anim-idle.glb`,
  run: `${BASE}anim-run.glb`,
  walk: `${BASE}anim-walk.glb`,
  shoot: `${BASE}anim-shoot.glb`,
  death: `${BASE}anim-death.glb`,
  punch: `${BASE}anim-punch.glb`,
};

export function skinUrl(skin: string): string {
  return `${BASE}skins/${skin}.png`;
}

/** Wie eine Figur aussieht und sich bewegt. */
export interface FigureLook {
  body: BodyId;
  /** Dateiname der Haut ohne Endung, siehe `public/models/skins/`. */
  skin: string;
  /** Animation beim Laufen: Laeufer rennen, Brocken stapfen. */
  moveClip: ClipId;
  /** Tempo, bei dem die Laufanimation genau zum Boden passt (Pixel/s). */
  moveClipSpeed: number;
  /**
   * Waffe, die die Figur immer in der Hand haelt (Katalog-ID, siehe
   * `HELD_WEAPONS`). Nur fuer Gegner - Spieler halten, was sie ausgeruestet
   * haben.
   */
  weapon?: string;
}

/**
 * Die drei Spielfiguren. Die Farbfamilien entsprechen denen der Pixel-
 * Figuren (Scout blau, Tank orange, Sniper gruen) - so erkennt man sie
 * wieder, und im Koop unterscheidet man sie auf einen Blick.
 */
export const CHARACTER_LOOKS: Record<CharacterId, FigureLook> = {
  scout: { body: "medium", skin: "athleteMaleBlue", moveClip: "run", moveClipSpeed: 250 },
  tank: { body: "largeMale", skin: "racerOrangeMale", moveClip: "run", moveClipSpeed: 220 },
  sniper: { body: "largeFemale", skin: "militaryFemaleA", moveClip: "run", moveClipSpeed: 230 },
};

/**
 * Die Gegner. Das Paket hat keine eigenen Gegnermodelle - dieselben Koerper
 * mit Zombie-Haut. Unterschieden wird wie bei den Pixel-Figuren ueber
 * Statur, Farbe und Bewegung: Der Laeufer ist klein und rennt, der Brocken
 * gross und stapft, der Schuetze mittel. Der Boss traegt als einziger keine
 * Zombie-Haut, sondern die des Cyborgs.
 */
export const ENEMY_LOOKS: Record<EnemyType, FigureLook> = {
  runner: { body: "small", skin: "zombieA", moveClip: "run", moveClipSpeed: 200 },
  brute: { body: "largeMale", skin: "zombieB", moveClip: "walk", moveClipSpeed: 70 },
  shooter: { body: "medium", skin: "zombieC", moveClip: "walk", moveClipSpeed: 110, weapon: "smg" },
  boss: { body: "largeMale", skin: "cyborg", moveClip: "walk", moveClipSpeed: 90, weapon: "railgun" },
};

/**
 * Figurenhoehe je Meter Trefferdurchmesser.
 *
 * Die Hoehe folgt aus dem Trefferkreis der Simulation, nicht aus dem Modell:
 * Spieler (Durchmesser 0,75 m) werden 1,65 m hoch - dieselbe Hoehe wie die
 * Platzhalter-Kapsel, an der die Massstab-Regel (5-7 % der Bildhoehe)
 * gemessen ist. Ein Brocken mit dickerem Trefferkreis wird automatisch
 * groesser, der Ende-Boss (doppelter Radius) doppelt so gross.
 */
export const FIGURE_HEIGHT_PER_DIAMETER = 2.2;

/** Requisiten aus dem Blaster Kit. */
export const PROP_URLS = {
  crateSmall: `${BASE}crate-small.glb`,
  crateMedium: `${BASE}crate-medium.glb`,
  crateWide: `${BASE}crate-wide.glb`,
  target: `${BASE}deco-target.glb`,
  smoke: `${BASE}deco-smoke.glb`,
} as const;
export type PropId = keyof typeof PROP_URLS;

/**
 * Beute am Boden: welches Modell je Gegenstand.
 *
 * Nur wo das Paket etwas Passendes hat. Fuer Energiezelle, Platine,
 * Reaktorkern, Kabel, Verband und Medipack gibt es kein 3D-Modell - dort
 * zeigt die Welt als Uebergang das Pixel-Symbol aus dem Rucksack
 * (`ITEM_TILES`) als Aufsteller ueber dem Boden.
 */
export const ITEM_MODEL_URLS: Partial<Record<string, string>> = {
  pistol: `${BASE}loot-pistol.glb`,
  smg: `${BASE}loot-smg.glb`,
  rifle: `${BASE}loot-rifle.glb`,
  railgun: `${BASE}loot-railgun.glb`,
  ammoBox: `${BASE}loot-ammo.glb`,
  scrap: `${BASE}loot-scrap.glb`,
};

/** Laengste Kante eines Beute-Modells am Boden, in Metern. */
export const ITEM_MODEL_SIZE = 0.7;

/**
 * Waffen in der Hand: dieselben Blaster-Modelle wie am Boden, aber in
 * Handgroesse. `length` ist die Laenge fuer eine 1,65-m-Figur
 * (`HELD_REFERENCE_HEIGHT`) - groessere Figuren (Brocken, Ende-Boss) halten
 * entsprechend groessere Waffen.
 *
 * Laenger als in echt, und das mit Absicht: Von oben aus 30 m Abstand ist
 * eine 25-cm-Pistole ein Punkt. Die Waffe soll man erkennen, nicht
 * nachmessen.
 */
export interface HeldWeaponSpec {
  url: string;
  length: number;
}

export const HELD_WEAPONS: Partial<Record<string, HeldWeaponSpec>> = {
  pistol: { url: `${BASE}loot-pistol.glb`, length: 0.42 },
  smg: { url: `${BASE}loot-smg.glb`, length: 0.55 },
  rifle: { url: `${BASE}loot-rifle.glb`, length: 0.85 },
  railgun: { url: `${BASE}loot-railgun.glb`, length: 0.9 },
};

/** Figurenhoehe, fuer die `HELD_WEAPONS[].length` gilt. */
export const HELD_REFERENCE_HEIGHT = 1.65;

/**
 * In welche Richtung (entlang der laengsten Achse) die Blaster-Modelle
 * zeigen: +1 heisst, die Muendung liegt am positiven Ende. Alle Blaster des
 * Pakets sind gleich ausgerichtet: Die Muendung liegt bei -z, der Griff
 * hinten bei +z - im Bild nachgesehen (mit +1 hing der Griff vorn).
 */
export const HELD_MUZZLE_SIGN = -1;
