/**
 * Der Abruf der TURN-Zugangsdaten.
 *
 * WARUM MIT EINEM GEFAELSCHTEN `fetch`: Der echte Endpunkt ist aus dieser
 * Entwicklungsumgebung gesperrt (der Proxy antwortet mit 403). Ein Test, der
 * vom Netz abhaengt, waere aber ohnehin keiner - er wuerde rot, sobald der
 * Anbieter langsam ist, und saegte damit an der Aussagekraft aller anderen
 * Tests. Geprueft wird deshalb genau das, was im eigenen Code steckt: Wird die
 * dokumentierte Antwort richtig verstanden, und faellt alles Uebrige sauber auf
 * die oeffentlichen Daten zurueck?
 */

import { describe, expect, it } from "vitest";
import {
  credentialsUrl,
  fetchIceServers,
  mergeWithStun,
  toIceServers,
} from "../../src/net/turnCredentials";

/** Eine Antwort, wie metered.ca sie laut Dokumentation liefert. */
const ECHTE_ANTWORT = [
  { urls: "stun:stun.metered.ca:80" },
  { urls: "turn:standard.relay.metered.ca:80", username: "abc123", credential: "xyz789" },
  {
    urls: "turn:standard.relay.metered.ca:443?transport=tcp",
    username: "abc123",
    credential: "xyz789",
  },
];

/** Baut ein Minimal-`fetch`, das eine feste Antwort liefert. */
function fakeFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return (async () =>
    ({
      ok,
      status,
      json: async () => body,
    }) as unknown as Response) as typeof fetch;
}

describe("Abrufpfad", () => {
  it("setzt den Schluessel aus der Umgebungsvariablen ein", () => {
    const url = credentialsUrl("holdout-turn", "geheim123");
    expect(url).toBe(
      "https://holdout-turn.metered.live/api/v1/turn/credentials?apiKey=geheim123",
    );
  });

  it("maskiert Sonderzeichen im Schluessel", () => {
    // Ein `&` im Schluessel wuerde die Adresse sonst an dieser Stelle
    // auseinanderreissen - alles danach waere ein eigener Parameter.
    expect(credentialsUrl("app", "a&b=c")).toContain("apiKey=a%26b%3Dc");
  });
});

describe("Antwort verstehen", () => {
  it("uebernimmt urls, username und credential", () => {
    const servers = toIceServers(ECHTE_ANTWORT);

    expect(servers).toHaveLength(3);
    expect(servers[1]).toEqual({
      urls: "turn:standard.relay.metered.ca:80",
      username: "abc123",
      credential: "xyz789",
    });
  });

  it("laesst einen reinen STUN-Eintrag ohne Zugangsdaten stehen", () => {
    const servers = toIceServers([{ urls: "stun:stun.metered.ca:80" }]);

    expect(servers[0]).toEqual({ urls: "stun:stun.metered.ca:80" });
    expect(servers[0]).not.toHaveProperty("username");
  });

  it("wirft Eintraege ohne urls weg, statt sie weiterzureichen", () => {
    // Ein Eintrag ohne Adresse bringt WebRTC nicht zum Absturz, er tut nur
    // nichts - und man suchte den Fehler dann an der falschen Stelle.
    const servers = toIceServers([{ username: "a", credential: "b" }, ...ECHTE_ANTWORT]);

    expect(servers).toHaveLength(3);
  });

  it("liefert nichts, wenn die Antwort gar keine Liste ist", () => {
    // Genau das kommt zurueck, wenn der Schluessel ungueltig ist: eine
    // Fehlermeldung als Objekt statt einer Liste.
    expect(toIceServers({ error: "invalid api key" })).toEqual([]);
    expect(toIceServers(null)).toEqual([]);
    expect(toIceServers("kaputt")).toEqual([]);
  });
});

describe("Zusammenfuehren mit STUN", () => {
  it("stellt den oeffentlichen STUN-Eintrag voran und behaelt alle eigenen", () => {
    const merged = mergeWithStun(toIceServers(ECHTE_ANTWORT));

    expect(merged[0]).toEqual({ urls: "stun:stun.l.google.com:19302" });
    expect(merged).toHaveLength(4);
  });
});

describe("Abruf und Rueckfall", () => {
  it("gibt bei einer gueltigen Antwort die Server zurueck", async () => {
    const servers = await fetchIceServers("https://egal", fakeFetch(ECHTE_ANTWORT));

    expect(servers).toHaveLength(3);
  });

  it("wirft bei einem Fehlercode - der Aufrufer faellt dann zurueck", async () => {
    // 401 ist der Fall "Schluessel ungueltig oder abgelaufen".
    await expect(
      fetchIceServers("https://egal", fakeFetch({ error: "unauthorized" }, false, 401)),
    ).rejects.toThrow("HTTP 401");
  });

  it("wirft bei einem Netzwerkfehler", async () => {
    const kaputt = (async () => {
      throw new Error("Failed to fetch");
    }) as typeof fetch;

    await expect(fetchIceServers("https://egal", kaputt)).rejects.toThrow("Failed to fetch");
  });
});
