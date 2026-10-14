import { describe, expect, it } from "vitest";
import { DECK_H } from "../../src/game/constants";
import { Simulation } from "../../src/game/Simulation";
import type { PlayerInput, PlayerSetup } from "../../src/game/types";
import { ClientSession } from "../../src/net/ClientSession";
import { HostSession } from "../../src/net/HostSession";
import { decodeState, encodeState } from "../../src/net/protocol";
import { MemoryTransport } from "../memoryTransport";

const SETUPS: PlayerSetup[] = [
  { id: "host", name: "Host", crew: "schrauber" },
  { id: "guest", name: "Gast", crew: "funkerin" },
];
const IDLE: PlayerInput = { mx: 0, my: 0 };
const OPTIONS = { lengthFactor: 0.05 };

function connect(): {
  host: HostSession;
  client: ClientSession;
  clientTransport: MemoryTransport;
} {
  const hostTransport = new MemoryTransport("host", true);
  const clientTransport = new MemoryTransport("guest", false);
  const host = new HostSession(hostTransport, SETUPS, "host", 5, OPTIONS);
  // Bis der erste Zustand des Hosts da ist, steht hier die Ausgangslage.
  const initial = new Simulation(SETUPS, 5, OPTIONS).state;
  const client = new ClientSession(clientTransport, "guest", initial);
  hostTransport.connect(clientTransport);
  return { host, client, clientTransport };
}

function runBoth(
  host: HostSession,
  client: ClientSession,
  seconds: number,
  clientInput: PlayerInput = IDLE,
  hostInput: PlayerInput = IDLE,
): void {
  for (let i = 0; i < seconds * 60; i += 1) {
    host.update(1000 / 60, hostInput);
    client.update(1000 / 60, clientInput);
  }
}

describe("Zustand uebers Netz", () => {
  it("laesst sich kodieren und wieder lesen (Gegner, Geschosse, Karte)", () => {
    const sim = new Simulation(SETUPS, 3);
    sim.command("host", { kind: "depart" });
    for (let i = 0; i < 1200; i += 1) {
      sim.advance(1000 / 60, new Map());
    }
    const wire = structuredClone(encodeState(sim.state, true));
    const decoded = decodeState(wire, sim.state.map);
    expect(decoded.enemies.length).toBe(sim.state.enemies.length);
    expect(decoded.enemies[0]?.type).toBe(sim.state.enemies[0]?.type);
    expect(decoded.players.map((p) => p.crew)).toEqual(["schrauber", "funkerin"]);
    expect(decoded.map.nodes.length).toBe(sim.state.map.nodes.length);
    expect(decoded.fort.x).toBe(sim.state.fort.x);
    // Ohne Karte im Paket bleibt die vorige.
    const lean = decodeState(structuredClone(encodeState(sim.state, false)), sim.state.map);
    expect(lean.map).toBe(sim.state.map);
    expect(JSON.stringify(encodeState(sim.state, false)).length).toBeLessThan(
      JSON.stringify(sim.state).length,
    );
  });
});

describe("Host und Client", () => {
  it("der Client bekommt den Zustand des Hosts", () => {
    const { host, client } = connect();
    runBoth(host, client, 1);
    expect(client.isReady).toBe(true);
    expect(client.state.players.map((p) => p.id)).toEqual(["host", "guest"]);
  });

  it("die Bewegung des Clients erreicht die Simulation, seine Figur folgt ihm sofort", () => {
    const { host, client } = connect();
    runBoth(host, client, 0.5);
    const before = host.state.players.find((p) => p.id === "guest")!.x;
    runBoth(host, client, 0.6, { mx: 1, my: 0 });
    const after = host.state.players.find((p) => p.id === "guest")!.x;
    expect(after).toBeGreaterThan(before + 40);
    const shown = client.state.players.find((p) => p.id === "guest")!;
    expect(Math.abs(shown.x - after)).toBeLessThan(40);
  });

  it("Befehle kommen genau einmal an - auch wenn Pakete verloren gehen", () => {
    const { host, client, clientTransport } = connect();
    runBoth(host, client, 0.5);
    host.state.bank = 500;
    const type = host.state.offer[0]!;
    let counter = 0;
    clientTransport.drop = () => counter++ % 2 === 0;
    client.send({ kind: "build", module: type, col: 1, row: 3 });
    runBoth(host, client, 1.5);
    expect(host.state.modules).toHaveLength(1);
    expect(host.state.players.find((p) => p.id === "guest")!.lastCmd).toBe(1);
  });

  it("nur der Host waehlt den Weg", () => {
    const { host, client } = connect();
    runBoth(host, client, 0.5);
    client.send({ kind: "depart" });
    runBoth(host, client, 0.5);
    expect(host.state.phase).toBe("rest");
    host.send({ kind: "depart" });
    runBoth(host, client, 0.5);
    expect(host.state.phase).toBe("march");
    expect(client.state.phase).toBe("march");
  });

  it("Ereignisse des Hosts kommen beim Client an", () => {
    const { host, client } = connect();
    runBoth(host, client, 0.3);
    host.send({ kind: "depart" });
    let sawDepart = false;
    for (let i = 0; i < 60 && !sawDepart; i += 1) {
      runBoth(host, client, 1 / 60);
      sawDepart = client.events.some((e) => e.kind === "depart");
    }
    expect(sawDepart).toBe(true);
  });

  it("meldet dem Client, wenn der Host geht, und entfernt gegangene Clients", () => {
    const a = connect();
    runBoth(a.host, a.client, 0.3);
    a.host.destroy();
    expect(a.client.connectionLost).not.toBeNull();
    const b = connect();
    runBoth(b.host, b.client, 0.3);
    b.clientTransport.close();
    expect(b.host.state.players.map((p) => p.id)).toEqual(["host"]);
  });

  it("der Client zeigt seine Figur auch auf dem fahrenden Deck an der richtigen Stelle", () => {
    const { host, client } = connect();
    runBoth(host, client, 0.3);
    host.send({ kind: "depart" });
    runBoth(host, client, 2);
    const shown = client.state.players.find((p) => p.id === "guest")!;
    const fort = client.state.fort;
    expect(shown.layer).toBe("deck");
    expect(shown.y - fort.y).toBeLessThan(DECK_H);
    expect(shown.x - fort.x).toBeGreaterThan(0);
  });
});
