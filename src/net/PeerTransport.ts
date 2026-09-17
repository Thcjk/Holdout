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
import { describeString, netLog } from "./netLog";
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
  /** Regelmaessige Statusmeldung des Hosts, nur fuer die Fehlersuche. */
  private heartbeat: number | null = null;
  /** Wann der Client `connect()` gerufen hat - fuer die Dauer bis zum Fehler. */
  private connectStartedAt = 0;

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
    const ownId = peerIdForRoom(roomCode);
    netLog("HOST: Raum wird geoeffnet");
    netLog(`HOST: ${describeString("Raumcode", roomCode)}`);
    netLog(`HOST: ${describeString("Peer-ID angefordert", ownId)}`);
    return transport.start(ownId, null);
  }

  /** Tritt einem Raum bei. Loest auf, sobald die Verbindung zum Host steht. */
  static join(roomCode: string): Promise<PeerTransport> {
    const transport = new PeerTransport(roomCode, false);
    const target = peerIdForRoom(roomCode);
    netLog("CLIENT: Beitritt wird versucht");
    netLog(`CLIENT: ${describeString("Raumcode eingetippt", roomCode)}`);
    netLog(`CLIENT: ${describeString("Peer-ID gesucht", target)}`);
    return transport.start(undefined, target);
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
    netLog(`${this.rolle()}: close() - peer wird zerstoert`);
    this.closed = true;
    this.stopHeartbeat();
    for (const connection of this.connections.values()) {
      connection.close();
    }
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
  }

  private rolle(): string {
    return this.isHost ? "HOST" : "CLIENT";
  }

  /**
   * Meldet alle fuenf Sekunden, ob der Host beim Signalisierungsserver noch
   * angemeldet ist.
   *
   * Der wichtigste offene Verdacht: Der Host sieht weiter seinen Raumcode,
   * waehrend seine Anmeldung beim Server laengst weg ist. Der Code auf dem
   * Bildschirm sagt darueber nichts aus - er ist nur Text. Erst diese Zeilen
   * zeigen, ob im Moment des Beitritts ueberhaupt noch jemand da war, den der
   * Client finden koennte.
   */
  private startHeartbeat(peer: Peer): void {
    if (this.heartbeat !== null) {
      return;
    }
    this.heartbeat = window.setInterval(() => {
      if (this.closed) {
        return;
      }
      netLog(
        `HOST: noch da? angemeldet=${String(!peer.disconnected)} ` +
          `zerstoert=${String(peer.destroyed)} verbindungen=${this.connections.size}`,
      );
    }, 5000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat !== null) {
      window.clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private start(ownId: string | undefined, connectTo: string | null): Promise<PeerTransport> {
    return new Promise((resolve, reject) => {
      const peer = ownId ? new Peer(ownId) : new Peer();
      this.peer = peer;

      // Welcher Signalisierungsserver wird ueberhaupt benutzt? Wenn Host und
      // Client hier verschiedene Werte zeigen, kann der eine den anderen
      // niemals finden - egal wie richtig der Raumcode ist.
      const options = (peer as unknown as { options?: Record<string, unknown> }).options ?? {};
      netLog(
        `${this.rolle()}: Server host=${String(options.host)} port=${String(options.port)} ` +
          `path=${String(options.path)} key=${String(options.key)} secure=${String(options.secure)}`,
      );

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
        const since =
          this.connectStartedAt > 0
            ? ` (${((Date.now() - this.connectStartedAt) / 1000).toFixed(2)}s nach connect)`
            : "";
        netLog(
          `${this.rolle()}: FEHLER type=${String(error.type)} message=${error.message}${since}`,
        );
        if (!this.openResolved) {
          window.clearTimeout(timeout);
          this.close();
          reject(new Error(describePeerError(error)));
          return;
        }
        this.errorHandler(describePeerError(error));
      });

      peer.on("open", (assignedId: string) => {
        netLog(`${this.rolle()}: open gefeuert`);
        netLog(`${this.rolle()}: ${describeString("Peer-ID zugeteilt", assignedId)}`);
        netLog(`${this.rolle()}: ${describeString("peer.id", peer.id)}`);
        if (ownId !== undefined) {
          // Der wichtigste Vergleich: Bekommt der Host wirklich die ID, die er
          // angefordert hat? Weicht sie ab, sucht der Client spaeter eine ID,
          // die es beim Server nicht gibt.
          netLog(
            `HOST: angefordert === zugeteilt ? ${String(ownId === assignedId)} ` +
              `(und === peer.id ? ${String(ownId === peer.id)})`,
          );
        }

        if (connectTo === null) {
          // Host: ab jetzt koennen Clients beitreten.
          window.clearTimeout(timeout);
          this.openResolved = true;
          netLog("HOST: Raum offen, Code wird jetzt angezeigt");
          this.startHeartbeat(peer);
          resolve(this);
          return;
        }

        netLog(`CLIENT: ${describeString("connect() aufgerufen mit", connectTo)}`);
        const connectStartedAt = Date.now();
        this.connectStartedAt = connectStartedAt;
        const connection = peer.connect(connectTo, {
          // Bei Spielzustaenden ist die neueste Nachricht wichtiger als die
          // vollstaendige Reihenfolge (Briefing, Abschnitt 6).
          reliable: false,
        });

        connection.on("open", () => {
          netLog("CLIENT: Datenkanal offen - Verbindung steht");
          window.clearTimeout(timeout);
          this.registerConnection(connection);
          this.openResolved = true;
          resolve(this);
        });

        connection.on("error", (error: Error) => {
          netLog(`CLIENT: Datenkanal-Fehler ${error.message}`);
        });
      });

      peer.on("connection", (connection: DataConnection) => {
        netLog(`HOST: eingehende Verbindung von ${connection.peer}`);
        connection.on("open", () => {
          netLog(`HOST: Datenkanal offen mit ${connection.peer}`);
          this.registerConnection(connection);
        });
      });

      peer.on("close", () => {
        netLog(`${this.rolle()}: peer geschlossen`);
      });

      peer.on("disconnected", () => {
        // Das ist der stille Killer: Faellt der Host vom Signalisierungsserver,
        // sieht er weiter seinen Raumcode - der Server kennt ihn aber nicht
        // mehr, und jeder Beitritt scheitert mit "peer-unavailable".
        netLog(`${this.rolle()}: VOM SERVER GETRENNT (reconnect wird versucht)`);
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
