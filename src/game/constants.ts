/**
 * Feste Zahlen des Spielkerns. Spielwerte von Mechs und Gegnern stehen in `data/`.
 *
 * Koordinaten: Die Welt ist eine Bodenebene (x nach rechts, y nach unten), in
 * Entwurfspixeln. Die Festung laeuft nach rechts, ihr Deck liegt ELEVATION Pixel
 * ueber dem Boden. Dinge auf dem Deck haben deshalb `z = ELEVATION`; gezeichnet
 * wird jedes Ding bei (x, y - z).
 */

/** Ein Rechenschritt dauert 1/60 Sekunde. */
export const TICK = 1 / 60;

// --- Festung ------------------------------------------------------------------------------

/** Deck: 7 x 4 Felder zu 40 x 32. */
export const TILE_W = 40;
export const TILE_H = 32;
export const DECK_COLS = 7;
export const DECK_ROWS = 4;
export const DECK_W = TILE_W * DECK_COLS;
export const DECK_H = TILE_H * DECK_ROWS;
/** So hoch liegt das Deck ueber dem Boden. */
export const ELEVATION = 72;

/** Schritttempo der Festung in Pixeln pro Sekunde. */
export const FORT_SPEED = 26;
/** Ein ganzer Schrittzyklus eines Beins in Sekunden. */
export const GAIT_PERIOD = 1.8;
/** Anteil des Zyklus, in dem der Fuss auf dem Boden steht. */
export const STANCE = 0.6;
/** So weit hebt sich ein Fuss beim Vorschwingen. */
export const STEP_LIFT = 10;
/** Schaden und Reichweite, wenn ein Fuss aufsetzt. */
export const STOMP_DAMAGE = 40;
export const STOMP_RADIUS = 22;

export const HULL_MAX = 900;

// --- Spielfeld um die Festung -----------------------------------------------------------------

/** So weit hinter der linken Deckkante darf ein Mech zurueckfallen, dann zieht ihn die Seilwinde. */
export const BEHIND = 330;
/** So weit vor der rechten Deckkante darf ein Mech laufen. */
export const AHEAD = 300;
/** Oberer und unterer Rand des Bodens (die Festung steht bei y = 0 bis DECK_H). */
export const GROUND_TOP = -140;
export const GROUND_BOTTOM = 300;

// --- Wechsel zwischen Deck und Boden ------------------------------------------------------------

/** So lange muss man gegen eine Deckkante druecken, bis der Mech abspringt. */
export const EDGE_HOLD = 0.18;
export const JUMP_TIME = 0.42;
export const CLIMB_TIME = 0.75;
export const WINCH_TIME = 0.9;
/** Rumpfschaden, wenn die Seilwinde einen Mech zurueckholt. */
export const WINCH_COST = 25;

/** Strickleiter unter dem Bug (Bodenbereich, relativ zur Festung). */
export const LADDER = { x0: 196, x1: 230, y0: 100, y1: 152 } as const;
/** Wo man nach dem Klettern auf dem Deck steht. */
export const LADDER_TOP = { x: 212, y: 116 } as const;
/** Wo die Seilwinde einen Mech absetzt. */
export const WINCH_LANDING = { x: 22, y: 24 } as const;
/** Wo ein gefallener Mech wieder aufsteht. */
export const RESPAWN_SPOT = { x: 140, y: 112 } as const;
export const RESPAWN_TIME = 5;

// --- Schrott -----------------------------------------------------------------------------------

export const SCRAP_PICKUP = 24;
export const SCRAP_MAGNET = 72;
/** Schrott, der so weit hinter der Festung liegt, ist verloren. */
export const SCRAP_LOST_BEHIND = 520;

// --- Rast --------------------------------------------------------------------------------------

export const REPAIR_AMOUNT = 100;
export const REPAIR_COST = 25;

/** Hoechstens so viele Gegner gleichzeitig. */
export const MAX_ENEMIES = 70;

// --- Ausbau und Angebot --------------------------------------------------------------------------

/** Schrott zum Start: reicht fuer die ersten zwei, drei Module. */
export const START_SCRAP = 60;
/** Fundstuecke an jeder Station. */
export const STATION_BONUS = 15;
/** So viele zufaellige Module bietet jede Rast an. */
export const OFFER_SIZE = 4;
/** Neu wuerfeln kostet erst so viel, dann jedes Mal mehr. */
export const REROLL_COST = 5;
export const REROLL_STEP = 3;

// --- Angriffe ----------------------------------------------------------------------------------------

/** So lange vorher warnt der Bildrand vor einem Trupp. */
export const WARNING_TIME = 2.2;
/** So weit vor dem Bug tauchen Trupps auf, die von vorn kommen. */
export const FRONT_SPAWN = DECK_W + AHEAD + 140;
