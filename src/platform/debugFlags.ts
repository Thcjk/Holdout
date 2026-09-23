/**
 * Schalter zum Nachmessen, ueber die Adresszeile.
 *
 * Auf dem Handy gibt es keine Entwicklerwerkzeuge und keine Tastatur. Der
 * einzige Weg, im echten Spiel auf dem echten Geraet etwas sichtbar zu machen,
 * fuehrt deshalb ueber die Adresse der Seite:
 *
 *   .../Holdout/?debug=hitbox        Trefferradien als Umriss
 *   .../Holdout/?debug=hitbox,werte  zusaetzlich die wichtigsten Zahlen
 *   .../Holdout/?debug=netz          Protokoll des Koop-Verbindungsaufbaus
 *   .../Holdout/?seed=4242           immer dieselbe Welt (nur solo)
 *
 * Mehrere Schalter werden mit Komma getrennt. Ohne `?debug=` ist alles aus -
 * es kostet also niemanden etwas, der einfach spielt.
 */

function activeFlags(): Set<string> {
  try {
    const raw = new URLSearchParams(window.location.search).get("debug");
    if (!raw) {
      return new Set();
    }
    return new Set(
      raw
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    );
  } catch {
    // Kein window, kein Suchteil - dann eben keine Schalter.
    return new Set();
  }
}

// Einmal beim Laden auswerten: Die Adresse aendert sich im Spiel nicht mehr,
// und pro Bild neu zu zerlegen waere Arbeit fuer nichts.
const FLAGS = activeFlags();

/** Trefferradien von Spielern, Gegnern und Projektilen als Umriss zeichnen. */
export const SHOW_HITBOXES = FLAGS.has("hitbox") || FLAGS.has("1") || FLAGS.has("all");

/** Zahlenanzeige: Bildrate, Gegnerzahl, Munition, Schusstakt. */
export const SHOW_VALUES = FLAGS.has("werte") || FLAGS.has("values") || FLAGS.has("all");

/**
 * Protokoll des Verbindungsaufbaus im Koop, direkt auf dem Bildschirm.
 *
 * Auf dem Handy gibt es keine Konsole - ohne diese Anzeige laesst sich ein
 * Fehler, der nur zwischen zwei echten Geraeten auftritt, gar nicht ansehen.
 */
export const SHOW_NET_LOG = FLAGS.has("netz") || FLAGS.has("net") || FLAGS.has("all");

/**
 * Fester Seed aus der Adresse, oder `null` fuer eine zufaellige Welt.
 *
 * WOZU: Seit Phase 8 entsteht die Karte aus einer Zahl, und ein Fehler "beim
 * Boss weiter draussen" laesst sich ohne diese Zahl nicht nachstellen - beim
 * naechsten Start ist die Welt eine andere. Mit `?seed=` bekommt man exakt
 * dieselbe wieder, auch auf einem anderen Geraet.
 *
 * Nur solo: Im Koop gibt der Host den Seed vor, und ein Client mit eigenem
 * Seed saehe eine andere Karte als alle anderen - genau der Fehler, den die
 * Weltgenerierung vermeiden soll.
 */
export const FORCED_SEED: number | null = (() => {
  try {
    const raw = new URLSearchParams(window.location.search).get("seed");
    if (!raw) {
      return null;
    }
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value | 0 : null;
  } catch {
    return null;
  }
})();
