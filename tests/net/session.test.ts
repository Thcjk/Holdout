/**
 * Host und Client in einem Test - ohne Browser, ohne Netz.
 *
 * Moeglich ist das nur, weil die Verbindung hinter der Schnittstelle `Transport`
 * liegt: Hier wird sie durch zwei Enden ersetzt, die sich gegenseitig die
 * Nachrichten zustecken. Genau dafuer ist die Schnittstelle da - Netzwerkfehler
 * zeigen sich sonst erst auf zwei echten Geraeten, und dann sucht man lange.
 */

import { describe, expect, it } from "vitest";
import { TICK_MS } from "../../src/config/constants";
import { ClientSession } from "../../src/net/ClientSession";
import { HostSession } from "../../src/net/HostSession";
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

    expect(client.view.state.enemies.length).toBe(1);
    expect(client.view.state.zone).toBe(host.view.state.zone);
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
