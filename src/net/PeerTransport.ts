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
import { SIGNAL_SERVERS, peerOptions } from "./peerConfig";
import { ensureIceServers, hasOwnTurnKey } from "./turnCredentials";
import { reportConnectionPath } from "./connectionPath";
import type { ConnectionPath } from "./connectionPath";
import type { SignalServer } from "./peerConfig";
import { peerIdForRoom } from "./roomCode";
import { BaseTransport } from "./Transport";

/** Wie lange je Signalisierungsserver auf die Anmeldung gewartet wird. */
const OPEN_TIMEOUT_MS = 9000;

/** Wie lange danach auf den Datenkanal zum Host gewartet wird. */
const CHANNEL_TIMEOUT_MS = 14000;

/**
 * Wie oft ein Beitritt wiederholt wird, wenn der Raum "nicht gefunden" wird.
 *
 * Die Anmeldung des Hosts braucht beim Server einen Moment. Wer sofort nach
 * dem Vorlesen des Codes tippt, kann in genau dieses Fenster geraten - und
 * bekommt "Raum gibt es nicht", obwohl es ihn eine halbe Sekunde spaeter gibt.
 */
const JOIN_RETRIES = 3;
const JOIN_RETRY_DELAY_MS = 600;

/** Ein Fehler, der sagt, WORAN es lag - nicht nur, dass es nicht ging. */
export type ConnectFailure =
  | "signal-unreachable"
  | "room-not-found"
  | "no-direct-connection"
  | "room-code-taken"
  | "unsupported";

export class ConnectError extends Error {
  constructor(
    readonly reason: ConnectFailure,
    message: string,
  ) {
    super(message);
    this.name = "ConnectError";
  }
}

function describeFailure(reason: ConnectFailure): string {
  switch (reason) {
    case "signal-unreachable":
      return "Der Verbindungsdienst ist nicht erreichbar. Das liegt nicht an dir und nicht am Raumcode - versuch es in ein paar Minuten noch einmal.";
    case "room-not-found":
      return "Kein Raum mit diesem Code. Tippfehler? Oder der Host hat den Raum inzwischen geschlossen.";
    case "no-direct-connection":
      // Der Raum WURDE gefunden - der Raumcode ist also richtig. Das gehoert
      // in die Meldung, sonst tippt man ihn zehnmal neu ein. Seit es einen
      // eigenen TURN-Schluessel gibt, kommt eine zweite Ursache dazu: ein
      // aufgebrauchtes Kontingent sieht fuer den Spieler genauso aus.
      return "Verbindung konnte nicht hergestellt werden. Der Raumcode stimmt - es kommt nur kein Weg zwischen euren Geräten zustande. Versucht es im selben WLAN noch einmal. (Möglich ist auch, dass das Kontingent des Relay-Servers aufgebraucht ist.)";
    case "room-code-taken":
      return "Dieser Raumcode ist gerade belegt. Erstelle einen neuen Raum.";
    case "unsupported":
      return "Dieser Browser unterstützt WebRTC nicht.";
  }
}

export class PeerTransport extends BaseTransport {
  readonly roomCode: string;
  readonly isHost: boolean;

  private peer: Peer | null = null;
  /** Zuletzt gemessener Verbindungsweg - fuer die Anzeige in der Lobby. */
  private lastPath: ConnectionPath | null = null;
  private readonly connections = new Map<string, DataConnection>();
  private closed = false;
  private openResolved = false;
  /** Regelmaessige Statusmeldung des Hosts, nur fuer die Fehlersuche. */
  private heartbeat: number | null = null;

  private constructor(roomCode: string, isHost: boolean) {
    super();
    this.roomCode = roomCode;
    this.isHost = isHost;
  }

  get selfId(): string {
    return this.peer?.id ?? "unknown";
  }

  /**
   * Oeffnet einen Raum.
   *
   * Probiert die Signalisierungsserver der Reihe nach durch: Ist der erste
   * nicht erreichbar, wird der naechste versucht, statt aufzugeben. Ein
   * einzelner Gratis-Server ist ein einzelner Ausfallpunkt - und fuer den
   * Spieler sieht sein Ausfall genauso aus wie ein falscher Raumcode.
   */
  static async host(roomCode: string): Promise<PeerTransport> {
    const ownId = peerIdForRoom(roomCode);
    netLog("HOST: Raum wird geoeffnet");
    // Zugangsdaten VOR dem Anmelden holen: `new Peer(...)` bekommt seine
    // ICE-Server beim Erzeugen mit, nachtragen geht nicht mehr. Host und
    // Client holen dieselben - beide Seiten brauchen dieselbe Ausstattung,
    // sonst findet nur eine von beiden einen Weg.
    await ensureIceServers();
    netLog(`HOST: TURN-Schluessel eigener? ${hasOwnTurnKey() ? "ja" : "nein"}`);
    netLog(`HOST: ${describeString("Raumcode", roomCode)}`);
    netLog(`HOST: ${describeString("Peer-ID angefordert", ownId)}`);

    let lastReason: ConnectFailure = "signal-unreachable";
    for (const server of SIGNAL_SERVERS) {
      const transport = new PeerTransport(roomCode, true);
      try {
        await transport.openPeer(server, ownId);
        netLog(`HOST: Raum offen ueber ${server.label}`);
        return transport;
      } catch (error) {
        lastReason = error instanceof ConnectError ? error.reason : "signal-unreachable";
        netLog(`HOST: ${server.label} hat nicht geklappt (${lastReason})`);
        transport.close();
        // Ein belegter Raumcode liegt nicht am Server - den naechsten zu
        // probieren wuerde nichts aendern.
        if (lastReason === "room-code-taken" || lastReason === "unsupported") {
          break;
        }
      }
    }

    throw new ConnectError(lastReason, describeFailure(lastReason));
  }

  /**
   * Tritt einem Raum bei.
   *
   * Zwei Dinge koennen schiefgehen, und sie fuehlen sich fuer den Spieler
   * gleich an, brauchen aber verschiedene Antworten:
   *
   *   Der Raum wird nicht GEFUNDEN  -> falscher Code, oder der Server kennt den
   *                                    Host nicht (noch nicht oder nicht mehr).
   *   Der Raum wird gefunden, aber  -> die Geraete kommen nicht aneinander
   *   der Datenkanal geht nie auf      vorbei. Das ist der Mobilfunk-Fall.
   */
  static async join(roomCode: string): Promise<PeerTransport> {
    const target = peerIdForRoom(roomCode);
    netLog("CLIENT: Beitritt wird versucht");
    netLog(`CLIENT: ${describeString("Raumcode eingetippt", roomCode)}`);
    netLog(`CLIENT: ${describeString("Peer-ID gesucht", target)}`);
    await ensureIceServers();
    netLog(`CLIENT: TURN-Schluessel eigener? ${hasOwnTurnKey() ? "ja" : "nein"}`);

    let lastReason: ConnectFailure = "signal-unreachable";

    for (const server of SIGNAL_SERVERS) {
      for (let attempt = 1; attempt <= JOIN_RETRIES; attempt += 1) {
        const transport = new PeerTransport(roomCode, false);
        try {
          await transport.openPeer(server, undefined);
          netLog(`CLIENT: beim ${server.label} angemeldet, Versuch ${attempt}`);
          await transport.connectToHost(target);
          netLog("CLIENT: Verbindung steht");
          return transport;
        } catch (error) {
          lastReason = error instanceof ConnectError ? error.reason : "signal-unreachable";
          netLog(`CLIENT: Versuch ${attempt} ueber ${server.label} gescheitert (${lastReason})`);
          transport.close();

          // Kommt keine direkte Verbindung zustande, hilft ein weiterer Versuch
          // beim selben Server nicht - der naechste Server hat andere
          // Hilfsserver und ist einen Versuch wert.
          if (lastReason === "no-direct-connection") {
            break;
          }
          // "Nicht gefunden" ist der Fall, der sich mit Warten loesen kann:
          // Die Anmeldung des Hosts braucht beim Server einen Moment.
          if (lastReason === "room-not-found" && attempt < JOIN_RETRIES) {
            netLog(`CLIENT: ${JOIN_RETRY_DELAY_MS} ms warten und noch einmal`);
            await delay(JOIN_RETRY_DELAY_MS);
            continue;
          }
          break;
        }
      }
    }

    throw new ConnectError(lastReason, describeFailure(lastReason));
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
   * Der Raumcode auf dem Bildschirm sagt darueber nichts aus - er ist nur
   * Text. Faellt der Host still vom Server, sieht er weiter seinen Code,
   * waehrend jeder Beitritt mit "Raum nicht gefunden" scheitert.
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

  /**
   * Meldet sich bei einem Signalisierungsserver an.
   *
   * Loest auf, sobald `open` gefeuert hat - also sobald der Server die ID
   * wirklich kennt. Vorher gibt es keinen Raum, egal was auf dem Bildschirm
   * steht.
   */
  private openPeer(server: SignalServer, ownId: string | undefined): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = peerOptions(server);
      const peer = ownId
        ? new Peer(ownId, options as never)
        : new Peer(undefined as never, options as never);
      this.peer = peer;

      const actual = (peer as unknown as { options?: Record<string, unknown> }).options ?? {};
      netLog(
        `${this.rolle()}: Server ${server.label} host=${String(actual.host)} ` +
          `port=${String(actual.port)} path=${String(actual.path)} secure=${String(actual.secure)}`,
      );

      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        netLog(`${this.rolle()}: Anmeldung dauerte zu lange`);
        reject(new ConnectError("signal-unreachable", describeFailure("signal-unreachable")));
      }, OPEN_TIMEOUT_MS);

      peer.on("open", (assignedId: string) => {
        netLog(`${this.rolle()}: ${describeString("Peer-ID zugeteilt", assignedId)}`);
        if (ownId !== undefined) {
          netLog(`HOST: angefordert === zugeteilt ? ${String(ownId === assignedId)}`);
          this.startHeartbeat(peer);
        }
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        this.openResolved = true;
        resolve();
      });

      peer.on("error", (error: Error & { type?: string }) => {
        netLog(`${this.rolle()}: FEHLER type=${String(error.type)} message=${error.message}`);
        const reason = reasonFor(error.type);
        // Nach dem Verbindungsaufbau sind Fehler nur noch Meldungen - die
        // laufende Runde soll davon nicht sterben.
        if (settled) {
          if (this.openResolved) {
            this.errorHandler(describeFailure(reason));
          }
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        reject(new ConnectError(reason, describeFailure(reason)));
      });

      peer.on("connection", (connection: DataConnection) => {
        netLog(`HOST: eingehende Verbindung von ${connection.peer}`);
        connection.on("open", () => {
          netLog(`HOST: Datenkanal offen mit ${connection.peer}`);
          this.registerConnection(connection);
        });
      });

      peer.on("disconnected", () => {
        netLog(`${this.rolle()}: vom Server getrennt - reconnect wird versucht`);
        if (!this.closed) {
          peer.reconnect();
        }
      });

      peer.on("close", () => netLog(`${this.rolle()}: peer geschlossen`));
    });
  }

  /**
   * Baut den Datenkanal zum Host auf.
   *
   * Hier trennen sich die beiden Fehlerarten: Meldet PeerJS
   * "peer-unavailable", kennt der Server den Raum nicht. Geht der Kanal
   * dagegen einfach nie auf, wurde der Raum gefunden, aber die Geraete kommen
   * nicht aneinander vorbei - das ist der Mobilfunk-Fall, gegen den TURN hilft.
   */
  private connectToHost(target: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = this.peer;
      if (!peer) {
        reject(new ConnectError("signal-unreachable", describeFailure("signal-unreachable")));
        return;
      }

      netLog(`CLIENT: ${describeString("connect() aufgerufen mit", target)}`);
      let settled = false;
      let foundRoom = false;

      const connection = peer.connect(target, {
        // Bei Spielzustaenden ist die neueste Nachricht wichtiger als die
        // vollstaendige Reihenfolge (Briefing, Abschnitt 6).
        reliable: false,
      });

      const timeout = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        // Kam bis hierher kein "peer-unavailable", kennt der Server den Raum -
        // es hakt also an der Verbindung selbst.
        const reason: ConnectFailure = foundRoom ? "no-direct-connection" : "room-not-found";
        netLog(`CLIENT: Datenkanal kam nicht zustande (${reason})`);
        reject(new ConnectError(reason, describeFailure(reason)));
      }, CHANNEL_TIMEOUT_MS);

      // PeerJS meldet "peer-unavailable" ueber den PEER, nicht ueber die
      // Verbindung. Kommt das nicht, ist der Raum gefunden.
      const onPeerError = (error: Error & { type?: string }): void => {
        if (settled) {
          return;
        }
        if (error.type === "peer-unavailable") {
          settled = true;
          window.clearTimeout(timeout);
          netLog("CLIENT: Server kennt diesen Raum nicht");
          reject(new ConnectError("room-not-found", describeFailure("room-not-found")));
        }
      };
      peer.on("error", onPeerError);

      connection.on("iceStateChanged", (state: string) => {
        netLog(`CLIENT: ICE-Zustand ${state}`);
        // "checking" heisst: Der Raum wurde gefunden und die Geraete versuchen
        // gerade, einen Weg zueinander zu finden. Ab hier ist ein Scheitern
        // kein falscher Raumcode mehr.
        if (state === "checking" || state === "connected" || state === "completed") {
          foundRoom = true;
        }
        // "failed" ist endgueltig - darauf noch zwoelf Sekunden zu warten
        // waere nur Zeitverschwendung.
        if (state === "failed" && !settled) {
          settled = true;
          window.clearTimeout(timeout);
          peer.off("error", onPeerError);
          netLog("CLIENT: keine Verbindung zwischen den Geraeten moeglich");
          reject(
            new ConnectError("no-direct-connection", describeFailure("no-direct-connection")),
          );
        }
      });

      connection.on("open", () => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        peer.off("error", onPeerError);
        netLog("CLIENT: Datenkanal offen");
        this.registerConnection(connection);
        resolve();
      });

      connection.on("error", (error: Error) => {
        netLog(`CLIENT: Datenkanal-Fehler ${error.message}`);
      });
    });
  }

  /**
   * Der zuletzt gemessene Verbindungsweg, oder null solange er nicht feststeht.
   * Die Lobby zeigt ihn an - sonst saehe man ihn nur mit `?debug=netz`.
   */
  get connectionPath(): ConnectionPath | null {
    return this.lastPath;
  }

  /**
   * Die RTCPeerConnection hinter einem PeerJS-Datenkanal.
   *
   * PeerJS gibt sie als `peerConnection` heraus, fuehrt sie aber nicht in
   * seinen Typen - deshalb der Umweg ueber `unknown`. Fehlt sie (andere
   * PeerJS-Version), gibt es eben keine Wegauskunft, aber keinen Absturz.
   */
  private peerConnectionOf(connection: DataConnection): RTCPeerConnection | undefined {
    return (connection as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
  }

  private registerConnection(connection: DataConnection): void {
    this.connections.set(connection.peer, connection);
    this.peerJoinHandler(connection.peer);

    /*
     * Jetzt nachsehen, welcher Weg wirklich benutzt wird - direkt oder ueber
     * TURN. Hier und nicht woanders, weil JEDE offene Verbindung durch diese
     * Stelle laeuft: der Host fuer jeden Beitretenden, der Client fuer den
     * Host. Beide Seiten protokollieren damit unabhaengig voneinander.
     *
     * Bewusst nicht abgewartet (`void`): Die Auskunft braucht ein paar hundert
     * Millisekunden, und niemand soll darauf warten, um zu spielen. Sie ist
     * Diagnose, kein Spielinhalt.
     */
    void reportConnectionPath(this.peerConnectionOf(connection), this.rolle()).then((path) => {
      this.lastPath = path;
    });

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

/** Ordnet einen PeerJS-Fehlercode einer der Ursachen zu, die wir unterscheiden. */
function reasonFor(type: string | undefined): ConnectFailure {
  switch (type) {
    case "unavailable-id":
      return "room-code-taken";
    case "peer-unavailable":
      return "room-not-found";
    case "browser-incompatible":
      return "unsupported";
    case "network":
    case "server-error":
    case "socket-error":
    case "ssl-unavailable":
      return "signal-unreachable";
    default:
      return "signal-unreachable";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
