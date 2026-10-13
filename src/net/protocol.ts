/**
 * Nachrichten im Koop.
 *
 * Der Koop der Wanderfestung kommt in einer spaeteren Etappe. Bis dahin steht
 * hier nur die allgemeine Form, damit die Verbindungsschicht (PeerJS, TURN,
 * Raumcodes) erhalten bleibt und weiter getestet wird: Jede Nachricht ist ein
 * JSON-Objekt mit einem Kuerzel `t` fuer ihre Art.
 */

export interface NetMessage {
  t: string;
  [field: string]: unknown;
}
