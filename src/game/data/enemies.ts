/**
 * Die Gegner und der Wellenplan.
 *
 * Gegner werden mit der Welle staerker (`hpScale`, `damageScale`) - und zwar
 * schneller, als ein einzelner Gegenstand mithalten kann. Wer durchkommen will,
 * muss einen Build bauen, nicht nur Stapel kaufen.
 */

import type { EnemyType } from "../types";

export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number;
  /** Beruehrungsschaden (vor Wellenaufschlag). */
  damage: number;
  radius: number;
  /** Wert eines Materialstuecks, das er fallen laesst. */
  drop: number;
  /** Wahrscheinlichkeit, dass er etwas fallen laesst (Glueck erhoeht sie). */
  dropChance: number;
  /** "Kosten" im Wellenbudget. */
  cost: number;
  /** Ab welcher Welle er vorkommt. */
  minWave: number;
  /** Wie stark er sich vom Rueckstoss beeindrucken laesst (1 = voll, 0 = gar nicht). */
  knockback: number;
  color: number;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  grunt: {
    type: "grunt",
    name: "Larve",
    hp: 18,
    speed: 88,
    damage: 6,
    radius: 10,
    drop: 2,
    dropChance: 1,
    cost: 1,
    minWave: 1,
    knockback: 1,
    color: 0x8fbf6a,
  },
  swarmer: {
    type: "swarmer",
    name: "Wuselchen",
    hp: 7,
    speed: 150,
    damage: 3,
    radius: 7,
    drop: 1,
    dropChance: 0.5,
    cost: 0.5,
    minWave: 3,
    knockback: 1.3,
    color: 0xc3e06c,
  },
  charger: {
    type: "charger",
    name: "Stürmer",
    hp: 16,
    speed: 80,
    damage: 9,
    radius: 11,
    drop: 3,
    dropChance: 1,
    cost: 2,
    minWave: 4,
    knockback: 0.8,
    color: 0xb5532f,
  },
  spitter: {
    type: "spitter",
    name: "Spucker",
    hp: 16,
    speed: 70,
    damage: 5,
    radius: 10,
    drop: 3,
    dropChance: 1,
    cost: 2,
    minWave: 2,
    knockback: 1,
    color: 0x9b6ad3,
  },
  bruiser: {
    type: "bruiser",
    name: "Brocken",
    hp: 75,
    speed: 58,
    damage: 12,
    radius: 17,
    drop: 8,
    dropChance: 1,
    cost: 5,
    minWave: 6,
    knockback: 0.3,
    color: 0x6b4f3a,
  },
  elite: {
    type: "elite",
    name: "Königslarve",
    hp: 320,
    speed: 76,
    damage: 15,
    radius: 27,
    drop: 40,
    dropChance: 1,
    cost: 0,
    minWave: 8,
    knockback: 0,
    color: 0x3f7d3a,
  },
  boss: {
    type: "boss",
    name: "Alien-Boss",
    hp: 900,
    speed: 70,
    damage: 18,
    radius: 34,
    drop: 80,
    dropChance: 1,
    cost: 0,
    minWave: 20,
    knockback: 0,
    color: 0x7a2d9e,
  },
};

/** Letzte Welle. Wer sie ueberlebt, hat gewonnen. */
export const FINAL_WAVE = 20;

/** Wellenlaenge in Sekunden: 20, 25, ... bis hoechstens 60. */
export function waveLength(wave: number): number {
  return Math.min(60, 15 + wave * 5);
}

/** Lebenspunkte-Faktor der Gegner in dieser Welle. */
export function hpScale(wave: number): number {
  const w = wave - 1;
  return 1 + 0.2 * w + 0.04 * w * w;
}

export function damageScale(wave: number): number {
  return 1 + 0.12 * (wave - 1);
}

export function speedScale(wave: number): number {
  return Math.min(1.4, 1 + 0.016 * (wave - 1));
}

/** Zusaetzliche Gegner je weiterem Spieler: Der Koop wird enger, nicht beliebig leicht. */
export function playerCountScale(players: number): number {
  return 1 + 0.7 * (Math.max(1, players) - 1);
}

/** Und etwas zaeher: Vier Spieler richten mehr aus, also halten die Gegner mehr aus. */
export function playerCountHp(players: number): number {
  return 1 + 0.25 * (Math.max(1, players) - 1);
}

export interface SpawnPlan {
  /** Sekunde der Welle, in der das Kreuz erscheint. */
  at: number;
  type: EnemyType;
  count: number;
}

/** Gewichte, mit denen der Wellenplan die Gegnerarten mischt. */
function weightOf(type: EnemyType, wave: number): number {
  const def = ENEMIES[type];
  if (wave < def.minWave || type === "elite" || type === "boss") {
    return 0;
  }
  switch (type) {
    case "grunt":
      return 6;
    case "swarmer":
      return 2;
    case "spitter":
      return 2;
    case "charger":
      return 2 + Math.min(2, (wave - 4) * 0.2);
    case "bruiser":
      return 1.2 + Math.min(1.5, (wave - 6) * 0.15);
    default:
      return 0;
  }
}

function groupSize(type: EnemyType, rng: () => number): number {
  switch (type) {
    case "grunt":
      return 1 + Math.floor(rng() * 3);
    case "swarmer":
      return 5;
    case "charger":
    case "spitter":
      return 1 + Math.floor(rng() * 2);
    default:
      return 1;
  }
}

/**
 * Plant eine Welle: eine Liste "wann erscheint welche Gruppe".
 *
 * Das Budget waechst mit der Welle und mit der Wellenlaenge. Gruppen kommen zu
 * zufaelligen Zeiten, aber nie in den letzten Sekunden - ein Gegner, der erst
 * kurz vor Schluss auftaucht, waere nur Beute ohne Gefahr.
 */
export function planWave(wave: number, players: number, rng: () => number): SpawnPlan[] {
  const length = waveLength(wave);
  let budget = (6 + 4.6 * wave) * (length / 30) * playerCountScale(players);
  const types = (Object.keys(ENEMIES) as EnemyType[]).filter((type) => weightOf(type, wave) > 0);
  const total = types.reduce((sum, type) => sum + weightOf(type, wave), 0);

  const plan: SpawnPlan[] = [];
  const earliest = 1;
  const latest = Math.max(earliest + 1, length - 5);

  while (budget > 0) {
    let roll = rng() * total;
    let chosen: EnemyType = "grunt";
    for (const type of types) {
      roll -= weightOf(type, wave);
      if (roll <= 0) {
        chosen = type;
        break;
      }
    }
    const count = groupSize(chosen, rng);
    plan.push({ at: earliest + rng() * (latest - earliest), type: chosen, count });
    budget -= ENEMIES[chosen].cost * count;
  }

  // Zwischengegner stehen fest am Anfang der Welle.
  if (wave === 8 || wave === 12 || wave === 16) {
    plan.push({ at: 2, type: "elite", count: wave === 16 ? 2 : 1 });
  }
  if (wave === FINAL_WAVE) {
    plan.push({ at: 2, type: "boss", count: 1 });
    plan.push({ at: 12, type: "elite", count: 2 });
  }

  return plan.sort((a, b) => a.at - b.at);
}
