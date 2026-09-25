/**
 * Uebersetzt Spielereignisse in Klaenge.
 *
 * Eigene Datei, damit weder die Simulation noch die Darstellung etwas ueber Ton
 * wissen muss: Die Simulation meldet "Gegner gestorben", hier steht, wie das klingt.
 */

import type { GameEvent } from "../systems/types";
import type { SoundName } from "./AudioEngine";
import { audio } from "./AudioEngine";

function soundFor(event: GameEvent): SoundName | null {
  switch (event.type) {
    case "shot":
      return event.owner === "player" ? "shoot" : "enemyShoot";
    case "hit":
      return "hit";
    case "punch":
      // Der Treffer klingt zusaetzlich ueber sein eigenes "hit".
      return "swing";
    case "enemyDied":
      return "enemyDied";
    case "playerHit":
      return "playerHit";
    case "playerDown":
      return "playerDown";
    case "playerRevived":
      return "revive";
    case "superReady":
      return "superReady";
    case "superUsed":
      return "superUsed";
    case "blast":
      return "blast";
    case "healed":
      // Bei vollem Leben ist nichts angekommen - dann auch kein Ton.
      return event.amount > 0 ? "healed" : null;
    case "itemPicked":
      return "pickup";
    case "zoneReached":
      return "zoneReached";
    case "hordeStarted":
      // Deutlich und tief: Jetzt wird es ernst.
      return "playerDown";
    case "runEnded":
      // Denselben Klang fuer alle drei Ausgaenge - der Ergebnisbildschirm sagt
      // ohnehin sofort, welcher es war. Eigene Fanfaren waeren Phase 17.
      return "gameOver";
    default:
      return null;
  }
}

/**
 * Spielt die Klaenge eines Bildes.
 *
 * Gleiche Klaenge werden zusammengefasst: Sterben in einem Tick fuenf Gegner,
 * wuerde fuenffacher identischer Ton nur uebersteuern statt lauter zu wirken.
 */
export function playEventSounds(events: readonly GameEvent[]): void {
  const played = new Set<SoundName>();

  for (const event of events) {
    const sound = soundFor(event);
    if (sound && !played.has(sound)) {
      played.add(sound);
      audio.play(sound);
    }
  }
}
