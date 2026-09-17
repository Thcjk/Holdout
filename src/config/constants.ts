/**
 * Technische Konstanten: Bildschirm, Arena, Zeittakt, Zeichenebenen, Farben.
 *
 * Abgrenzung zu `balance.ts`: Hier steht, wie das Spiel technisch aufgebaut ist.
 * Dort steht, wie es sich anfuehlt. Spielwerte (Tempo, Schaden, Leben) gehoeren
 * ausschliesslich nach `balance.ts`.
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
} as const;

/**
 * Fester Zeitschritt der Simulation: 30 Ticks pro Sekunde.
 *
 * Warum fest? Bei variablem Zeitschritt rechnet ein schnelles Handy andere
 * Ergebnisse als ein langsames. Im Koop wuerden die Spielstaende auseinanderdriften.
 * Gezeichnet wird trotzdem mit 60 fps, dazwischen wird interpoliert (siehe Simulation.ts).
 */
export const TICK_RATE = 30;
export const TICK_SECONDS = 1 / TICK_RATE;
export const TICK_MS = 1000 / TICK_RATE;

/**
 * Obergrenze an Simulationsschritten pro gezeichnetem Bild. Verhindert die
 * "Todesspirale": Nach einem langen Hänger (Tab im Hintergrund, Telefonanruf)
 * wuerde das Spiel sonst hunderte Ticks am Stueck nachrechnen und noch laenger haengen.
 */
export const MAX_TICKS_PER_FRAME = 5;

/** Zeichenreihenfolge. Hoehere Zahl liegt weiter vorne. */
export const DEPTH = {
  floor: 0,
  walls: 10,
  players: 30,
  hud: 100,
} as const;

/** Platzhalter-Farbpalette (Phase 1-3). Kraeftig und klar unterscheidbar. */
export const COLORS = {
  background: 0x11161f,
  floor: 0x1e2734,
  floorGrid: 0x263243,
  wall: 0x46536b,
  wallEdge: 0x5f7191,
  player: 0x4cc2ff,
  playerOutline: 0xe8f6ff,
} as const;
