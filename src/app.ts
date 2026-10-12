/**
 * Kleine gemeinsame Dinge der Szenen: Spielername, Weitergabe zwischen Menues.
 */

import type { CharacterId, WeaponId } from "./game/types";

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

export type PlayMode = "solo" | "host" | "join";

/** Was die Charakterwahl an die naechste Szene weitergibt. */
export interface Pick {
  mode: PlayMode;
  character: CharacterId;
  weapon: WeaponId;
}
