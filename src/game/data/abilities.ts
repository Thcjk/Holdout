/**
 * Die Faehigkeiten: Jeder Held hat eine eigene, die man selbst ausloest.
 *
 * Waffen schiessen von allein - die Faehigkeit ist der eine Knopf, mit dem man
 * im Gefecht selbst eingreift. Danach muss sie sich erst wieder aufladen
 * (`cooldown`, verkuerzt durch den Wert "Faehigkeit-Tempo").
 *
 * Was sie genau tun, rechnet `Simulation.useAbility`.
 */

import type { CharacterId } from "../types";

export interface AbilityDef {
  name: string;
  description: string;
  /** Sekunden bis zur naechsten Benutzung. */
  cooldown: number;
}

export const ABILITIES: Record<CharacterId, AbilityDef> = {
  ritter: {
    name: "Schildwall",
    description: "Hebt den Schild: 3 Sekunden unverwundbar, heilt 20 % Leben, stößt nahe Gegner zurück.",
    cooldown: 12,
  },
  magierin: {
    name: "Feuerball",
    description: "Schleudert einen Feuerball auf den nächsten Gegner – er explodiert in großem Umkreis.",
    cooldown: 7,
  },
  schurke: {
    name: "Schattenschritt",
    description: "Springt ein Stück in Laufrichtung, unverwundbar und mit Schaden an allem auf dem Weg.",
    cooldown: 4.5,
  },
  elfe: {
    name: "Pfeilhagel",
    description: "Schießt 18 Pfeile in alle Richtungen, jeder durchschlägt mehrere Gegner.",
    cooldown: 8,
  },
  zwerg: {
    name: "Erdbeben",
    description: "Schlägt den Hammer in den Boden: Schaden ringsum, Gegner fliegen weg und sind betäubt.",
    cooldown: 6,
  },
  zauberer: {
    name: "Arkaner Sog",
    description: "Zieht alles Gold heran. 5 Sekunden lang +40 % Krit.",
    cooldown: 11,
  },
};

/** Abklingzeit mit dem Wert "Faehigkeit-Tempo" des Spielers. */
export function abilityCooldown(character: CharacterId, abilityStat: number): number {
  return ABILITIES[character].cooldown / (1 + abilityStat / 100);
}
