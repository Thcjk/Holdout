/**
 * Client: schickt Eingaben, zeichnet die Antwort des Hosts.
 *
 * Der Client rechnet das Spiel nicht mit - mit einer Ausnahme: der eigenen
 * Figur (siehe ClientView, Stichwort Vorhersage). Alles andere kommt vom Host.
 */

import { INPUT_RATE } from "./protocol";
import type { NetMessage } from "./protocol";
import { ClientView } from "./ClientView";
import type { GameSession, WorldView } from "./GameSession";
import type { InputState } from "../systems/types";
import type { PlayerSetup } from "../systems/world";
import type { Transport } from "./Transport";

const INPUT_INTERVAL_MS = 1000 / INPUT_RATE;

export class ClientSession implements GameSession {
  readonly selfId: string;
  connectionLost: string | null = null;

  private readonly clientView: ClientView;
  private sinceLastInput = 0;
  private sequence = 0;
  /** Gesammelte einmalige Wuensche, bis sie tatsaechlich verschickt wurden. */
  private pendingFire = false;
  private pendingSuper = false;

  constructor(
    private readonly transport: Transport,
    setups: readonly PlayerSetup[],
    selfId: string,
  ) {
    this.selfId = selfId;
    this.clientView = new ClientView(selfId, setups);

    transport.onMessage((_from, message) => this.receive(message));
    transport.onPeerLeave(() => {
      this.connectionLost = "Host hat die Verbindung verlassen.";
    });
    transport.onError((message) => {
      this.connectionLost = message;
    });
  }

  get view(): WorldView {
    return this.clientView;
  }

  update(deltaMs: number, input: InputState): boolean {
    this.pendingFire = this.pendingFire || input.fire;
    this.pendingSuper = this.pendingSuper || input.useSuper;

    this.sinceLastInput += deltaMs;
    let sent = false;

    if (this.sinceLastInput >= INPUT_INTERVAL_MS) {
      this.sinceLastInput = 0;
      this.sequence += 1;
      this.transport.broadcast({
        t: "input",
        seq: this.sequence,
        move: input.move,
        aim: input.aim,
        fire: this.pendingFire,
        super: this.pendingSuper,
      });
      this.pendingFire = false;
      this.pendingSuper = false;
      sent = true;
    }

    this.clientView.advance(deltaMs, input);

    return sent;
  }

  destroy(): void {
    this.transport.close();
  }

  private receive(message: NetMessage): void {
    switch (message.t) {
      case "state":
        this.clientView.pushState(message);
        break;
      case "events":
        this.clientView.pushEvents(message.events);
        break;
      case "bye":
        this.connectionLost = message.reason;
        break;
      default:
        break;
    }
  }
}
