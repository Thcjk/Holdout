/**
 * Kleine gemeinsame Dinge der Szenen: der Spielername.
 */

const NAME_KEY = "holdout.name";

/** Name des Spielers - einmal ausgewuerfelt und dann gemerkt. */
export function playerName(): string {
  try {
    const stored = window.localStorage.getItem(NAME_KEY);
    if (stored) {
      return stored;
    }
    const name = `Spieler ${10 + Math.floor(Math.random() * 90)}`;
    window.localStorage.setItem(NAME_KEY, name);
    return name;
  } catch {
    return "Spieler";
  }
}
