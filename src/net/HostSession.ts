/**
 * Host: rechnet die Simulation fuer alle und schickt den Zustand zurueck.
 *
 * Der Host spielt ganz normal mit - seine eigene Eingabe geht direkt in die
 * Simulation, die der Clients kommt ueber das Netz. Weil nur ein Geraet
 * rechnet, kann es keine widerspruechlichen Spielstaende geben.
 */

import { Simulation } from "../game/Simulation";
import type { Command, GameEvent, GameState, PlayerInput, PlayerSetup } from "../game/types";
import type { GameSession } from "./GameSession";
import { STATE_RATE, encodeState, type NetMessage, type RunOptions } from "./protocol";
import type { Transport } from "./Transport";

const STATE_INTERVAL_MS = 1000 / STATE_RATE;

export class HostSession implements GameSession {
  readonly selfId: string;
  /** Der Host rechnet fuer alle mit - hielte er an, stuende die Runde fuer alle. */
  readonly canPause = false;
  readonly isHost = true;
  readonly isMultiplayer = true;
  readonly isReady = true;
  connectionLost: string | null = null;

  private readonly simulation: Simulation;
  private readonly inputs = new Map<string, PlayerInput>();
  /** Letzte gesehene Paketnummer je Client - aeltere Pakete sind veraltet. */
  private readonly lastSeq = new Map<string, number>();
  private sinceState = STATE_INTERVAL_MS;
  private sent = 0;

  constructor(
    private readonly transport: Transport,
    setups: readonly PlayerSetup[],
    selfId: string,
    seed: number,
    options: RunOptions,
  ) {
    this.selfId = selfId;
    this.simulation = new Simulation(setups, seed, options);
    transport.onMessage((from, message) => this.receive(from, message));
    transport.onPeerLeave((peerId) => this.handleLeave(peerId));
  }

  get state(): GameState {
    return this.simulation.state;
  }

  get events(): readonly GameEvent[] {
    return this.simulation.events;
  }

  update(deltaMs: number, input: PlayerInput): void {
    this.inputs.set(this.selfId, input);
    this.simulation.advance(deltaMs, this.inputs);

    this.sinceState += deltaMs;
    if (this.sinceState >= STATE_INTERVAL_MS) {
      this.sinceState = 0;
      // Die Karte nur jede Sekunde mitschicken - sie aendert sich selten.
      const withMap = this.sent % STATE_RATE === 0;
      this.sent += 1;
      this.transport.broadcast({ t: "state", s: encodeState(this.simulation.state, withMap) });
    }
    // Ereignisse gehen sofort raus: Fuer Toene und Effekte faellt Verzoegerung auf.
    const events = this.simulation.events;
    if (events.length > 0) {
      this.transport.broadcast({ t: "events", e: [...events] });
    }
  }

  send(command: Command): void {
    this.simulation.command(this.selfId, command);
  }

  destroy(): void {
    this.transport.broadcast({ t: "bye", reason: "Der Host hat die Runde beendet." });
    this.transport.close();
  }

  private receive(from: string, message: NetMessage): void {
    if (message.t !== "input") {
      return;
    }
    // Veraltete Pakete verwerfen: Unzuverlaessig heisst auch "manchmal umsortiert".
    const previous = this.lastSeq.get(from) ?? -1;
    if (message.seq <= previous) {
      return;
    }
    this.lastSeq.set(from, message.seq);
    this.inputs.set(from, { mx: message.mx, my: message.my, ability: message.ab });

    // Der Client schickt ALLE noch unbestaetigten Befehle in jedem Paket, damit
    // ein verlorenes Paket keinen kostet. Hier zaehlt nur, was neu ist.
    const player = this.simulation.state.players.find((p) => p.id === from);
    if (!player) {
      return;
    }
    const fresh = message.cmds.filter((cmd) => cmd.id > player.lastCmd).sort((a, b) => a.id - b.id);
    for (const cmd of fresh) {
      this.simulation.command(from, cmd.c);
      player.lastCmd = cmd.id;
    }
  }

  /** Geht ein Client, verschwindet seine Figur aus der Runde. */
  private handleLeave(peerId: string): void {
    this.inputs.delete(peerId);
    this.lastSeq.delete(peerId);
    this.simulation.removePlayer(peerId);
  }
}
