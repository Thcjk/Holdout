/**
 * Verbindung zwischen zwei Tabs desselben Browsers - ohne Internet, ohne Server.
 *
 * Wozu? Das Briefing schlaegt fuer Phase 6 genau diese Reihenfolge vor: erst
 * zwei Browser-Tabs auf demselben Rechner, dann zwei Geraete im WLAN, dann
 * Mobilfunk. Dieser Transport deckt den ersten Schritt ab, und er macht die
 * Netzwerklogik testbar, ohne dass irgendein Server erreichbar sein muss.
 *
 * Technisch ist das ein `BroadcastChannel`: Alle Tabs derselben Website, die
 * denselben Kanalnamen oeffnen, hoeren sich gegenseitig.
 */

import type { NetMessage } from "./protocol";
import { BaseTransport } from "./Transport";

interface Envelope {
  from: string;
  to: string | null;
  message: NetMessage | { t: "join" } | { t: "leave" };
}

export class LocalTransport extends BaseTransport {
  readonly selfId: string;
  readonly roomCode: string;
  readonly isHost: boolean;

  private readonly channel: BroadcastChannel;
  private readonly peers = new Set<string>();
  private closed = false;

  constructor(roomCode: string, isHost: boolean) {
    super();
    this.roomCode = roomCode;
    this.isHost = isHost;
    this.selfId = isHost ? "host" : `client-${Math.random().toString(36).slice(2, 8)}`;
    this.channel = new BroadcastChannel(`koop-arena-${roomCode}`);

    this.channel.onmessage = (event: MessageEvent<Envelope>) => this.receive(event.data);

    // Erst am Ende des Aufbaus anmelden, damit niemand antwortet, bevor die
    // Rueckrufe gesetzt sind.
    queueMicrotask(() => {
      if (!this.closed) {
        this.post(null, { t: "join" });
      }
    });
  }

  send(peerId: string, message: NetMessage): void {
    this.post(peerId, message);
  }

  broadcast(message: NetMessage): void {
    this.post(null, message);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.post(null, { t: "leave" });
    this.channel.close();
  }

  private post(to: string | null, message: Envelope["message"]): void {
    if (this.closed) {
      return;
    }
    this.channel.postMessage({ from: this.selfId, to, message } satisfies Envelope);
  }

  private receive(envelope: Envelope): void {
    if (envelope.from === this.selfId) {
      return;
    }
    if (envelope.to !== null && envelope.to !== this.selfId) {
      return;
    }

    if (envelope.message.t === "join") {
      if (!this.peers.has(envelope.from)) {
        this.peers.add(envelope.from);
        this.peerJoinHandler(envelope.from);
      }
      // Zurueckmelden, damit auch der neue Tab von uns weiss.
      this.post(envelope.from, { t: "join" });
      return;
    }

    if (envelope.message.t === "leave") {
      if (this.peers.delete(envelope.from)) {
        this.peerLeaveHandler(envelope.from);
      }
      return;
    }

    if (!this.peers.has(envelope.from)) {
      this.peers.add(envelope.from);
      this.peerJoinHandler(envelope.from);
    }

    this.messageHandler(envelope.from, envelope.message);
  }
}
