/**
 * Host und Client in einem Test - ohne Browser, ohne Netz.
 *
 * Moeglich ist das nur, weil die Verbindung hinter der Schnittstelle `Transport`
 * liegt: Hier wird sie durch zwei Enden ersetzt, die sich gegenseitig die
 * Nachrichten zustecken. Genau dafuer ist die Schnittstelle da - Netzwerkfehler
 * zeigen sich sonst erst auf zwei echten Geraeten, und dann sucht man lange.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { TICK_MS } from "../../src/config/constants";
import { ClientSession } from "../../src/net/ClientSession";
import { HostSession } from "../../src/net/HostSession";
import { Lobby } from "../../src/net/Lobby";
import { createEnemy } from "../../src/systems/enemies";
import type { PlayerSetup } from "../../src/systems/world";
import type { NetMessage } from "../../src/net/protocol";
import { BaseTransport } from "../../src/net/Transport";
import { makeInput } from "../helpers";

/** Zwei Enden, die sich direkt beliefern - mit einstellbarem Paketverlust. */
class FakeTransport extends BaseTransport {
  other: FakeTransport | null = null;
  dropRate = 0;

  constructor(
    readonly selfId: string,
    readonly isHost: boolean,
    readonly roomCode = "TEST01",
  ) {
    super();
  }

  send(_peerId: string, message: NetMessage): void {
    this.deliver(message);
  }

  broadcast(message: NetMessage): void {
    this.deliver(message);
  }

  close(): void {
    this.other = null;
  }

  /** Tut so, als haette ein Mitspieler die Verbindung verloren. */
  simulateLeave(peerId: string): void {
    this.peerLeaveHandler(peerId);
  }

  private deliver(message: NetMessage): void {
    if (!this.other || Math.random() < this.dropRate) {
      return;
    }
    this.other.messageHandler(this.selfId, message);
  }
}

function pair(): { hostTransport: FakeTransport; clientTransport: FakeTransport } {
  const hostTransport = new FakeTransport("host", true);
  const clientTransport = new FakeTransport("client", false);
  hostTransport.other = clientTransport;
  clientTransport.other = hostTransport;
  return { hostTransport, clientTransport };
}

const SETUPS: PlayerSetup[] = [
  { id: "host", name: "Host", character: "scout" },
  { id: "client", name: "Client", character: "tank" },
];

function run(frames: number, host: HostSession, client: ClientSession, moveX: number): void {
  for (let i = 0; i < frames; i += 1) {
    host.update(TICK_MS, makeInput({ x: 0, y: 0 }));
    client.update(TICK_MS, makeInput({ x: moveX, y: 0 }));
  }
}

describe("Host und Client", () => {
  it("bringt dem Client die Welt des Hosts", () => {
    const { hostTransport, clientTransport } = pair();
    const host = new HostSession(hostTransport, SETUPS, "host", 42);
    const client = new ClientSession(clientTransport, SETUPS, "client", 42);

    host.view.state.enemies.push(createEnemy(1, "runner", { x: 400, y: 400 }, 1, 1, false));
    run(40, host, client, 0);

    // Der von Hand gesetzte Gegner kommt beim Client an. (Nicht "genau
    // einer": Im Knoten-Gebiet gibt es keine sichere Startzone mehr, dort
    // spawnen sofort weitere - das ist gewollt.)
    expect(client.view.state.enemies.map((enemy) => enemy.id)).toContain(1);
    expect(client.view.state.zone).toBe(host.view.state.zone);
    // ... und beide bauen dasselbe Gebiet.
    expect(client.view.state.walls).toEqual(host.view.state.walls);
    expect(client.view.state.bounds).toEqual(host.view.state.bounds);
  });

  it("bewegt die eigene Figur sofort, ohne auf den Host zu warten", () => {
    const { hostTransport, clientTransport } = pair();
    const host = new HostSession(hostTransport, SETUPS, "host", 42);
    const client = new ClientSession(clientTransport, SETUPS, "client", 42);

    expect(host.view.state.tick).toBe(0);

    const before = client.view.renderPlayerPosition("client").x;
    // Nur ein einziges Bild: Eine Antwort des Hosts kann es noch nicht geben.
    client.update(TICK_MS, makeInput({ x: 1, y: 0 }));

    expect(client.view.renderPlayerPosition("client").x).toBeGreaterThan(before);
  });

  it("laeuft nicht auseinander: Vorhersage bleibt nah an der Wahrheit des Hosts", () => {
    const { hostTransport, clientTransport } = pair();
    const host = new HostSession(hostTransport, SETUPS, "host", 42);
    const client = new ClientSession(clientTransport, SETUPS, "client", 42);

    run(120, host, client, 1);

    const authoritative = host.view.state.players.find((entry) => entry.id === "client");
    const predicted = client.view.renderPlayerPosition("client");
    expect(authoritative).toBeDefined();

    const drift = Math.hypot(
      (authoritative?.position.x ?? 0) - predicted.x,
      (authoritative?.position.y ?? 0) - predicted.y,
    );
    expect(drift).toBeLessThan(60);
  });

  it("uebersteht Paketverlust, ohne stehen zu bleiben", () => {
    const { hostTransport, clientTransport } = pair();
    hostTransport.dropRate = 0.3;
    clientTransport.dropRate = 0.3;

    const host = new HostSession(hostTransport, SETUPS, "host", 42);
    const client = new ClientSession(clientTransport, SETUPS, "client", 42);

    run(150, host, client, 1);

    const authoritative = host.view.state.players.find((entry) => entry.id === "client");
    expect(authoritative?.position.x ?? 0).toBeGreaterThan((SETUPS.length > 1 ? 0 : 0) + 800);
    expect(client.view.state.players.length).toBe(2);
  });

  it("meldet dem Client, wenn der Host die Runde beendet", () => {
    const { hostTransport, clientTransport } = pair();
    const host = new HostSession(hostTransport, SETUPS, "host", 42);
    const client = new ClientSession(clientTransport, SETUPS, "client", 42);

    host.destroy();

    expect(client.connectionLost).toContain("Host");
  });
});

describe("Ein Mitspieler verlaesst die Runde", () => {
  it("verschwindet aus der Simulation, statt als Geist stehenzubleiben", () => {
    /*
     * Frueher vergass der Host nur die Eingabe des Gegangenen. Seine Figur
     * blieb bewegungslos stehen, bis Gegner sie zu Boden brachten, und lag
     * danach halbdurchsichtig fuer den Rest der Runde da - einer der Wege zum
     * "durchsichtigen Doppel-Charakter". Ausserdem konnte das Team nie
     * extrahieren, solange die Figur noch stand: Sie erreichte die Zone nie.
     */
    const { hostTransport } = pair();
    const host = new HostSession(hostTransport, SETUPS, "host", 42);
    expect(host.view.state.players.map((player) => player.id)).toContain("client");

    hostTransport.simulateLeave("client");

    expect(host.view.state.players.map((player) => player.id)).toEqual(["host"]);
    host.destroy();
  });
});

describe("Neuer Run im selben Raum (Etappe 7)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gibt die Verbindung frei, ohne sie zu schliessen oder 'bye' zu senden", () => {
    const { hostTransport, clientTransport } = pair();
    const host = new HostSession(hostTransport, SETUPS, "host", 7);
    const client = new ClientSession(clientTransport, SETUPS, "client", 7);
    run(10, host, client, 1);

    const released = host.release();
    client.release();

    expect(released).toBe(hostTransport);
    // Die Verbindung steht noch: `close()` setzt bei der Attrappe `other` auf null.
    expect(hostTransport.other).toBe(clientTransport);
    expect(client.connectionLost).toBeNull();
  });

  it("startet ueber dieselbe Verbindung eine neue Welt mit neuem Seed", () => {
    // Die Lobby benutzt `window.setInterval` fuer Wiederholungen - im
    // Node-Test gibt es kein `window`, `globalThis` hat dieselben Timer.
    vi.stubGlobal("window", globalThis);

    const { hostTransport, clientTransport } = pair();
    const firstHost = new HostSession(hostTransport, SETUPS, "host", 7);
    const firstClient = new ClientSession(clientTransport, SETUPS, "client", 7);
    run(10, firstHost, firstClient, 1);

    // Run vorbei: beide geben die Verbindung weiter an eine neue Lobby.
    const hostLobby = new Lobby(firstHost.release(), { name: "Host", character: "scout" });
    const clientLobby = new Lobby(firstClient.release(), { name: "Client", character: "sniper" });

    let hostStart: { seed: number; count: number } | null = null;
    let clientStart: { seed: number; count: number; character?: string } | null = null;
    hostLobby.onStart((setups, seed) => {
      hostStart = { seed, count: setups.length };
    });
    clientLobby.onStart((setups, seed) => {
      clientStart = {
        seed,
        count: setups.length,
        character: setups.find((setup) => setup.id === "client")?.character,
      };
    });

    // Der Client hat sich mit `hello` gemeldet und steht in der Liste.
    expect(hostLobby.playerList.map((player) => player.id)).toEqual(["host", "client"]);

    hostLobby.start();
    hostLobby.destroy();
    clientLobby.destroy();

    expect(hostStart).not.toBeNull();
    expect(clientStart).not.toBeNull();
    const h = hostStart as unknown as { seed: number; count: number };
    const c = clientStart as unknown as { seed: number; count: number; character?: string };
    // Beide bauen dieselbe neue Welt: gleicher Seed, beide Spieler dabei ...
    expect(c.seed).toBe(h.seed);
    expect(h.count).toBe(2);
    // ... und der neue Charakter des Clients ist angekommen.
    expect(c.character).toBe("sniper");

    // Die neue Runde laeuft ueber genau diese Verbindung.
    const host = new HostSession(hostTransport, SETUPS, "host", h.seed);
    const client = new ClientSession(clientTransport, SETUPS, "client", c.seed);
    run(30, host, client, 1);
    expect(client.view.state.walls).toEqual(host.view.state.walls);
  });
});

describe("Rucksack-Befehl uebers Netz (Etappe 9)", () => {
  it("kommt vom Client beim Host an und wird dort ausgefuehrt", () => {
    const { hostTransport, clientTransport } = pair();
    const setups: PlayerSetup[] = [
      { id: "host", name: "Host", character: "scout" },
      {
        id: "client",
        name: "Client",
        character: "tank",
        backpack: [{ def: 0, x: 0, y: 0, rotated: false }],
      },
    ];
    const host = new HostSession(hostTransport, setups, "host", 3);
    const client = new ClientSession(clientTransport, setups, "client", 3);

    // Einmal senden, danach wieder ohne Befehl - er darf trotzdem nicht
    // verlorengehen, bis ein Tick ihn gesehen hat.
    client.update(TICK_MS * 3, makeInput({ x: 0, y: 0 }, {
      inventory: { op: "move", fromX: 0, fromY: 0, x: 4, y: 3, rotated: false },
    }));
    run(10, host, client, 0);

    const onHost = host.view.state.players.find((player) => player.id === "client");
    expect(onHost?.backpack.items[0]).toMatchObject({ x: 4, y: 3 });
    // Und er kommt im Zustandspaket zum Client zurueck.
    const onClient = client.view.state.players.find((player) => player.id === "client");
    expect(onClient?.backpack.items[0]).toMatchObject({ x: 4, y: 3 });
  });
});

