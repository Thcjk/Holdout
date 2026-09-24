/**
 * Eine Runde spielen - egal ob allein, als Host oder als Client.
 *
 * Die Spielszene soll nicht wissen, in welchem Modus sie laeuft. Sie fragt jedes
 * Bild "hier ist meine Eingabe, gib mir den Zustand zum Zeichnen" - und ob dieser
 * Zustand lokal gerechnet oder ueber das Netz empfangen wurde, ist ihre Sache nicht.
 */

import type { GameEvent, InputState, Vec2, WorldState } from "../systems/types";
import type { Transport } from "./Transport";

/** Alles, was die Darstellung braucht. `Simulation` und `ClientView` erfuellen das. */
export interface WorldView {
  readonly state: WorldState;
  /**
   * Noch nicht erschienene Gegner der laufenden Welle. Eigener Wert statt
   * `state.pendingSpawns.length`, weil der Client die Spawnliste nicht kennt -
   * er bekommt nur die Zahl vom Host.
   */
  readonly pendingCount: number;
  readonly events: readonly GameEvent[];
  readonly alpha: number;
  renderPlayerPosition(playerId: string): Vec2;
  renderEnemyPosition(enemyId: number, current: Vec2): Vec2;
  renderProjectilePosition(position: Vec2, velocity: Vec2): Vec2;
}

export interface GameSession {
  readonly selfId: string;
  readonly view: WorldView;

  /**
   * Darf diese Runde angehalten werden?
   *
   * Nur solo. Im Koop rechnet der Host die Runde fuer alle weiter; ein Geraet,
   * das fuer sich anhaelt, wuerde beim Weitermachen entweder minutenlang
   * nachrechnen oder springen. Die Szene fragt das hier ab, statt selbst nach
   * dem Modus zu schauen - sie soll weiterhin nicht wissen, ob solo, als Host
   * oder als Client gespielt wird.
   */
  readonly canPause: boolean;
  /** Gesetzt, sobald die Verbindung abgerissen ist - mit Text fuer den Spieler. */
  readonly connectionLost: string | null;

  /**
   * Ein Bild weiterdrehen.
   *
   * @returns true, wenn die Eingabe verarbeitet wurde und einmalige Wuensche
   *          (Schuss, Super) geloescht werden duerfen.
   */
  update(deltaMs: number, input: InputState): boolean;

  /**
   * Beendet die Sitzung, OHNE die Verbindung zu schliessen, und gibt sie
   * heraus - `null`, wenn es keine gibt (solo).
   *
   * Gebraucht beim Run-Ende im Koop (Etappe 7): Vorher raeumte die Spielszene
   * die Sitzung mit `destroy()` ab, und die schloss den Transport. Der Raum
   * war damit zu, und fuer den naechsten Run brauchten alle einen neuen
   * Code. Jetzt wandert die Verbindung ueber Ergebnis- und Packbildschirm
   * zurueck in dieselbe Lobby, und der Host startet dort den naechsten Run
   * mit neuem Seed - ueber dasselbe `start`-Paket wie beim ersten Mal.
   *
   * Nach `release()` ist die Sitzung tot: kein `update`, kein `destroy`.
   */
  release(): Transport | null;

  destroy(): void;
}
