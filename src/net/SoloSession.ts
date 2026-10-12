/**
 * Allein spielen: Die Simulation laeuft direkt auf diesem Geraet.
 */

import { Simulation } from "../game/Simulation";
import type { Command, GameEvent, PlayerInput, PlayerSetup } from "../game/types";
import type { GameSession, GameView } from "./GameSession";

export class SoloSession implements GameSession {
  readonly selfId: string;
  readonly canPause = true;
  readonly isMultiplayer = false;
  readonly connectionLost = null;
  readonly isReady = true;

  private readonly simulation: Simulation;
  private events: GameEvent[] = [];

  constructor(setup: PlayerSetup, seed: number) {
    this.selfId = setup.id;
    this.simulation = new Simulation([setup], seed);
  }

  get view(): GameView {
    return { state: this.simulation.state, events: this.events };
  }

  update(deltaMs: number, input: PlayerInput): void {
    this.simulation.advance(deltaMs, new Map([[this.selfId, input]]));
    this.events = this.simulation.events;
  }

  send(command: Command): void {
    this.simulation.command(this.selfId, command);
  }

  selfPosition(): null {
    return null;
  }

  destroy(): void {}
}
