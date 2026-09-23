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
import type { InputState, SkillId, Vec2 } from "../systems/types";
import type { PlayerSetup } from "../systems/world";
import type { Transport } from "./Transport";

const INPUT_INTERVAL_MS = 1000 / INPUT_RATE;

export class ClientSession implements GameSession {
  readonly selfId: string;
  /** Der Host rechnet weiter - ein angehaltener Client geriete nur aus dem Takt. */
  readonly canPause = false;
  connectionLost: string | null = null;

  private readonly clientView: ClientView;
  private sinceLastInput = 0;
  private sequence = 0;
  /** Gesammelte einmalige Wuensche, bis sie tatsaechlich verschickt wurden. */
  private pendingSuper = false;
  private pendingAbility = false;
  private pendingAbilityAim: Vec2 | null = null;
  private pendingLevelUp: SkillId | null = null;

  constructor(
    private readonly transport: Transport,
    setups: readonly PlayerSetup[],
    selfId: string,
    seed: number,
  ) {
    this.selfId = selfId;
    // Der Seed kommt aus dem "start"-Paket der Lobby und MUSS weitergereicht
    // werden: Aus ihm baut der Client seine Karte. Siehe `ClientView`.
    this.clientView = new ClientView(selfId, setups, seed);

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
    this.pendingSuper = this.pendingSuper || input.useSuper;
    // Die zweite Faehigkeit wird genauso gemerkt wie der Super: Sie wird
    // seltener gesendet als gezeichnet, und ein Druck darf zwischen zwei
    // Paketen nicht verlorengehen.
    if (input.useAbility) {
      this.pendingAbility = true;
      this.pendingAbilityAim = input.abilityAim;
    }
    this.pendingLevelUp = input.levelUp ?? this.pendingLevelUp;

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
        // Feuern ist ein gehaltener Zustand: Es wird gesendet, wie es gerade
        // ist. Der Super dagegen darf zwischen zwei Paketen nicht verlorengehen.
        fire: input.fire,
        super: this.pendingSuper,
        ability: this.pendingAbility,
        abilityAim: this.pendingAbilityAim,
        levelUp: this.pendingLevelUp,
      });
      this.pendingSuper = false;
      this.pendingAbility = false;
      this.pendingAbilityAim = null;
      this.pendingLevelUp = null;
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
