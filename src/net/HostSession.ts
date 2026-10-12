/**
 * Host: rechnet die Simulation fuer alle und schickt den Zustand zurueck.
 *
 * Der Host spielt ganz normal mit - seine eigene Eingabe geht direkt in die
 * Simulation, die der Clients kommt ueber das Netz. Weil nur ein Geraet
 * rechnet, kann es keine widerspruechlichen Spielstaende geben.
 */

import { Simulation } from "../game/Simulation";
import type { Command, GameEvent, PlayerInput, PlayerSetup } from "../game/types";
import type { GameSession, GameView } from "./GameSession";
import { STATE_RATE, encodeState } from "./protocol";
import type { NetMessage } from "./protocol";
import type { Transport } from "./Transport";

const STATE_INTERVAL_MS = 1000 / STATE_RATE;

export class HostSession implements GameSession {
  readonly selfId: string;
  /** Der Host rechnet fuer alle mit - hielte er an, stuende die Runde fuer alle. */
  readonly canPause = false;
  readonly isMultiplayer = true;
  connectionLost: string | null = null;
  readonly isReady = true;

  private readonly simulation: Simulation;
  private readonly inputs = new Map<string, PlayerInput>();
  /** Letzte gesehene Paketnummer je Client - aeltere Pakete sind veraltet. */
  private readonly lastSeq = new Map<string, number>();
  private events: GameEvent[] = [];
  private sinceLastState = STATE_INTERVAL_MS;

  constructor(
    private readonly transport: Transport,
    setups: readonly PlayerSetup[],
    selfId: string,
    seed: number,
  ) {
    this.selfId = selfId;
    this.simulation = new Simulation(setups, seed);
    transport.onMessage((from, message) => this.receive(from, message));
    transport.onPeerLeave((peerId) => this.handleLeave(peerId));
  }

  get view(): GameView {
    return { state: this.simulation.state, events: this.events };
  }

  update(deltaMs: number, input: PlayerInput): void {
    this.inputs.set(this.selfId, input);
    this.simulation.advance(deltaMs, this.inputs);
    this.events = this.simulation.events;

    this.sinceLastState += deltaMs;
    if (this.sinceLastState >= STATE_INTERVAL_MS) {
      this.sinceLastState = 0;
      this.transport.broadcast({ t: "state", s: encodeState(this.simulation.state) });
    }

    // Ereignisse gehen sofort raus: Sie sind selten, aber fuer Toene und Effekte
    // ist Verzoegerung genau das, was auffaellt.
    if (this.events.length > 0) {
      this.transport.broadcast({ t: "events", e: [...this.events] });
    }
  }

  send(command: Command): void {
    this.simulation.command(this.selfId, command);
  }

  selfPosition(): null {
    return null;
  }

  destroy(): void {
    this.transport.broadcast({ t: "bye", reason: "Der Host hat die Runde beendet." });
    this.transport.close();
  }

  private receive(from: string, message: NetMessage): void {
    if (message.t !== "input") {
      return;
    }

    // Veraltete Pakete verwerfen: Bei unzuverlaessigem Versand kommt gelegentlich
    // ein aelteres Paket nach einem neueren an.
    const previous = this.lastSeq.get(from) ?? -1;
    if (message.seq <= previous) {
      return;
    }
    this.lastSeq.set(from, message.seq);
    this.inputs.set(from, { mx: message.mx, my: message.my, ability: message.ab ?? 0 });

    // Befehle: Der Client schickt ALLE noch unbestaetigten in jedem Paket, damit
    // ein verlorenes Paket sie nicht kostet. Hier zaehlt nur, was neu ist.
    const player = this.simulation.state.players.find((candidate) => candidate.id === from);
    if (!player) {
      return;
    }
    const fresh = message.cmds.filter((cmd) => cmd.id > player.lastCmd).sort((a, b) => a.id - b.id);
    for (const cmd of fresh) {
      this.simulation.command(from, cmd.c);
      player.lastCmd = cmd.id;
    }
  }

  /** Geht ein Client, verschwindet seine Figur aus der Simulation. */
  private handleLeave(peerId: string): void {
    this.inputs.delete(peerId);
    this.lastSeq.delete(peerId);
    this.simulation.removePlayer(peerId);
  }
}
