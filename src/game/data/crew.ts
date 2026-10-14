/**
 * Die Mechs der Crew: jeder mit eigener Waffe, Faehigkeit und Eigenheit.
 *
 *   Schrauber        - Nietkanone; Notreparatur; flickt Module im Vorbeigehen
 *   Kanonier         - Schulterkanone mit Splitterwirkung; Breitseite (Granatenhagel);
 *                      Waffenmodule neben ihm feuern schneller
 *   Brecher          - Hammer (Nahkampf, trifft alles vor ihm); Rammstoss wirft Gegner
 *                      sogar vom Deck; steckt weniger Schaden ein
 *   Bergungslaeuferin - schnelle Salven; Enterhaken (hoch aufs Deck oder Schrott heranziehen);
 *                      sammelt aus grosser Entfernung, die Seilwinde kostet bei ihr nichts
 *   Funkerin         - zwei Drohnen schiessen mit; Luftschlag; sieht Trupps frueher kommen
 *   Sturmspringer    - Lanze (trifft zwei hintereinander); Sturzflug ins Getuemmel;
 *                      springt ueberall aufs Deck, nicht nur an der Strickleiter
 */

import type { CrewId } from "../types";

export interface WeaponSpec {
  name: string;
  /** `shot`: Geschoss. `melee`: trifft alle im Halbkreis vor dem Mech. */
  kind: "shot" | "melee";
  damage: number;
  /** Sekunden zwischen zwei Schuessen. */
  cooldown: number;
  range: number;
  /** Geschosstempo in Pixeln pro Sekunde. */
  speed: number;
  /** Splitter: so weit trifft der Einschlag auch Nachbarn (mit halbem Schaden). */
  splash?: number;
  /** Durchschlag: so viele Gegner trifft ein Geschoss hintereinander. */
  pierce?: number;
}

export interface AbilitySpec {
  name: string;
  /** Kurz, was sie tut (Knopf, Auswahl). */
  text: string;
  cooldown: number;
}

export interface CrewSpec {
  id: CrewId;
  name: string;
  /** Eigenheit in einem Satz. */
  passive: string;
  hp: number;
  speed: number;
  weapon: WeaponSpec;
  ability: AbilitySpec;
  /** Altgold in der Werft (0 = von Anfang an dabei). */
  unlock: number;
  /** Flickt Module in der Naehe (Leben pro Sekunde), solange er auf dem Deck steht. */
  moduleRepair?: number;
  /** Waffenmodule im Umkreis feuern so viel schneller (nur vom Deck aus). */
  moduleBoost?: number;
  /** Nimmt so viel weniger Schaden (0,3 = 30 % weniger). */
  armor?: number;
  /** Zieht Schrott aus dieser Entfernung heran. */
  pickup?: number;
  /** Seilwinde kostet keinen Rumpf. */
  freeWinch?: boolean;
  /** Zwei Drohnen schiessen mit. */
  drones?: boolean;
  /** Trupps sind so viel frueher angekuendigt (Sekunden). */
  earlyWarning?: number;
  /** Kann ueberall aufs Deck springen. */
  leapUp?: boolean;
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

export const CREW: Record<CrewId, CrewSpec> = {
  schrauber: {
    id: "schrauber",
    name: "Schrauber",
    passive: "Flickt Module, neben denen er steht.",
    hp: 100,
    speed: 125,
    weapon: { name: "Nietkanone", kind: "shot", damage: 9, cooldown: 0.3, range: 250, speed: 520 },
    ability: {
      name: "Notreparatur",
      text: "+45 Rumpf, heilt sich und alle Module in der Nähe.",
      cooldown: 30,
    },
    unlock: 0,
    moduleRepair: 8,
  },
  kanonier: {
    id: "kanonier",
    name: "Kanonier",
    passive: "Waffenmodule neben ihm feuern 25 % schneller.",
    hp: 100,
    speed: 115,
    weapon: {
      name: "Schulterkanone",
      kind: "shot",
      damage: 20,
      cooldown: 0.7,
      range: 290,
      speed: 460,
      splash: 26,
    },
    ability: {
      name: "Breitseite",
      text: "Acht Granaten auf die nächsten Gegner.",
      cooldown: 26,
    },
    unlock: 150,
    moduleBoost: 0.25,
  },
  brecher: {
    id: "brecher",
    name: "Brecher",
    passive: "Steckt 30 % weniger Schaden ein.",
    hp: 140,
    speed: 108,
    weapon: { name: "Dampfhammer", kind: "melee", damage: 24, cooldown: 0.55, range: 46, speed: 0 },
    ability: {
      name: "Rammstoß",
      text: "Stürmt vor und schleudert Gegner weg – sogar vom Deck.",
      cooldown: 16,
    },
    unlock: 200,
    armor: 0.3,
  },
  bergung: {
    id: "bergung",
    name: "Bergungsläuferin",
    passive: "Sammelt Schrott von weit her, die Seilwinde kostet nichts.",
    hp: 85,
    speed: 152,
    weapon: {
      name: "Salvenpistole",
      kind: "shot",
      damage: 6,
      cooldown: 0.16,
      range: 210,
      speed: 600,
    },
    ability: {
      name: "Enterhaken",
      text: "Am Boden: zurück aufs Deck. Oben: holt allen Schrott in der Nähe.",
      cooldown: 12,
    },
    unlock: 200,
    pickup: 150,
    freeWinch: true,
  },
  funkerin: {
    id: "funkerin",
    name: "Funkerin",
    passive: "Zwei Drohnen schießen mit, Trupps sieht sie früher kommen.",
    hp: 90,
    speed: 120,
    weapon: { name: "Funkpistole", kind: "shot", damage: 7, cooldown: 0.3, range: 240, speed: 540 },
    ability: {
      name: "Luftschlag",
      text: "Fünf Einschläge auf die dichteste Gruppe.",
      cooldown: 28,
    },
    unlock: 300,
    drones: true,
    earlyWarning: 1.5,
  },
  springer: {
    id: "springer",
    name: "Sturmspringer",
    passive: "Springt überall aufs Deck, nicht nur an der Strickleiter.",
    hp: 95,
    speed: 135,
    weapon: {
      name: "Lanze",
      kind: "shot",
      damage: 16,
      cooldown: 0.42,
      range: 120,
      speed: 700,
      pierce: 2,
    },
    ability: {
      name: "Sturzflug",
      text: "Springt mitten in die nächste Gruppe und reißt sie um.",
      cooldown: 15,
    },
    unlock: 350,
    leapUp: true,
  },
};
