/**
 * Fester Zeitschritt mit Interpolation.
 *
 * Problem: Der Bildschirm zeichnet mit 60 fps (oder 45, oder 120 - je nach Geraet),
 * die Simulation soll aber immer exakt 30 Mal pro Sekunde rechnen.
 *
 * Loesung: Die vergangene Zeit wird in einem "Akkumulator" gesammelt. Immer wenn
 * darin eine volle Tickdauer steckt, wird ein Simulationsschritt gerechnet. Der
 * Rest bleibt liegen und ergibt `alpha`, einen Wert zwischen 0 und 1: "Wir sind
 * 40 % auf dem Weg zum naechsten Tick." Gezeichnet wird zwischen der Position vor
 * und nach dem letzten Tick - sonst wuerde die Figur mit 30 Hz sichtbar ruckeln.
 */

import { MAX_TICKS_PER_FRAME, TICK_MS, TICK_SECONDS } from "../config/constants";
import { createWorld, stepWorld } from "./world";
import type { InputState, Vec2, WorldState } from "./types";

export class Simulation {
  readonly state: WorldState;

  /** Noch nicht in Ticks umgesetzte Zeit, in Millisekunden. */
  private accumulator = 0;

  /** Positionen vor dem zuletzt gerechneten Tick - die Basis der Interpolation. */
  private readonly previousPositions = new Map<string, Vec2>();

  constructor(playerIds: readonly string[]) {
    this.state = createWorld(playerIds);
    this.snapshotPositions();
  }

  /**
   * Laesst so viele Ticks laufen, wie in die vergangene Zeit passen.
   *
   * @param deltaMs Seit dem letzten Bild vergangene Zeit in Millisekunden.
   * @returns Anzahl tatsaechlich gerechneter Ticks.
   */
  advance(deltaMs: number, inputs: ReadonlyMap<string, InputState>): number {
    this.accumulator += deltaMs;

    let ticks = 0;
    while (this.accumulator >= TICK_MS) {
      if (ticks >= MAX_TICKS_PER_FRAME) {
        // Nach einem langen Haenger (Tab im Hintergrund, Telefonanruf) wird die
        // uebrige Zeit verworfen, statt sie nachzurechnen. Sonst haengt das Spiel
        // nach der Unterbrechung noch laenger - die "Todesspirale".
        this.accumulator = 0;
        break;
      }

      this.snapshotPositions();
      stepWorld(this.state, inputs, TICK_SECONDS);
      this.accumulator -= TICK_MS;
      ticks += 1;
    }

    // Fliesskomma-Reste von den Subtraktionen oben abschneiden.
    if (this.accumulator < 0) {
      this.accumulator = 0;
    }

    return ticks;
  }

  /** Fortschritt zum naechsten Tick, 0 bis 1. */
  get alpha(): number {
    const value = this.accumulator / TICK_MS;
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  /** Position, die gezeichnet werden soll: weich zwischen zwei Ticks. */
  renderPosition(playerId: string): Vec2 {
    const player = this.state.players.find((entry) => entry.id === playerId);
    if (!player) {
      return { x: 0, y: 0 };
    }

    const previous = this.previousPositions.get(playerId);
    if (!previous) {
      return { x: player.position.x, y: player.position.y };
    }

    const t = this.alpha;
    return {
      x: previous.x + (player.position.x - previous.x) * t,
      y: previous.y + (player.position.y - previous.y) * t,
    };
  }

  private snapshotPositions(): void {
    for (const player of this.state.players) {
      const stored = this.previousPositions.get(player.id);
      if (stored) {
        stored.x = player.position.x;
        stored.y = player.position.y;
      } else {
        this.previousPositions.set(player.id, { x: player.position.x, y: player.position.y });
      }
    }
  }
}
