/**
 * Ein Transport ganz im Speicher - Host und Clients im selben Prozess.
 *
 * Zum Testen der Netzlogik ohne Browser und ohne Server. Mit `drop` lassen sich
 * verlorene Pakete nachstellen, mit `deliver` laesst sich der Versand anhalten.
 */

import type { NetMessage } from "../src/net/protocol";
import { BaseTransport } from "../src/net/Transport";

export class MemoryTransport extends BaseTransport {
  readonly isHost: boolean;
  readonly roomCode = "TESTAA";
  private readonly peers = new Map<string, MemoryTransport>();
  /** Gibt `true` zurueck, wenn ein Paket verloren gehen soll. */
  drop: (message: NetMessage) => boolean = () => false;

  constructor(
    readonly selfId: string,
    isHost: boolean,
  ) {
    super();
    this.isHost = isHost;
  }

  connect(other: MemoryTransport): void {
    this.peers.set(other.selfId, other);
    other.peers.set(this.selfId, this);
    this.peerJoinHandler(other.selfId);
    other.peerJoinHandler(this.selfId);
  }

  send(peerId: string, message: NetMessage): void {
    if (this.drop(message)) {
      return;
    }
    this.peers.get(peerId)?.messageHandler(this.selfId, structuredClone(message));
  }

  broadcast(message: NetMessage): void {
    for (const peer of this.peers.values()) {
      if (this.drop(message)) {
        continue;
      }
      peer.messageHandler(this.selfId, structuredClone(message));
    }
  }

  close(): void {
    for (const peer of this.peers.values()) {
      peer.peers.delete(this.selfId);
      peer.peerLeaveHandler(this.selfId);
    }
    this.peers.clear();
  }
}
