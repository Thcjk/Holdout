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
import type { PlayerSetup, WorldPlace } from "./world";
import type { WorldView } from "../net/GameSession";
import type { GameEvent, InputState, Vec2, WorldState } from "./types";

/** Ein Schluessel je Objekt, damit Spieler und Gegner sich nicht in die Quere kommen. */
function playerKey(id: string): string {
  return `p:${id}`;
}

function enemyKey(id: number): string {
  return `e:${id}`;
}

export class Simulation implements WorldView {
  readonly state: WorldState;

  /** Noch nicht in Ticks umgesetzte Zeit, in Millisekunden. */
  private accumulator = 0;

  /** Positionen vor dem zuletzt gerechneten Tick - die Basis der Interpolation. */
  private readonly previousPositions = new Map<string, Vec2>();

  /** Ereignisse aller Ticks dieses Bildes, gesammelt fuer die Darstellung. */
  private readonly frameEvents: GameEvent[] = [];

  constructor(setups: readonly PlayerSetup[], seed = 1, where: WorldPlace = "open") {
    this.state = createWorld(setups, seed, where);
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
    this.frameEvents.length = 0;

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
      for (const event of this.state.events) {
        this.frameEvents.push(event);
      }
      this.accumulator -= TICK_MS;
      ticks += 1;
    }

    // Fliesskomma-Reste von den Subtraktionen oben abschneiden.
    if (this.accumulator < 0) {
      this.accumulator = 0;
    }

    return ticks;
  }

  get pendingCount(): number {
    return this.state.pendingSpawns.length;
  }

  /** Alle Ereignisse, die seit dem letzten Bild passiert sind. */
  get events(): readonly GameEvent[] {
    return this.frameEvents;
  }

  /** Fortschritt zum naechsten Tick, 0 bis 1. */
  get alpha(): number {
    const value = this.accumulator / TICK_MS;
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  /** Position eines Spielers, weich zwischen zwei Ticks. */
  renderPlayerPosition(playerId: string): Vec2 {
    const player = this.state.players.find((entry) => entry.id === playerId);
    if (!player) {
      return { x: 0, y: 0 };
    }
    return this.interpolate(playerKey(playerId), player.position);
  }

  /** Position eines Gegners, weich zwischen zwei Ticks. */
  renderEnemyPosition(enemyId: number, current: Vec2): Vec2 {
    return this.interpolate(enemyKey(enemyId), current);
  }

  /**
   * Projektile werden nicht interpoliert, sondern anhand ihrer Geschwindigkeit
   * vorausberechnet: Sie fliegen geradlinig, und ein Nachlaufen waere sichtbar.
   */
  renderProjectilePosition(position: Vec2, velocity: Vec2): Vec2 {
    const t = this.alpha * TICK_SECONDS;
    return { x: position.x + velocity.x * t, y: position.y + velocity.y * t };
  }

  private interpolate(key: string, current: Vec2): Vec2 {
    const previous = this.previousPositions.get(key);
    if (!previous) {
      return { x: current.x, y: current.y };
    }
    const t = this.alpha;
    return {
      x: previous.x + (current.x - previous.x) * t,
      y: previous.y + (current.y - previous.y) * t,
    };
  }

  private snapshotPositions(): void {
    for (const player of this.state.players) {
      this.store(playerKey(player.id), player.position);
    }
    for (const enemy of this.state.enemies) {
      this.store(enemyKey(enemy.id), enemy.position);
    }
  }

  private store(key: string, position: Vec2): void {
    const stored = this.previousPositions.get(key);
    if (stored) {
      stored.x = position.x;
      stored.y = position.y;
    } else {
      this.previousPositions.set(key, { x: position.x, y: position.y });
    }
  }
}
