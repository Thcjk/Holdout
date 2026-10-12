/**
 * Eine Runde spielen - egal ob allein, als Host oder als Client.
 *
 * Die Spielszene soll nicht wissen, in welchem Modus sie laeuft. Sie fragt jedes
 * Bild "hier ist meine Bewegung, gib mir den Zustand zum Zeichnen". Ob dieser
 * Zustand lokal gerechnet oder ueber das Netz empfangen wurde, ist ihre Sache nicht.
 */

import type { Command, GameEvent, GameState, PlayerInput } from "../game/types";

export interface GameView {
  readonly state: GameState;
  /** Was seit dem letzten Bild passiert ist (Treffer, Schuesse, ...). */
  readonly events: readonly GameEvent[];
}

export interface GameSession {
  readonly selfId: string;
  readonly view: GameView;
  /**
   * Darf die Runde angehalten werden? Nur solo - im Koop rechnet der Host
   * fuer alle weiter, ein anhaltendes Geraet wuerde springen.
   */
  readonly canPause: boolean;
  readonly isMultiplayer: boolean;
  /** Gesetzt, sobald die Verbindung abgerissen ist - mit Text fuer den Spieler. */
  readonly connectionLost: string | null;
  /** `false`, solange ein Client noch auf den ersten Zustand vom Host wartet. */
  readonly isReady: boolean;

  update(deltaMs: number, input: PlayerInput): void;

  /** Einen Befehl aus dem Shop abschicken. */
  send(command: Command): void;

  /**
   * Wo die eigene Figur gezeichnet werden soll. Der Client rechnet seine
   * Bewegung selbst voraus, damit sie nicht erst nach der Laufzeit zum Host
   * und zurueck reagiert. `null` heisst: Position aus dem Zustand nehmen.
   */
  selfPosition(): { x: number; y: number } | null;

  destroy(): void;
}
