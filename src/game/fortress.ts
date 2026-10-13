/**
 * Form der Festung: feste Aufbauten auf dem Deck, die sechs Beine und ihr Gang,
 * Angriffspunkte fuer Gegner und der tote Winkel unter dem Deck.
 *
 * Alle Angaben relativ zur Festung (linke hintere Deckecke = 0,0).
 */

import {
  DECK_H,
  DECK_W,
  FORT_SPEED,
  GAIT_PERIOD,
  STANCE,
  STEP_LIFT,
  TILE_H,
  TILE_W,
} from "./constants";

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Feste Aufbauten auf dem Deck (Feld, Breite, Hoehe in Feldern). */
export interface FixedModule {
  id: "herz" | "bruecke" | "motor";
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export const FIXED_MODULES: readonly FixedModule[] = [
  { id: "motor", col: 0, row: 1, cols: 2, rows: 1 },
  { id: "herz", col: 3, row: 1, cols: 2, rows: 2 },
  { id: "bruecke", col: 6, row: 1, cols: 1, rows: 2 },
];

/** Wo ein Mech auf dem Deck nicht stehen kann (seine Fuesse). */
export const DECK_OBSTACLES: readonly Rect[] = FIXED_MODULES.map((m) => ({
  x0: m.col * TILE_W + 2,
  y0: m.row * TILE_H + 4,
  x1: (m.col + m.cols) * TILE_W - 2,
  y1: (m.row + m.rows) * TILE_H - 2,
}));

/** Begehbarer Bereich des Decks fuer die Fuesse eines Mechs. */
export const DECK_WALK: Rect = { x0: 6, y0: 6, x1: DECK_W - 6, y1: DECK_H - 4 };

export function insideRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/**
 * Toter Winkel: Gegner hier stehen unter dem Deck. Ein Mech oben sieht sie
 * nicht und kann nicht auf sie schiessen.
 */
export const BLIND_SPOT: Rect = { x0: -6, y0: -8, x1: DECK_W + 6, y1: DECK_H - 8 };

// --- Beine ---------------------------------------------------------------------------------

export interface LegSpec {
  /** -1 links (hinten), +1 rechts (vorn in Laufrichtung). */
  side: -1 | 1;
  /** Huefte in Zeichenkoordinaten des Decks. */
  hipX: number;
  hipY: number;
  /** Fuss in Ruhe auf dem Boden. */
  footX: number;
  footY: number;
  /** Zwei Dreiergruppen laufen im Wechsel. */
  group: 0 | 1;
}

export const LEGS: readonly LegSpec[] = [
  { side: -1, hipX: 4, hipY: 18, footX: -60, footY: 22, group: 0 },
  { side: -1, hipX: 4, hipY: 62, footX: -60, footY: 66, group: 1 },
  { side: -1, hipX: 4, hipY: 110, footX: -60, footY: 114, group: 0 },
  { side: 1, hipX: DECK_W - 4, hipY: 18, footX: DECK_W + 60, footY: 22, group: 1 },
  { side: 1, hipX: DECK_W - 4, hipY: 62, footX: DECK_W + 60, footY: 66, group: 0 },
  { side: 1, hipX: DECK_W - 4, hipY: 110, footX: DECK_W + 60, footY: 114, group: 1 },
];

/** Schrittlaenge: genau so weit, wie die Festung laeuft, waehrend ein Fuss steht. */
export const STRIDE = FORT_SPEED * GAIT_PERIOD * STANCE;

/** Stelle im Schrittzyklus (0 bis 1). Unter STANCE steht der Fuss. */
export function legPhase(gait: number, leg: LegSpec): number {
  const t = gait / GAIT_PERIOD + leg.group * 0.5;
  return t - Math.floor(t);
}

/**
 * Lage des Fusses: `dx` gegenueber der Ruhestellung (in Laufrichtung +), `lift` Hoehe.
 * Waehrend der Fuss steht, wandert er relativ zur Festung genau mit deren
 * Tempo nach hinten - so rutscht er auf dem Boden nicht.
 */
export function legPose(phase: number): { dx: number; lift: number } {
  if (phase < STANCE) {
    return { dx: STRIDE / 2 - STRIDE * (phase / STANCE), lift: 0 };
  }
  const u = (phase - STANCE) / (1 - STANCE);
  const eased = u * u * (3 - 2 * u);
  return { dx: -STRIDE / 2 + STRIDE * eased, lift: Math.sin(u * Math.PI) * STEP_LIFT };
}

// --- Angriffspunkte der Gegner ----------------------------------------------------------------

/**
 * Hier hacken Gegner auf die Festung ein: an den Fuessen (dort trifft sie das
 * Stampfen) und am Bauch (dort sieht sie vom Deck aus niemand).
 */
export const ATTACK_SLOTS: readonly { x: number; y: number; belly: boolean }[] = [
  ...LEGS.map((leg) => ({ x: leg.footX + 10, y: leg.footY + 6, belly: false })),
  { x: 60, y: 54, belly: true },
  { x: 140, y: 40, belly: true },
  { x: 220, y: 60, belly: true },
  { x: 100, y: 96, belly: true },
];
