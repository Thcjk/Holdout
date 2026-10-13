import { describe, expect, it } from "vitest";
import { Simulation } from "../../src/game/Simulation";
import type { PlayerInput, PlayerSetup } from "../../src/game/types";
import { ClientSession } from "../../src/net/ClientSession";
import { HostSession } from "../../src/net/HostSession";
import { decodeState, encodeState } from "../../src/net/protocol";
import { MemoryTransport } from "../memoryTransport";

const SETUPS: PlayerSetup[] = [
  { id: "host", name: "Host", character: "magierin", startWeapon: "pistol" },
  { id: "guest", name: "Gast", character: "elfe", startWeapon: "sniper" },
];
const IDLE: PlayerInput = { mx: 0, my: 0 };

function emptyState(): ReturnType<typeof decodeState> {
  return decodeState(encodeState(new Simulation([SETUPS[0]!], 1).state));
}

function connect(): { host: HostSession; client: ClientSession; hostTransport: MemoryTransport; clientTransport: MemoryTransport } {
  const hostTransport = new MemoryTransport("host", true);
  const clientTransport = new MemoryTransport("guest", false);
  const host = new HostSession(hostTransport, SETUPS, "host", 5);
  const client = new ClientSession(clientTransport, "guest", emptyState());
  hostTransport.connect(clientTransport);
  return { host, client, hostTransport, clientTransport };
}

/** Beide Seiten einige Sekunden laufen lassen. */
function runBoth(host: HostSession, client: ClientSession, seconds: number, clientInput: PlayerInput = IDLE): void {
  for (let i = 0; i < seconds * 60; i += 1) {
    host.update(1000 / 60, IDLE);
    client.update(1000 / 60, clientInput);
  }
}

describe("Zustand uebers Netz", () => {
  it("laesst sich verlustfrei kodieren und wieder lesen", () => {
    const sim = new Simulation(SETUPS, 3);
    for (let i = 0; i < 600; i += 1) {
      sim.step(new Map());
    }
    const decoded = decodeState(structuredClone(encodeState(sim.state)));
    expect(decoded.wave).toBe(sim.state.wave);
    expect(decoded.players).toHaveLength(2);
    expect(decoded.players[1]?.weapons[0]?.id).toBe("sniper");
    expect(decoded.enemies.length).toBe(sim.state.enemies.length);
    expect(decoded.players[0]?.stats.maxHp).toBe(sim.state.players[0]?.stats.maxHp);
  });
});

describe("Host und Client", () => {
  it("der Client bekommt den Zustand des Hosts", () => {
    const { host, client } = connect();
    runBoth(host, client, 2);
    expect(client.isReady).toBe(true);
    expect(client.view.state.players.map((player) => player.id)).toEqual(["host", "guest"]);
    expect(Math.abs(client.view.state.tick - host.view.state.tick)).toBeLessThan(12);
  });

  it("die Bewegung des Clients erreicht die Simulation auf dem Host", () => {
    const { host, client } = connect();
    const before = host.view.state.players.find((player) => player.id === "guest")?.x ?? 0;
    runBoth(host, client, 1.5, { mx: 1, my: 0 });
    const after = host.view.state.players.find((player) => player.id === "guest")?.x ?? 0;
    expect(after).toBeGreaterThan(before + 100);
    // Der Client zeichnet seine Figur etwa dort, wo der Host sie hat.
    const predicted = client.selfPosition();
    expect(predicted).not.toBeNull();
    expect(Math.abs((predicted?.x ?? 0) - after)).toBeLessThan(80);
  });

  it("Shop-Befehle kommen an und werden nur einmal ausgefuehrt - auch bei Paketverlust", () => {
    const { host, client, clientTransport } = connect();
    // Welle ohne Schaden zu Ende bringen.
    for (let i = 0; i < 70 * 60 && host.view.state.phase === "wave"; i += 1) {
      for (const player of host.view.state.players) {
        player.iframes = 1;
      }
      host.update(1000 / 60, IDLE);
      client.update(1000 / 60, IDLE);
    }
    expect(host.view.state.phase).toBe("shop");

    const guest = host.view.state.players.find((player) => player.id === "guest");
    if (!guest) {
      throw new Error("Gast fehlt");
    }
    guest.gold = 500;
    guest.pendingLevels = 0;
    guest.shop.upgradeChoices = null;
    const slot = guest.shop.offers.findIndex((offer) => offer?.kind === "item");
    expect(slot).toBeGreaterThanOrEqual(0);
    const price = guest.shop.offers[slot]?.price ?? 0;

    // Der Client-Weg verliert jedes zweite Paket.
    let counter = 0;
    clientTransport.drop = () => (counter++ % 2 === 0);
    client.send({ k: "buy", slot });
    for (let i = 0; i < 90; i += 1) {
      host.update(1000 / 60, IDLE);
      client.update(1000 / 60, IDLE);
    }
    expect(guest.gold).toBe(500 - price);
    expect(guest.lastCmd).toBe(1);
  });

  it("meldet dem Client, wenn der Host geht", () => {
    const { host, client } = connect();
    runBoth(host, client, 0.5);
    host.destroy();
    expect(client.connectionLost).not.toBeNull();
  });

  it("entfernt einen gegangenen Client aus der Runde", () => {
    const { host, client, clientTransport } = connect();
    runBoth(host, client, 0.5);
    clientTransport.close();
    expect(host.view.state.players.map((player) => player.id)).toEqual(["host"]);
  });
});
