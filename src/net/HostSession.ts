/**
 * Host: rechnet die Simulation fuer alle und schickt den Zustand zurueck.
 *
 * Der Host spielt ganz normal mit - seine eigene Eingabe geht direkt in die
 * Simulation, die der Clients kommt ueber das Netz. Weil nur ein Geraet rechnet,
 * kann es keine widerspruechlichen Spielstaende geben.
 */

import { Simulation } from "../systems/Simulation";
import type { InputState } from "../systems/types";
import type { PlayerSetup, WorldPlace } from "../systems/world";
import type { GameSession, WorldView } from "./GameSession";
import { STATE_RATE, encodeState } from "./protocol";
import type { NetMessage } from "./protocol";
import type { Transport } from "./Transport";

const STATE_INTERVAL_MS = 1000 / STATE_RATE;

export class HostSession implements GameSession {
  readonly selfId: string;
  /** Der Host rechnet fuer alle mit - hielte er an, stuende die Runde fuer alle. */
  readonly canPause = false;
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
    /** Welches Gebiet (Kartenansicht). Der Client bekommt dieselbe Nummer. */
    place: WorldPlace = { nodeId: null },
  ) {
    this.selfId = selfId;
    // Der Client baut genau dasselbe Gebiet (`ClientView`) - uebers Netz geht
    // nur die Knotennummer im `move`-Paket, nie die Karte.
    this.simulation = new Simulation(setups, seed, place);

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

  /**
   * Gibt die Verbindung fuer den naechsten Run heraus - ohne "bye".
   *
   * Die Nachrichtenempfaenger bleiben bis zum naechsten Besitzer auf dieser
   * Sitzung stehen. Das ist harmlos: Sie fuehren nur noch Eingaben in eine
   * Simulation, die niemand mehr weiterrechnet, und die Lobby setzt eigene,
   * sobald sie den Transport bekommt (`onMessage` ERSETZT den Empfaenger).
   */
  release(): Transport {
    this.inputs.clear();
    return this.transport;
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
      // Feuern ist ein gehaltener Zustand und wird direkt uebernommen.
      fire: message.fire,
      // Der Super ist einmalig und darf nicht verlorengehen, solange ihn kein
      // Tick gesehen hat.
      useSuper: message.super || (existing?.useSuper ?? false),
      // Die zweite Faehigkeit ist genauso einmalig wie der Super und darf
      // genauso wenig verlorengehen, solange kein Tick sie gesehen hat.
      useAbility: message.ability || (existing?.useAbility ?? false),
      abilityAim: message.abilityAim ?? existing?.abilityAim ?? null,
      // Rucksack-Befehl: einmalig wie Super und Faehigkeit, darf also nicht
      // von einem spaeteren Paket ohne Befehl ueberschrieben werden.
      inventory: message.inventory ?? existing?.inventory ?? null,
    });
  }

  private clearOneShotInputs(): void {
    for (const [id, input] of this.inputs) {
      if (input.useSuper || input.useAbility || input.inventory) {
        this.inputs.set(id, {
          ...input,
          useSuper: false,
          useAbility: false,
          abilityAim: null,
          inventory: null,
        });
      }
    }
  }

  /**
   * Geht ein Client, bleibt seine Figur stehen statt zu verschwinden - sonst
   * wuerde mitten im Gefecht ein Spieler aus dem Bild springen. Er zaehlt fuer
   * das Rundenende weiter mit, sobald er am Boden ist.
   */
  /**
   * Ein Mitspieler hat die Verbindung verloren oder die Runde verlassen.
   *
   * Frueher wurde hier nur seine Eingabe vergessen - seine Figur blieb in der
   * Welt stehen, bewegungslos, bis Gegner sie zu Boden brachten. Danach lag
   * sie halbdurchsichtig fuer den Rest der Runde da. Das hatte zwei Folgen:
   * ein "Geist" im Bild, und eine Extraktion, die nie gelingen konnte, solange
   * diese Figur noch stand, weil sie die Ausstiegszone nie erreicht.
   *
   * Jetzt verschwindet der Spieler aus der Simulation. Mit dem naechsten
   * Zustandspaket ist er auch bei allen anderen weg, und
   * `EntityRenderer.pruneLeftPlayers` raeumt sein Bild ab.
   */
  private handleLeave(peerId: string): void {
    this.inputs.delete(peerId);
    this.lastSeq.delete(peerId);

    const players = this.simulation.state.players;
    const index = players.findIndex((player) => player.id === peerId);
    if (index >= 0) {
      players.splice(index, 1);
    }
  }
}
