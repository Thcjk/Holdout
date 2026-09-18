/**
 * Welcher Weg wird wirklich benutzt - direkt oder ueber einen TURN-Server?
 *
 * WARUM DAS WICHTIG IST: Ohne diese Auskunft weiss man bei einer klappenden
 * Verbindung nicht, ob TURN gegriffen hat oder ob es auch ohne gegangen waere;
 * und bei einer scheiternden nicht, ob TURN gar nicht erst versucht wurde. Man
 * aendert dann Dinge auf Verdacht. Die Zahlen dafuer liegen im Browser bereit,
 * man muss sie nur abholen.
 *
 * WIE ES FUNKTIONIERT: WebRTC sammelt fuer jede Seite "Kandidaten" - moegliche
 * Adressen, unter denen sie erreichbar sein koennte:
 *
 *   host   die eigene Adresse im lokalen Netz. Geht nur im selben WLAN.
 *   srflx  "server reflexive" - die Adresse, unter der einen der Router nach
 *          aussen zeigt. Ueber STUN herausgefunden. Das ist der normale Weg
 *          fuer eine direkte Verbindung uebers Internet.
 *   prflx  "peer reflexive" - unterwegs entdeckt, ebenfalls direkt.
 *   relay  ueber einen TURN-Server. Alle Daten laufen ueber fremde Rechner.
 *          Das ist der Ausweg, wenn direkt nichts geht.
 *
 * Aus allen Kombinationen sucht der Browser ein Paar aus und benutzt es. Genau
 * dieses Paar fragen wir hier ab. Steht auf einer der beiden Seiten `relay`,
 * laeuft die Verbindung ueber TURN.
 */

import { netLog } from "./netLog";

/** Der benutzte Weg, in einfachen Worten. */
export type PathKind = "direkt" | "relay" | "unbekannt";

export interface ConnectionPath {
  kind: PathKind;
  /** Eine Zeile fuer Menschen, fertig zum Anzeigen. */
  text: string;
}

/**
 * Wie oft nachgefragt wird, bis das benutzte Paar feststeht.
 *
 * Der Datenkanal ist offen, bevor der Browser das gewaehlte Paar in seinen
 * Zahlen als "succeeded" fuehrt - einmal fragen liefert deshalb oft noch
 * nichts. Dreimal im Abstand von 400 ms reicht in der Praxis und faellt
 * niemandem auf.
 */
const ATTEMPTS = 3;
const RETRY_MS = 400;

/**
 * Fragt die Verbindung, welchen Weg sie nutzt, und schreibt es ins Protokoll.
 *
 * Absichtlich fehlertolerant: Diese Auskunft ist Diagnose, kein Spielinhalt.
 * Geht sie schief, darf die laufende Verbindung davon nichts merken - deshalb
 * fangen wir alles ab und melden im Zweifel "unbekannt".
 */
export async function reportConnectionPath(
  peerConnection: RTCPeerConnection | undefined,
  rolle: string,
): Promise<ConnectionPath> {
  const unknown: ConnectionPath = { kind: "unbekannt", text: "Verbindungsweg unbekannt" };

  if (!peerConnection || typeof peerConnection.getStats !== "function") {
    netLog(`${rolle}: Verbindungsweg nicht abfragbar`);
    return unknown;
  }

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const path = await readPath(peerConnection);
      if (path) {
        netLog(`${rolle}: ${path.text}`);
        return path;
      }
    } catch (error) {
      netLog(`${rolle}: Verbindungsweg nicht lesbar (${String(error)})`);
      return unknown;
    }

    if (attempt < ATTEMPTS - 1) {
      // Schlichtes `setTimeout`, nicht `window.setTimeout`: Dieselbe Funktion,
      // aber auch ausserhalb eines Browsers vorhanden - sonst laesst sich die
      // Auswertung nicht ohne Browser pruefen.
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }

  netLog(`${rolle}: ${unknown.text}`);
  return unknown;
}

/** Ein einzelner Blick in die Statistik. `null` heisst "noch nicht so weit". */
async function readPath(peerConnection: RTCPeerConnection): Promise<ConnectionPath | null> {
  const stats = await peerConnection.getStats();

  /*
   * Erst das benutzte Kandidatenpaar finden.
   *
   * `nominated` heisst "vom Browser ausgewaehlt", `succeeded` heisst "hat
   * funktioniert". Es kann mehrere gepruefte Paare geben; nur dieses eine
   * traegt gerade die Daten.
   */
  let pair: RTCIceCandidatePairStats | null = null;
  stats.forEach((report) => {
    if (report.type !== "candidate-pair") {
      return;
    }
    const candidatePair = report as RTCIceCandidatePairStats;
    if (candidatePair.state === "succeeded" && candidatePair.nominated) {
      pair = candidatePair;
    }
  });

  if (!pair) {
    return null;
  }

  // TypeScript sieht durch das forEach oben nicht, dass `pair` jetzt gesetzt
  // ist - die Zuweisung geschieht in einer Funktion.
  const chosen: RTCIceCandidatePairStats = pair;
  const local = candidateType(stats, chosen.localCandidateId);
  const remote = candidateType(stats, chosen.remoteCandidateId);

  if (!local && !remote) {
    return null;
  }

  // Es genuegt, dass EINE Seite ueber TURN laeuft - dann gehen die Daten
  // ueber den fremden Server.
  const viaRelay = local === "relay" || remote === "relay";

  return {
    kind: viaRelay ? "relay" : "direkt",
    text: viaRelay
      ? `Verbindung ueber TURN-RELAY (lokal ${label(local)}, entfernt ${label(remote)}) - direkt ging es nicht`
      : `Verbindung DIREKT (lokal ${label(local)}, entfernt ${label(remote)}) - kein TURN noetig`,
  };
}

/** Sucht zu einer Kandidaten-Kennung den Typ heraus. */
function candidateType(stats: RTCStatsReport, id: string | undefined): string | undefined {
  if (!id) {
    return undefined;
  }
  const entry = stats.get(id) as { candidateType?: string } | undefined;
  return entry?.candidateType;
}

/** Uebersetzt die Kurzform in etwas, das man lesen kann. */
function label(type: string | undefined): string {
  switch (type) {
    case "host":
      return "host/lokales Netz";
    case "srflx":
      return "srflx/ueber STUN";
    case "prflx":
      return "prflx/unterwegs entdeckt";
    case "relay":
      return "relay/ueber TURN";
    default:
      return type ?? "unbekannt";
  }
}
