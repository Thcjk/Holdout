/**
 * Solo spielen: die Simulation laeuft direkt auf diesem Geraet.
 *
 * Das ist der einfachste Fall und gleichzeitig der Rueckfall, wenn keine
 * Verbindung zustande kommt - der Solo-Modus geht immer.
 */

import { Simulation } from "../systems/Simulation";
import type { PlayerSetup } from "../systems/world";
import type { InputState } from "../systems/types";
import type { GameSession, WorldView } from "./GameSession";
import { FORCED_SEED } from "../platform/debugFlags";

export class SoloSession implements GameSession {
  readonly selfId: string;
  readonly connectionLost = null;
  /** Solo laeuft die Simulation auf diesem Geraet - Anhalten stoert niemanden. */
  readonly canPause = true;
  private readonly simulation: Simulation;
  private readonly inputs = new Map<string, InputState>();

  constructor(setup: PlayerSetup, seed = FORCED_SEED ?? Date.now() & 0x7fffffff) {
    this.selfId = setup.id;
    this.simulation = new Simulation([setup], seed);
  }

  get view(): WorldView {
    return this.simulation;
  }

  update(deltaMs: number, input: InputState): boolean {
    this.inputs.set(this.selfId, input);
    return this.simulation.advance(deltaMs, this.inputs) > 0;
  }

  release(): null {
    return null;
  }

  destroy(): void {
    // Nichts freizugeben - die Simulation ist reiner Speicher.
  }
}
