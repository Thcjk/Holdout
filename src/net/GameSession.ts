/**
 * Eine Runde spielen - die Spielszene soll nicht wissen, ob allein oder im Koop.
 *
 * Sie gibt jedes Bild die Eingabe ab und bekommt Zustand und Ereignisse zurueck.
 * Ob der Zustand lokal gerechnet oder uebers Netz empfangen wurde, ist nicht ihre
 * Sache. Drei Umsetzungen: `SoloSession` (allein), `HostSession` (rechnet fuer
 * alle), `ClientSession` (schickt Eingaben, zeigt was der Host meldet).
 */

import type { Command, GameEvent, GameState, PlayerInput } from "../game/types";

export interface GameSession {
  readonly selfId: string;
  readonly state: GameState;
  /** Was seit dem letzten Bild passiert ist. */
  readonly events: readonly GameEvent[];
  /** Darf angehalten werden? Nur allein. */
  readonly canPause: boolean;
  /** Entscheidet ueber Weg und Ereignisse (allein: immer). */
  readonly isHost: boolean;
  readonly isMultiplayer: boolean;
  /** Erst wenn der erste Zustand da ist, gibt es etwas zu zeigen. */
  readonly isReady: boolean;
  /** Gesetzt, wenn die Verbindung weg ist - mit dem Grund zum Anzeigen. */
  readonly connectionLost: string | null;

  update(deltaMs: number, input: PlayerInput): void;
  send(command: Command): void;
  destroy(): void;
}
