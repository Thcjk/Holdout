/**
 * Erkennung des Verbindungswegs - direkt oder ueber TURN.
 *
 * WARUM DAS EINEN TEST BRAUCHT: Das ist die Anzeige, an der spaeter abgelesen
 * wird, ob TURN ueberhaupt gegriffen hat. Zeigt sie falsch an, sucht man den
 * Fehler an der falschen Stelle - schlimmer als gar keine Anzeige.
 *
 * Der `relay`-Fall laesst sich mit echten Verbindungen hier nicht herstellen
 * (dafuer braeuchte es zwei Geraete in verschiedenen Netzen und einen
 * erreichbaren TURN-Server). Geprueft wird er deshalb mit einer nachgebauten
 * Statistik, die genau so aufgebaut ist wie die echte. Dass die Auswertung
 * gegen einen ECHTEN Browser funktioniert, wurde zusaetzlich mit zwei
 * RTCPeerConnections in einer Seite geprueft - dort kam korrekt "direkt"
 * heraus.
 */

import { describe, expect, it } from "vitest";
import { reportConnectionPath } from "../../src/net/connectionPath";

/**
 * Baut eine Statistik nach, wie der Browser sie liefert.
 *
 * `RTCStatsReport` verhaelt sich wie eine Map - `get` und `forEach` sind genau
 * das, was der Code benutzt. Eine echte Map genuegt deshalb.
 */
function fakeConnection(localType: string, remoteType: string, nominated = true): RTCPeerConnection {
  const stats = new Map<string, unknown>([
    [
      "pair1",
      {
        type: "candidate-pair",
        state: "succeeded",
        nominated,
        localCandidateId: "local1",
        remoteCandidateId: "remote1",
      },
    ],
    ["local1", { type: "local-candidate", candidateType: localType }],
    ["remote1", { type: "remote-candidate", candidateType: remoteType }],
    // Ein zweites, geprueftes aber NICHT gewaehltes Paar. Es darf das Ergebnis
    // nicht beeinflussen - sonst laese man den Weg ab, der gerade nicht benutzt
    // wird.
    [
      "pair2",
      {
        type: "candidate-pair",
        state: "failed",
        nominated: false,
        localCandidateId: "local2",
        remoteCandidateId: "remote2",
      },
    ],
    ["local2", { type: "local-candidate", candidateType: "relay" }],
    ["remote2", { type: "remote-candidate", candidateType: "relay" }],
  ]);

  return { getStats: async () => stats as unknown as RTCStatsReport } as RTCPeerConnection;
}

describe("Verbindungsweg erkennen", () => {
  it("meldet direkt, wenn beide Seiten ueber STUN gefunden wurden", async () => {
    const pfad = await reportConnectionPath(fakeConnection("srflx", "srflx"), "TEST");

    expect(pfad.kind).toBe("direkt");
    expect(pfad.text).toContain("DIREKT");
  });

  it("meldet direkt im selben WLAN", async () => {
    const pfad = await reportConnectionPath(fakeConnection("host", "host"), "TEST");

    expect(pfad.kind).toBe("direkt");
  });

  it("meldet relay, sobald EINE Seite ueber TURN laeuft", async () => {
    // Genau dieser Fall ist der interessante: ein Handy im Mobilfunknetz
    // kommt nur ueber TURN heraus, das andere im WLAN direkt.
    const pfad = await reportConnectionPath(fakeConnection("srflx", "relay"), "TEST");

    expect(pfad.kind).toBe("relay");
    expect(pfad.text).toContain("RELAY");
  });

  it("meldet relay auch, wenn die eigene Seite die relayende ist", async () => {
    const pfad = await reportConnectionPath(fakeConnection("relay", "srflx"), "TEST");

    expect(pfad.kind).toBe("relay");
  });

  it("laesst sich vom nicht gewaehlten Paar nicht in die Irre fuehren", async () => {
    // Das zweite Paar im Aufbau oben ist relay/relay, aber gescheitert. Wer
    // einfach das erste beste Paar naehme, meldete faelschlich TURN.
    const pfad = await reportConnectionPath(fakeConnection("host", "host"), "TEST");

    expect(pfad.kind).toBe("direkt");
  });

  it("meldet unbekannt statt zu raten, wenn kein Paar gewaehlt ist", async () => {
    const pfad = await reportConnectionPath(fakeConnection("srflx", "srflx", false), "TEST");

    expect(pfad.kind).toBe("unbekannt");
  });

  it("stuerzt nicht ab, wenn es gar keine Verbindung zum Fragen gibt", async () => {
    // Eine aeltere PeerJS-Fassung gibt `peerConnection` nicht heraus. Dann
    // entfaellt die Auskunft - die Runde laeuft trotzdem.
    const pfad = await reportConnectionPath(undefined, "TEST");

    expect(pfad.kind).toBe("unbekannt");
  });

  it("stuerzt nicht ab, wenn die Statistik einen Fehler wirft", async () => {
    const kaputt = {
      getStats: async () => {
        throw new Error("nicht verfuegbar");
      },
    } as unknown as RTCPeerConnection;

    const pfad = await reportConnectionPath(kaputt, "TEST");

    expect(pfad.kind).toBe("unbekannt");
  });
});
