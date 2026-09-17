/**
 * Schalter zum Nachmessen, ueber die Adresszeile.
 *
 * Auf dem Handy gibt es keine Entwicklerwerkzeuge und keine Tastatur. Der
 * einzige Weg, im echten Spiel auf dem echten Geraet etwas sichtbar zu machen,
 * fuehrt deshalb ueber die Adresse der Seite:
 *
 *   .../Holdout/?debug=hitbox        Trefferradien als Umriss
 *   .../Holdout/?debug=hitbox,werte  zusaetzlich die wichtigsten Zahlen
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
