/**
 * Der Raum vor der Runde: wer ist da, wer ist Host, wann geht es los.
 *
 * Absichtlich getrennt vom Spiel: Hier geht es nur um das Zusammenfinden. Sobald
 * der Host startet, uebernimmt HostSession bzw. ClientSession.
 *
 * Weil der Datenkanal absichtlich unzuverlaessig ist (die neueste Spielposition
 * ist wichtiger als die vollstaendige Reihenfolge), werden die wenigen wichtigen
 * Nachrichten hier wiederholt, bis sie ankommen: `hello` bis eine Spielerliste
 * zurueckkommt, `start` bis jeder Client sich gemeldet hat.
 */

import type { CharacterId } from "../systems/types";
import type { PlayerSetup } from "../systems/world";
import type { NetMessage, NetPlayerInfo } from "./protocol";
import type { Transport } from "./Transport";

const LOBBY_BROADCAST_MS = 500;
const HELLO_RETRY_MS = 400;
const START_RETRY_MS = 250;

export const MAX_PLAYERS = 4;

export interface LobbyIdentity {
  name: string;
  character: CharacterId;
}

export class Lobby {
  private players: NetPlayerInfo[] = [];
  private timers: number[] = [];
  private startRetry: number | null = null;
  private readonly acknowledged = new Set<string>();
  private started = false;

  private playersChanged: (players: NetPlayerInfo[]) => void = () => {};
  private startHandler: (setups: PlayerSetup[], seed: number) => void = () => {};
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
        { id: transport.selfId, name: identity.name, character: identity.character, isHost: true },
      ];
      this.timers.push(
        window.setInterval(() => {
          this.transport.broadcast({ t: "lobby", players: this.players });
        }, LOBBY_BROADCAST_MS),
      );
    } else {
      const sendHello = (): void => {
        if (this.players.length === 0) {
          this.transport.broadcast({
            t: "hello",
            name: identity.name,
            character: identity.character,
          });
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

  onStart(handler: (setups: PlayerSetup[], seed: number) => void): void {
    this.startHandler = handler;
  }

  onError(handler: (message: string) => void): void {
    this.errorHandler = handler;
  }

  /** Nur der Host darf starten. */
  start(): void {
    if (!this.transport.isHost || this.started) {
      return;
    }

    const seed = Math.floor(Math.random() * 0x7fffffff);
    const message: NetMessage = { t: "start", seed, players: this.players };

    const send = (): void => {
      const missing = this.players.some(
        (player) => !player.isHost && !this.acknowledged.has(player.id),
      );
      if (!missing) {
        this.stopStartRetry();
        return;
      }
      this.transport.broadcast(message);
    };

    send();
    this.startRetry = window.setInterval(send, START_RETRY_MS);

    this.started = true;
    this.startHandler(toSetups(this.players), seed);
  }

  /** Gibt nur die Lobby frei - der Transport wird von der Session weitergenutzt. */
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
        if (this.players.some((player) => player.id === from)) {
          return;
        }
        if (this.players.length >= MAX_PLAYERS) {
          this.transport.send(from, { t: "bye", reason: "Der Raum ist voll (4 Spieler)." });
          return;
        }
        this.players = [
          ...this.players,
          { id: from, name: message.name, character: message.character, isHost: false },
        ];
        this.transport.broadcast({ t: "lobby", players: this.players });
        this.playersChanged(this.players);
        break;
      }

      case "lobby": {
        if (this.transport.isHost) {
          return;
        }
        this.players = message.players;
        this.playersChanged(this.players);
        break;
      }

      case "start": {
        if (this.transport.isHost || this.started) {
          // Bestaetigung wiederholen: Der Host hoert erst damit auf, wenn sie ankommt.
          this.transport.broadcast({ t: "ready" });
          return;
        }
        this.started = true;
        this.transport.broadcast({ t: "ready" });
        this.players = message.players;
        this.startHandler(toSetups(message.players), message.seed);
        break;
      }

      case "ready": {
        this.acknowledged.add(from);
        break;
      }

      case "bye": {
        this.errorHandler(message.reason);
        break;
      }

      default:
        break;
    }
  }

  private handleLeave(peerId: string): void {
    if (!this.transport.isHost || this.started) {
      return;
    }
    const remaining = this.players.filter((player) => player.id !== peerId);
    if (remaining.length !== this.players.length) {
      this.players = remaining;
      this.transport.broadcast({ t: "lobby", players: this.players });
      this.playersChanged(this.players);
    }
  }
}

function toSetups(players: readonly NetPlayerInfo[]): PlayerSetup[] {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    character: player.character,
  }));
}
