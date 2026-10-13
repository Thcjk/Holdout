/**
 * Gegner der goldenen Armee. In Etappe 1 gibt es nur den Sandlaeufer.
 */

import type { EnemyType } from "../types";

export interface EnemySpec {
  type: EnemyType;
  hp: number;
  speed: number;
  radius: number;
  /** Schaden am Rumpf je Hieb, wenn er an der Festung haengt. */
  hullDamage: number;
  /** Schaden an einem Mech je Hieb. */
  touchDamage: number;
  attackCooldown: number;
  /** Ab dieser Entfernung geht er auf einen Mech am Boden los statt auf die Festung. */
  aggro: number;
  /** Schrott, den er fallen laesst. */
  scrap: number;
}

export const ENEMIES: Record<EnemyType, EnemySpec> = {
  laeufer: {
    type: "laeufer",
    hp: 24,
    speed: 54,
    radius: 9,
    hullDamage: 4,
    touchDamage: 7,
    attackCooldown: 1.2,
    aggro: 90,
    scrap: 2,
  },
};
