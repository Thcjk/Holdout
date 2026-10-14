/**
 * Die Mechs der Crew. In Etappe 1 ist nur der Schrauber spielbar; die anderen
 * stehen schon hier, damit Namen und Reihenfolge feststehen.
 */

import type { CrewId } from "../types";

export interface WeaponSpec {
  name: string;
  damage: number;
  /** Sekunden zwischen zwei Schuessen. */
  cooldown: number;
  range: number;
  /** Geschosstempo in Pixeln pro Sekunde. */
  speed: number;
}

export interface AbilitySpec {
  name: string;
  cooldown: number;
  /** Rumpf und eigenes Leben, das die Faehigkeit heilt (nur Notreparatur). */
  hull?: number;
  heal?: number;
}

export interface CrewSpec {
  id: CrewId;
  name: string;
  hp: number;
  speed: number;
  weapon: WeaponSpec;
  ability: AbilitySpec;
  /** Flickt Module in der Naehe (Leben pro Sekunde), solange er auf dem Deck steht. */
  moduleRepair?: number;
  playable: boolean;
}

/** Reihenfolge der Mechs (Auswahl, Freischalten). */
export const CREW_IDS: readonly CrewId[] = [
  "schrauber",
  "kanonier",
  "brecher",
  "bergung",
  "funkerin",
  "springer",
];

const RIVET: WeaponSpec = { name: "Nietkanone", damage: 9, cooldown: 0.3, range: 250, speed: 520 };

export const CREW: Record<CrewId, CrewSpec> = {
  schrauber: {
    id: "schrauber",
    name: "Schrauber",
    hp: 100,
    speed: 125,
    weapon: RIVET,
    ability: { name: "Notreparatur", cooldown: 30, hull: 45, heal: 40 },
    moduleRepair: 8,
    playable: true,
  },
  kanonier: {
    id: "kanonier",
    name: "Kanonier",
    hp: 100,
    speed: 115,
    weapon: RIVET,
    ability: { name: "Breitseite", cooldown: 30 },
    playable: false,
  },
  brecher: {
    id: "brecher",
    name: "Brecher",
    hp: 140,
    speed: 105,
    weapon: RIVET,
    ability: { name: "Rammstoß", cooldown: 20 },
    playable: false,
  },
  bergung: {
    id: "bergung",
    name: "Bergungsläuferin",
    hp: 85,
    speed: 150,
    weapon: RIVET,
    ability: { name: "Enterhaken", cooldown: 15 },
    playable: false,
  },
  funkerin: {
    id: "funkerin",
    name: "Funkerin",
    hp: 90,
    speed: 120,
    weapon: RIVET,
    ability: { name: "Luftschlag", cooldown: 30 },
    playable: false,
  },
  springer: {
    id: "springer",
    name: "Sturmspringer",
    hp: 95,
    speed: 135,
    weapon: RIVET,
    ability: { name: "Sturzflug", cooldown: 18 },
    playable: false,
  },
};
