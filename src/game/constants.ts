/**
 * Feste Zahlen des Spielkerns. Wie sich etwas anfuehlt, steht in `data/`.
 */

/** Die Arena in Spieleinheiten. Sie passt in jede Entwurfsflaeche (Hoehe 540). */
export const ARENA = {
  width: 900,
  height: 440,
};

/** Fester Zeitschritt: 60 Schritte pro Sekunde, auf jedem Geraet gleich. */
export const TICK = 1 / 60;
export const TICK_MS = 1000 / 60;
/** Nach einem Haenger wird hoechstens so viel nachgerechnet (gegen die Todesspirale). */
export const MAX_TICKS_PER_FRAME = 6;

export const PLAYER_RADIUS = 12;
export const PLAYER_SPEED = 210;
/** Unverwundbar nach einem Treffer, in Sekunden. */
export const PLAYER_IFRAMES = 0.45;
/** Material wird eingesammelt, sobald es so nah ist. */
export const PICKUP_RADIUS = 34;
/** Und von hier an zieht es zum Spieler. */
export const MAGNET_RADIUS = 110;

/** So viele Gegner stehen hoechstens gleichzeitig in der Arena. */
export const MAX_ENEMIES = 90;

/** Wie lange das Kreuz vor dem Erscheinen eines Gegners am Boden liegt. */
export const SPAWN_MARKER_TIME = 0.9;

export const SHOP_SLOTS = 4;

/** Wie viele Spieler hoechstens in einem Raum sind. */
export const MAX_PLAYERS = 4;
