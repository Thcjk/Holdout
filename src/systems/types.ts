/**
 * Reine Datentypen der Simulation.
 *
 * Wichtig: In dieser Datei - und in allen anderen Dateien unter `systems/` -
 * darf nichts aus Phaser vorkommen. Die Simulation muss ohne Bildschirm laufen
 * koennen, weil im Koop der Host sie fuer alle rechnet und weil sie sich sonst
 * nicht testen laesst.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Achsenparalleles Rechteck. `x`/`y` ist die linke obere Ecke. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Eingabe eines Spielers fuer einen Tick - bewusst geraeteunabhaengig.
 * Tastatur, Touch-Joystick und (ab Phase 6) das Netzwerk liefern alle dieses
 * eine Format, damit die Simulation nicht wissen muss, woher die Eingabe kommt.
 */
export interface InputState {
  /** Normalisierter Richtungsvektor der Bewegung, Laenge 0 oder 1. */
  move: Vec2;
}

export function emptyInput(): InputState {
  return { move: { x: 0, y: 0 } };
}

export interface PlayerState {
  id: string;
  /** Mittelpunkt. */
  position: Vec2;
  velocity: Vec2;
  radius: number;
}

export interface WorldState {
  /** Fortlaufende Nummer des Simulationsschritts. */
  tick: number;
  players: PlayerState[];
  /** Alles, was Bewegung blockiert: Aussenmauern und Deckungsbloecke. */
  walls: Rect[];
  bounds: Rect;
}
