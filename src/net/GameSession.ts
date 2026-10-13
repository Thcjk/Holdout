/**
 * Eine Runde spielen - die Spielszene soll nicht wissen, ob allein oder im Koop.
 *
 * Sie gibt jedes Bild die Eingabe ab und bekommt Zustand und Ereignisse zurueck.
 * Ob der Zustand lokal gerechnet oder uebers Netz empfangen wurde, ist nicht ihre
 * Sache. (Koop kommt in einer spaeteren Etappe; dann gibt es eine zweite Sitzung.)
 */

import type { Command, GameEvent, GameState, PlayerInput } from "../game/types";

export interface GameSession {
  readonly selfId: string;
  readonly state: GameState;
  /** Was seit dem letzten Bild passiert ist. */
  readonly events: readonly GameEvent[];
  /** Darf angehalten werden? Nur allein. */
  readonly canPause: boolean;

  update(deltaMs: number, input: PlayerInput): void;
  send(command: Command): void;
  destroy(): void;
}
