/**
 * Technische Konstanten: Bildschirm, Arena, Zeittakt, Zeichenebenen, Farben.
 *
 * Abgrenzung zu `balance.ts`: Hier steht, wie das Spiel technisch aufgebaut ist.
 * Dort steht, wie es sich anfuehlt.
 */

/** Groesse des Spielfelds in Pixeln (Briefing, Abschnitt 2 "Kennzahlen"). */
export const ARENA = {
  width: 1600,
  height: 1200,
} as const;

/**
 * Aufloesung der Zeichenflaeche. Phaser skaliert diese Groesse per "Scale Manager"
 * auf den echten Bildschirm (Modus FIT), deshalb ist sie unabhaengig vom Geraet.
 * Querformat, weil das Spiel auf dem Handy quer gespielt wird.
 */
export const VIEWPORT = {
  width: 960,
  height: 540,
};

/**
 * Passt die Entwurfsaufloesung an das Seitenverhaeltnis des Geraets an.
 *
 * WARUM UEBERHAUPT: Die feste Aufloesung 960x540 ist 16:9. Ein iPhone im
 * Querformat ist eher 19,5:9 - im Modus FIT blieben links und rechts je rund
 * 75 Pixel schwarz. Das Spiel sass in einem Briefkasten mitten auf dem
 * Bildschirm.
 *
 * Die Hoehe bleibt fest bei 540, die Breite folgt dem Bildschirm. Damit passt
 * FIT genau auf, ohne Balken - und ohne etwas abzuschneiden.
 *
 * Die Grenzen sind Absicht: Ohne sie saehe ein Spieler auf einem sehr breiten
 * Handy deutlich mehr von der Arena als einer auf einem schmalen, und im Koop
 * waere das ein echter Vorteil. Zwischen 960 und 1280 ist der Unterschied
 * hoechstens ein Drittel mehr Breite.
 *
 * MUSS VOR DEM ERSTEN `new Phaser.Game` LAUFEN: Szenen und Bedienelemente
 * lesen diese Werte, wenn sie gebaut werden.
 */
export function fitViewportToScreen(screenWidth: number, screenHeight: number): void {
  if (screenWidth <= 0 || screenHeight <= 0) {
    return;
  }

  // Im Hochformat nicht umstellen: Dort waere die abgeleitete Breite winzig und
  // das Spiel unspielbar schmal. Das Hochformat zeigt ohnehin nur den Hinweis,
  // das Handy quer zu halten.
  if (screenHeight > screenWidth) {
    return;
  }

  const aspect = screenWidth / screenHeight;
  const width = Math.round(VIEWPORT.height * aspect);
  VIEWPORT.width = Math.min(1280, Math.max(960, width));
}

/**
 * Fester Zeitschritt der Simulation: 30 Ticks pro Sekunde.
 *
 * Warum fest? Bei variablem Zeitschritt rechnet ein schnelles Handy andere
 * Ergebnisse als ein langsames. Im Koop wuerden die Spielstaende auseinanderdriften.
 */
export const TICK_RATE = 30;
export const TICK_SECONDS = 1 / TICK_RATE;
export const TICK_MS = 1000 / TICK_RATE;

/**
 * Obergrenze an Simulationsschritten pro gezeichnetem Bild. Verhindert die
 * "Todesspirale": Nach einem langen Haenger wuerde das Spiel sonst hunderte
 * Ticks am Stueck nachrechnen und noch laenger haengen.
 */
export const MAX_TICKS_PER_FRAME = 5;

/** Zeichenreihenfolge. Hoehere Zahl liegt weiter vorne. */
export const DEPTH = {
  floor: 0,
  bushesBelow: 5,
  walls: 10,
  spawnWarning: 12,
  projectiles: 20,
  enemies: 25,
  players: 30,
  bushesAbove: 35,
  particles: 40,
  damageNumbers: 50,
  hud: 100,
} as const;

/** Kamera: folgt allen lebenden Spielern und zoomt je nach Abstand heraus. */
export const CAMERA = {
  /** Zoom bei einem einzelnen Spieler. */
  maxZoom: 1.0,
  /** Weitester Zoom, wenn die Gruppe auseinanderlaeuft. */
  minZoom: 0.62,
  /** Rand um die Spielergruppe in Pixeln, damit niemand am Bildschirmrand klebt. */
  padding: 260,
  /** Wie schnell der Zoom nachzieht (0 bis 1 pro Bild). */
  zoomLerp: 0.06,
  /** Traegheit der Kamerafolge. 1 waere hart angeheftet. */
  followLerp: 0.12,
} as const;

/**
 * Touch-Steuerung.
 *
 * Links ein schwebender Joystick - er erscheint dort, wo der Daumen die linke
 * Bildschirmhaelfte beruehrt. Rechts dagegen alles an FESTER Stelle: Der
 * Schussknopf muss blind zu finden sein, und ein Knopf, der jedes Mal woanders
 * auftaucht, ist genau das nicht.
 */
export const TOUCH = {
  /** Radius des Bewegungs-Joysticks in Bildschirmpixeln. */
  stickRadius: 78,
  /** Radius des Daumenknopfs. */
  knobRadius: 32,
  /** Tote Zone, damit ein zitternder Daumen die Figur nicht ruckeln laesst. */
  deadZone: 10,

  /** Fester Schussknopf unten rechts: Halten feuert, Ziehen zielt. */
  fireButton: {
    /** Abstand des Mittelpunkts von der rechten unteren Ecke. */
    marginX: 112,
    marginY: 112,
    /** Sichtbarer Radius. */
    radius: 66,
    /** Trefferbereich - grosszuegiger als das Bild, Daumen sind ungenau. */
    hitRadius: 92,
    /** Ab dieser Zugstrecke gilt die Beruehrung als Zielen statt als Halten. */
    aimDeadZone: 14,
    /** Zugstrecke, ab der die Reichweitenanzeige voll ausschlaegt. */
    aimRange: 92,
    /** Bis zu dieser Dauer gilt eine Beruehrung als Antippen, nicht als Halten. */
    tapMaxMs: 150,
    /** Bis zu dieser Strecke gilt sie als Antippen, nicht als Ziehen. */
    tapMaxMove: 15,
  },

  /** Super-Knopf, ebenfalls fest, links neben dem Schussknopf. */
  superButton: {
    marginX: 246,
    marginY: 64,
    radius: 44,
    hitRadius: 60,
  },
} as const;

/** Farbpalette. Lesbarkeit auf kleinem Bildschirm geht vor Schoenheit. */
export const COLORS = {
  background: 0x11161f,
  floor: 0x1e2734,
  floorGrid: 0x263243,
  wall: 0x46536b,
  wallEdge: 0x5f7191,
  bush: 0x2f6b46,
  bushEdge: 0x47935f,
  player: 0x4cc2ff,
  playerOutline: 0xe8f6ff,
  playerDown: 0x4a5a70,
  mate: 0x7ee08a,
  playerBullet: 0xfff2a8,
  enemyBullet: 0xff7a5c,
  runner: 0xff6b4a,
  brute: 0xc94f7c,
  shooter: 0xffa62b,
  enemyOutline: 0x2a1720,
  marked: 0xffe066,
  damageText: 0xfff2a8,
  critText: 0xffd166,
  hudText: 0xdce8f7,
  hudDim: 0x8ea6c4,
  danger: 0xff5470,
  superReady: 0xffd166,
} as const;
