/**
 * Host: rechnet die Simulation fuer alle und schickt den Zustand zurueck.
 *
 * Der Host spielt ganz normal mit - seine eigene Eingabe geht direkt in die
 * Simulation, die der Clients kommt ueber das Netz. Weil nur ein Geraet rechnet,
 * kann es keine widerspruechlichen Spielstaende geben.
 */

import { Simulation } from "../systems/Simulation";
import type { InputState } from "../systems/types";
import type { PlayerSetup } from "../systems/world";
import type { GameSession, WorldView } from "./GameSession";
import { STATE_RATE, encodeState } from "./protocol";
import type { NetMessage } from "./protocol";
import type { Transport } from "./Transport";

const STATE_INTERVAL_MS = 1000 / STATE_RATE;

export class HostSession implements GameSession {
  readonly selfId: string;
  connectionLost: string | null = null;

  private readonly simulation: Simulation;
  private readonly inputs = new Map<string, InputState>();
  /** Letzte gesehene Paketnummer je Client - aeltere Pakete sind veraltet. */
  private readonly lastSeq = new Map<string, number>();
  private sinceLastState = 0;

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

  get view(): WorldView {
    return this.simulation;
  }

  update(deltaMs: number, input: InputState): boolean {
    this.inputs.set(this.selfId, input);
    const ticks = this.simulation.advance(deltaMs, this.inputs);

    // Eingaben der Clients gelten nur bis zum naechsten Paket. Bleibt eines aus,
    // laeuft die Figur weiter geradeaus - das ist besser, als sie stehen zu lassen.
    if (ticks > 0) {
      this.clearOneShotInputs();
    }

    this.sinceLastState += deltaMs;
    if (this.sinceLastState >= STATE_INTERVAL_MS) {
      this.sinceLastState = 0;
      this.transport.broadcast(encodeState(this.simulation.state));
    }

    // Ereignisse gehen sofort raus: Sie sind selten, aber fuer Toene und Effekte
    // ist Verzoegerung genau das, was auffaellt.
    if (this.simulation.events.length > 0) {
      this.transport.broadcast({ t: "events", events: [...this.simulation.events] });
    }

    return ticks > 0;
  }

  destroy(): void {
    this.transport.broadcast({ t: "bye", reason: "Host hat die Runde beendet." });
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

    const existing = this.inputs.get(from);
    this.inputs.set(from, {
      move: message.move,
      aim: message.aim,
      // Einmalige Wuensche nicht ueberschreiben, solange sie kein Tick gesehen hat.
      fire: message.fire || (existing?.fire ?? false),
      useSuper: message.super || (existing?.useSuper ?? false),
    });
  }

  private clearOneShotInputs(): void {
    for (const [id, input] of this.inputs) {
      if (input.fire || input.useSuper) {
        this.inputs.set(id, { ...input, fire: false, useSuper: false });
      }
    }
  }

  /**
   * Geht ein Client, bleibt seine Figur stehen statt zu verschwinden - sonst
   * wuerde mitten im Gefecht ein Spieler aus dem Bild springen. Er zaehlt fuer
   * das Rundenende weiter mit, sobald er am Boden ist.
   */
  private handleLeave(peerId: string): void {
    this.inputs.delete(peerId);
    this.lastSeq.delete(peerId);
  }
}
