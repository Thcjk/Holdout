/**
 * Allein spielen: Die Simulation laeuft direkt auf diesem Geraet.
 */

import { Simulation, type SimulationOptions } from "../game/Simulation";
import { addEnemy } from "../game/systems/enemies";
import type {
  Command,
  EnemyType,
  GameEvent,
  GameState,
  PlayerInput,
  PlayerSetup,
} from "../game/types";
import type { GameSession } from "./GameSession";

export class SoloSession implements GameSession {
  readonly selfId: string;
  readonly canPause = true;
  readonly isHost = true;
  readonly isMultiplayer = false;
  readonly isReady = true;
  readonly connectionLost = null;
  private readonly simulation: Simulation;

  constructor(setup: PlayerSetup, seed: number, options: SimulationOptions = {}) {
    this.selfId = setup.id;
    this.simulation = new Simulation([setup], seed, options);
  }

  get state(): GameState {
    return this.simulation.state;
  }

  get events(): readonly GameEvent[] {
    return this.simulation.events;
  }

  update(deltaMs: number, input: PlayerInput): void {
    this.simulation.advance(deltaMs, new Map([[this.selfId, input]]));
  }

  send(command: Command): void {
    this.simulation.command(this.selfId, command);
  }

  /** Nur fuer Tests im Browser (`?debug=werte`): einen Gegner hinstellen. */
  spawnForTest(type: EnemyType, x: number, y: number): void {
    addEnemy(this.simulation, type, x, y, 1);
  }

  destroy(): void {}
}
