/**
 * Der Raum vor der Runde: wer ist da, wer ist Host, wann geht es los.
 *
 * Absichtlich getrennt vom Spiel: Hier geht es nur um das Zusammenfinden. Sobald
 * der Host startet, uebernehmen `HostSession` bzw. `ClientSession`.
 *
 * Weil der Datenkanal unzuverlaessig ist, werden die wenigen wichtigen
 * Nachrichten wiederholt, bis sie ankommen: `hello`, bis eine Spielerliste
 * zurueckkommt, `start`, bis jeder Client sich gemeldet hat.
 */

import type { CrewId, PlayerSetup } from "../game/types";
import { MAX_PLAYERS, type NetMessage, type NetPlayerInfo, type RunOptions } from "./protocol";
import type { Transport } from "./Transport";

const LOBBY_BROADCAST_MS = 500;
const HELLO_RETRY_MS = 400;
const START_RETRY_MS = 250;

export interface LobbyIdentity {
  name: string;
  crew: CrewId;
}

export function toSetups(players: readonly NetPlayerInfo[]): PlayerSetup[] {
  return players.map((p) => ({ id: p.id, name: p.name, crew: p.crew }));
}

export class Lobby {
  private players: NetPlayerInfo[] = [];
  private timers: number[] = [];
  private startRetry: number | null = null;
  private readonly acknowledged = new Set<string>();
  private started = false;

  private playersChanged: (players: NetPlayerInfo[]) => void = () => {};
  private startHandler: (setups: PlayerSetup[], seed: number, options: RunOptions) => void =
    () => {};
  private errorHandler: (message: string) => void = () => {};

  constructor(
    private readonly transport: Transport,
    identity: LobbyIdentity,
  ) {
    transport.onMessage((from, message) => this.receive(from, message));
    transport.onError((message) => this.errorHandler(message));
    transport.onPeerLeave((peerId) => this.handleLeave(peerId));

    if (transport.isHost) {
      this.players = [
        { id: transport.selfId, name: identity.name, crew: identity.crew, isHost: true },
      ];
      this.timers.push(
        window.setInterval(() => {
          this.transport.broadcast({ t: "lobby", players: this.players });
        }, LOBBY_BROADCAST_MS),
      );
    } else {
      const sendHello = (): void => {
        if (this.players.length === 0) {
          this.transport.broadcast({ t: "hello", name: identity.name, crew: identity.crew });
        }
      };
      sendHello();
      this.timers.push(window.setInterval(sendHello, HELLO_RETRY_MS));
    }
  }

  get isHost(): boolean {
    return this.transport.isHost;
  }

  get roomCode(): string {
    return this.transport.roomCode;
  }

  get selfId(): string {
    return this.transport.selfId;
  }

  get playerList(): readonly NetPlayerInfo[] {
    return this.players;
  }

  onPlayersChanged(handler: (players: NetPlayerInfo[]) => void): void {
    this.playersChanged = handler;
    handler(this.players);
  }

  onStart(handler: (setups: PlayerSetup[], seed: number, options: RunOptions) => void): void {
    this.startHandler = handler;
  }

  onError(handler: (message: string) => void): void {
    this.errorHandler = handler;
  }

  /** Nur der Host darf starten. `options`: Hitze und Werft aus seinem Profil. */
  start(options: RunOptions): void {
    if (!this.transport.isHost || this.started) {
      return;
    }
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const message: NetMessage = { t: "start", seed, players: this.players, options };
    const send = (): void => {
      const missing = this.players.some((p) => !p.isHost && !this.acknowledged.has(p.id));
      if (!missing) {
        this.stopStartRetry();
        return;
      }
      this.transport.broadcast(message);
    };
    send();
    this.startRetry = window.setInterval(send, START_RETRY_MS);
    this.started = true;
    this.startHandler(toSetups(this.players), seed, options);
  }

  /** Gibt nur die Lobby frei - der Transport wird von der Spielsitzung weitergenutzt. */
  destroy(): void {
    for (const timer of this.timers) {
      window.clearInterval(timer);
    }
    this.timers = [];
    this.stopStartRetry();
  }

  private stopStartRetry(): void {
    if (this.startRetry !== null) {
      window.clearInterval(this.startRetry);
      this.startRetry = null;
    }
  }

  private receive(from: string, message: NetMessage): void {
    switch (message.t) {
      case "hello": {
        if (!this.transport.isHost || this.started) {
          return;
        }
        if (this.players.some((p) => p.id === from)) {
          return;
        }
        if (this.players.length >= MAX_PLAYERS) {
          this.transport.send(from, {
            t: "bye",
            reason: `Die Festung ist voll (${MAX_PLAYERS} Mechs).`,
          });
          return;
        }
        this.players = [
          ...this.players,
          { id: from, name: message.name, crew: message.crew, isHost: false },
        ];
        this.transport.broadcast({ t: "lobby", players: this.players });
        this.playersChanged(this.players);
        break;
      }
      case "lobby":
        if (this.transport.isHost) {
          return;
        }
        this.players = message.players;
        this.playersChanged(this.players);
        break;
      case "start":
        if (this.transport.isHost || this.started) {
          // Bestaetigung wiederholen: Der Host hoert erst damit auf, wenn sie ankommt.
          this.transport.broadcast({ t: "ready" });
          return;
        }
        this.started = true;
        this.transport.broadcast({ t: "ready" });
        this.players = message.players;
        this.startHandler(toSetups(message.players), message.seed, message.options);
        break;
      case "ready":
        this.acknowledged.add(from);
        break;
      case "bye":
        this.errorHandler(message.reason);
        break;
      default:
        break;
    }
  }

  private handleLeave(peerId: string): void {
    // Als Client kann nur einer gehen: der Host.
    if (!this.transport.isHost) {
      if (!this.started) {
        this.errorHandler("Der Host hat den Raum verlassen.");
      }
      return;
    }
    if (this.started) {
      return;
    }
    const remaining = this.players.filter((p) => p.id !== peerId);
    if (remaining.length !== this.players.length) {
      this.players = remaining;
      this.transport.broadcast({ t: "lobby", players: this.players });
      this.playersChanged(this.players);
    }
  }
}
