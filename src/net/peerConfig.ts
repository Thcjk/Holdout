/**
 * Womit sich zwei Geraete finden und verbinden.
 *
 * Fuer eine Verbindung ueber das Internet braucht es ZWEI verschiedene Dinge.
 * Sie werden oft verwechselt, und beide muessen stimmen:
 *
 * 1. SIGNALISIERUNG - "wie finden wir uns?"
 *    Ein kleiner Server, bei dem sich der Host unter seinem Raumcode anmeldet
 *    und bei dem der Client danach fragt. Er vermittelt nur den Kontakt;
 *    Spieldaten laufen nie darueber. Faellt er aus, meldet PeerJS
 *    "peer-unavailable" - also "diesen Raum gibt es nicht", obwohl der Host
 *    danebensitzt.
 *
 * 2. NAT-DURCHSTOSSUNG - "wie kommen wir aneinander vorbei?"
 *    Beide Geraete stehen hinter einem Router, im Mobilfunk sogar hinter dem
 *    Netz des Anbieters (CGNAT). Keines hat eine oeffentliche Adresse, unter
 *    der das andere es erreichen koennte. Dafuer gibt es zwei Hilfsmittel:
 *
 *      STUN  sagt einem Geraet nur, wie es von aussen aussieht. Kostet fast
 *            nichts und reicht in vielen Heimnetzen.
 *      TURN  leitet die Daten ueber einen fremden Server weiter, wenn direkt
 *            nichts geht. Kostet Bandbreite - und ist in Mobilfunknetzen
 *            haeufig die EINZIGE Moeglichkeit.
 *
 * WAS HIER GEFEHLT HAT: Bisher wurde `new Peer(id)` ohne jede Konfiguration
 * aufgerufen. Damit galten nur die eingebauten STUN-Server und **kein TURN**.
 * Im selben WLAN geht das meistens gut; ueber zwei verschiedene Netze - genau
 * der Fall "Freund kommt von zu Hause dazu" - scheitert es regelmaessig, und
 * zwar stumm: Der Raum wird gefunden, aber der Datenkanal geht nie auf.
 */

/**
 * Signalisierungsserver, der Reihe nach probiert.
 *
 * Mehrere, weil ein einzelner ein einzelner Ausfallpunkt ist. Der offizielle
 * PeerJS-Dienst ist gratis und wird von vielen benutzt - er ist gelegentlich
 * ueberlastet oder nicht erreichbar, und dann sieht es fuer den Spieler so aus,
 * als gaebe es den Raum nicht.
 *
 * `undefined` heisst "die Voreinstellung von PeerJS nehmen" - das ist der
 * offizielle Dienst.
 */
export interface SignalServer {
  label: string;
  options: Record<string, unknown> | undefined;
}

export const SIGNAL_SERVERS: SignalServer[] = [
  { label: "PeerJS-Cloud", options: undefined },
  {
    // Oeffentlicher, PeerJS-kompatibler Server als Ausweichmoeglichkeit.
    label: "Ausweichserver",
    options: { host: "peerjs.92k.de", port: 443, path: "/", secure: true },
  },
];

/**
 * STUN- und TURN-Server fuer die eigentliche Verbindung.
 *
 * Die TURN-Zugangsdaten hier sind oeffentlich und ausdruecklich zum Mitbenutzen
 * gedacht (Open Relay) - es sind keine Geheimnisse. Sie sind im Durchsatz
 * begrenzt: Fuer zwei bis vier Spieler reicht das, fuer ein Spiel mit vielen
 * Raeumen braeuchte es einen eigenen TURN-Server.
 *
 * Drei TURN-Eintraege mit verschiedenen Ports und Protokollen, weil strenge
 * Firewalls oft nur 443 durchlassen und manche nur TCP.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

/** Baut die Optionen fuer `new Peer(...)` fuer einen bestimmten Server. */
export function peerOptions(server: SignalServer): Record<string, unknown> {
  return {
    ...(server.options ?? {}),
    config: {
      iceServers: ICE_SERVERS,
      // Mehr Kandidaten sammeln, bevor aufgegeben wird. Der Standard ist 0
      // (unbegrenzt) - hier steht es nur, damit die Absicht sichtbar ist.
      iceCandidatePoolSize: 4,
    },
  };
}
