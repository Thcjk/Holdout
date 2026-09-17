/**
 * Die Verbindungsschicht - bewusst hinter einer kleinen Schnittstelle versteckt.
 *
 * Der Grund: Netzwerkcode laesst sich schlecht testen, wenn er fest an eine
 * Bibliothek gebunden ist. Mit dieser Schnittstelle gibt es zwei Umsetzungen -
 * eine ueber WebRTC fuer echtes Spielen (`PeerTransport`) und eine, die nur
 * zwischen zwei Browser-Tabs desselben Rechners laeuft (`LocalTransport`).
 * Letztere ist genau der erste Schritt, den das Briefing für Phase 6 vorschlaegt.
 */

import type { NetMessage } from "./protocol";

export type MessageHandler = (from: string, message: NetMessage) => void;
export type PeerHandler = (peerId: string) => void;
export type ErrorHandler = (message: string) => void;

export interface Transport {
  /** Eigene Kennung in dieser Runde. */
  readonly selfId: string;
  /** Der Raumcode, ueber den Mitspieler beitreten. */
  readonly roomCode: string;
  readonly isHost: boolean;

  send(peerId: string, message: NetMessage): void;
  broadcast(message: NetMessage): void;

  onMessage(handler: MessageHandler): void;
  onPeerJoin(handler: PeerHandler): void;
  onPeerLeave(handler: PeerHandler): void;
  onError(handler: ErrorHandler): void;

  close(): void;
}

/** Gemeinsame Grundlage: das Verwalten der Rueckrufe. */
export abstract class BaseTransport implements Transport {
  protected messageHandler: MessageHandler = () => {};
  protected peerJoinHandler: PeerHandler = () => {};
  protected peerLeaveHandler: PeerHandler = () => {};
  protected errorHandler: ErrorHandler = () => {};

  abstract readonly selfId: string;
  abstract readonly roomCode: string;
  abstract readonly isHost: boolean;

  abstract send(peerId: string, message: NetMessage): void;
  abstract broadcast(message: NetMessage): void;
  abstract close(): void;

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onPeerJoin(handler: PeerHandler): void {
    this.peerJoinHandler = handler;
  }

  onPeerLeave(handler: PeerHandler): void {
    this.peerLeaveHandler = handler;
  }

  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }
}
