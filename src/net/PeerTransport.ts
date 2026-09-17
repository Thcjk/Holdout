/**
 * Verbindung ueber WebRTC mit PeerJS - der echte Koop-Modus.
 *
 * Ablauf: Der Host meldet sich beim oeffentlichen PeerJS-Signalisierungsserver
 * unter einer ID an, die sich aus dem Raumcode ergibt. Clients verbinden sich
 * direkt mit dieser ID. Der Server wird nur fuer den Verbindungsaufbau gebraucht;
 * danach laufen die Daten direkt zwischen den Geraeten.
 *
 * Bekannte Einschraenkung (steht so im Briefing): In manchen Mobilfunknetzen und
 * hinter strengen Firewalls kommt keine Direktverbindung zustande - dafuer
 * braeuchte es einen TURN-Server, den es nicht gratis gibt. Die ehrliche Antwort
 * fuer V1 ist eine verstaendliche Fehlermeldung plus der jederzeit nutzbare
 * Solo-Modus, nicht ein halbes Jahr Serverbastelei.
 */

import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import type { NetMessage } from "./protocol";
import { peerIdForRoom } from "./roomCode";
import { BaseTransport } from "./Transport";

/** Wie lange auf eine Verbindung gewartet wird, bevor aufgegeben wird. */
const CONNECT_TIMEOUT_MS = 12000;

export class PeerTransport extends BaseTransport {
  readonly roomCode: string;
  readonly isHost: boolean;

  private peer: Peer | null = null;
  private readonly connections = new Map<string, DataConnection>();
  private closed = false;
  private openResolved = false;

  private constructor(roomCode: string, isHost: boolean) {
    super();
    this.roomCode = roomCode;
    this.isHost = isHost;
  }

  get selfId(): string {
    return this.peer?.id ?? "unknown";
  }

  /** Oeffnet einen Raum. Loest auf, sobald der Raumcode vergeben ist. */
  static host(roomCode: string): Promise<PeerTransport> {
    const transport = new PeerTransport(roomCode, true);
    return transport.start(peerIdForRoom(roomCode), null);
  }

  /** Tritt einem Raum bei. Loest auf, sobald die Verbindung zum Host steht. */
  static join(roomCode: string): Promise<PeerTransport> {
    const transport = new PeerTransport(roomCode, false);
    return transport.start(undefined, peerIdForRoom(roomCode));
  }

  send(peerId: string, message: NetMessage): void {
    const connection = this.connections.get(peerId);
    if (connection?.open) {
      connection.send(message);
    }
  }

  broadcast(message: NetMessage): void {
    for (const connection of this.connections.values()) {
      if (connection.open) {
        connection.send(message);
      }
    }
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const connection of this.connections.values()) {
      connection.close();
    }
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
  }

  private start(ownId: string | undefined, connectTo: string | null): Promise<PeerTransport> {
    return new Promise((resolve, reject) => {
      const peer = ownId ? new Peer(ownId) : new Peer();
      this.peer = peer;

      const timeout = window.setTimeout(() => {
        if (!this.openResolved) {
          this.close();
          reject(
            new Error(
              "Keine Verbindung zustande gekommen. Im WLAN klappt es meist - sonst geht der Solo-Modus immer.",
            ),
          );
        }
      }, CONNECT_TIMEOUT_MS);

      peer.on("error", (error: Error & { type?: string }) => {
        if (!this.openResolved) {
          window.clearTimeout(timeout);
          this.close();
          reject(new Error(describePeerError(error)));
          return;
        }
        this.errorHandler(describePeerError(error));
      });

      peer.on("open", () => {
        if (connectTo === null) {
          // Host: ab jetzt koennen Clients beitreten.
          window.clearTimeout(timeout);
          this.openResolved = true;
          resolve(this);
          return;
        }

        const connection = peer.connect(connectTo, {
          // Bei Spielzustaenden ist die neueste Nachricht wichtiger als die
          // vollstaendige Reihenfolge (Briefing, Abschnitt 6).
          reliable: false,
        });

        connection.on("open", () => {
          window.clearTimeout(timeout);
          this.registerConnection(connection);
          this.openResolved = true;
          resolve(this);
        });
      });

      peer.on("connection", (connection: DataConnection) => {
        connection.on("open", () => this.registerConnection(connection));
      });

      peer.on("disconnected", () => {
        // Verbindung zum Signalisierungsserver verloren - die laufenden
        // Direktverbindungen bestehen weiter, ein neuer Beitritt geht nicht mehr.
        if (!this.closed) {
          peer.reconnect();
        }
      });
    });
  }

  private registerConnection(connection: DataConnection): void {
    this.connections.set(connection.peer, connection);
    this.peerJoinHandler(connection.peer);

    connection.on("data", (data: unknown) => {
      const message = data as NetMessage;
      if (message && typeof message === "object" && typeof message.t === "string") {
        this.messageHandler(connection.peer, message);
      }
    });

    const drop = (): void => {
      if (this.connections.delete(connection.peer)) {
        this.peerLeaveHandler(connection.peer);
      }
    };

    connection.on("close", drop);
    connection.on("error", drop);
  }
}

/** Verstaendliche Meldungen statt PeerJS-Fehlercodes. */
function describePeerError(error: Error & { type?: string }): string {
  switch (error.type) {
    case "unavailable-id":
      return "Dieser Raumcode ist gerade belegt. Erstelle einen neuen Raum.";
    case "peer-unavailable":
      return "Kein Raum mit diesem Code gefunden. Tippfehler? Oder der Host hat den Raum geschlossen.";
    case "network":
    case "server-error":
    case "socket-error":
      return "Der Verbindungsdienst ist nicht erreichbar. Prüfe deine Internetverbindung.";
    case "browser-incompatible":
      return "Dieser Browser unterstützt WebRTC nicht.";
    default:
      return "Verbindung fehlgeschlagen. Im WLAN klappt es meist - der Solo-Modus geht immer.";
  }
}
