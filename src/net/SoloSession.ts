/**
 * Solo spielen: die Simulation laeuft direkt auf diesem Geraet.
 *
 * Das ist der einfachste Fall und gleichzeitig der Rueckfall, wenn keine
 * Verbindung zustande kommt - der Solo-Modus geht immer.
 */

import { Simulation } from "../systems/Simulation";
import type { PlayerSetup, WorldPlace } from "../systems/world";
import type { InputState, InventoryCommand } from "../systems/types";
import type { GameSession, WorldView } from "./GameSession";
import { FORCED_PLACE, FORCED_SEED } from "../platform/debugFlags";

export class SoloSession implements GameSession {
  readonly selfId: string;
  readonly connectionLost = null;
  /** Solo laeuft die Simulation auf diesem Geraet - Anhalten stoert niemanden. */
  readonly canPause = true;
  private readonly simulation: Simulation;
  private readonly inputs = new Map<string, InputState>();

  constructor(
    setup: PlayerSetup,
    seed = FORCED_SEED ?? Date.now() & 0x7fffffff,
    /** Gebiet aus der Kartenansicht; ohne Angabe per Adresse waehlbar. */
    place: WorldPlace = FORCED_PLACE,
  ) {
    this.selfId = setup.id;
    this.simulation = new Simulation([setup], seed, place);
  }

  get view(): WorldView {
    return this.simulation;
  }

  update(deltaMs: number, input: InputState): boolean {
    this.inputs.set(this.selfId, input);
    return this.simulation.advance(deltaMs, this.inputs) > 0;
  }

  /** Rucksack-Befehl waehrend der Pause - siehe `Simulation.applyInventoryNow`. */
  applyWhilePaused(command: InventoryCommand): void {
    this.simulation.applyInventoryNow(this.selfId, command);
  }

  release(): null {
    return null;
  }

  destroy(): void {
    // Nichts freizugeben - die Simulation ist reiner Speicher.
  }
}
