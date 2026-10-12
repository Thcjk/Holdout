/**
 * Ein einfacher Bot, der eine ganze Runde spielt: ausweichen, einkaufen, weiter.
 *
 * Er ist KEIN guter Spieler - er kennt nur Abstand halten und eine feste
 * Einkaufsliste. Gerade deshalb taugt er als Messlatte: Schafft schon dieser
 * Bot die ersten Wellen, sind sie nicht zu hart; schafft er alle zwanzig ohne
 * Muehe, ist das Spiel zu leicht.
 */

import { ARENA } from "../src/game/constants";
import { CHARACTERS } from "../src/game/data/characters";
import { ENEMIES } from "../src/game/data/enemies";
import { ITEMS } from "../src/game/data/items";
import { WEAPONS } from "../src/game/data/weapons";
import type { WeaponId } from "../src/game/types";
import { UPGRADES } from "../src/game/data/upgrades";
import { Simulation } from "../src/game/Simulation";
import { canTakeWeapon, rerollCost } from "../src/game/shop";
import type { CharacterId, PlayerInput, PlayerState } from "../src/game/types";

/** Wie wertvoll ein Wert fuer den Bot ist. Grob: Schaden und Tempo zuerst, dann Leben. */
const STAT_WEIGHT: Record<string, number> = {
  damage: 1.2,
  melee: 3,
  ranged: 3,
  attackSpeed: 1.0,
  crit: 0.5,
  range: 0.05,
  maxHp: 0.45,
  regen: 1.5,
  armor: 1.8,
  dodge: 0.7,
  speed: 0.25,
  lifesteal: 0.6,
  harvesting: 0.9,
  luck: 0.1,
};

/** Wie nah der Bot an Gegner heranmuss: Nahkaempfer suchen die Naehe, Schuetzen meiden sie. */
function preferredDistance(player: PlayerState): number {
  let reach = 0;
  for (const weapon of player.weapons) {
    const def = WEAPONS[weapon.id];
    reach = Math.max(reach, def.kind === "melee" ? def.range * 0.7 : def.range * 0.8);
  }
  return reach;
}

export function steer(sim: Simulation, player: PlayerState): PlayerInput {
  let fx = 0;
  let fy = 0;
  const preferred = preferredDistance(player);
  const closeCombat = preferred < 160;

  if (closeCombat) {
    // Zum naechsten Gegner, aber nicht in die Mitte der Meute: an der Kante des Schwarms bleiben.
    let nearest: { x: number; y: number } | null = null;
    let nearestDistance = Infinity;
    for (const enemy of sim.state.enemies) {
      const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = enemy;
      }
    }
    if (nearest && nearestDistance > preferred) {
      fx += ((nearest.x - player.x) / nearestDistance) * 0.35;
      fy += ((nearest.y - player.y) / nearestDistance) * 0.35;
    }
  }

  for (const enemy of sim.state.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const radius = ENEMIES[enemy.type].radius;
    if (distance < (closeCombat ? 90 : 230)) {
      const weight = 1 / Math.max(25, distance - radius) ** 1.4;
      fx += (dx / (distance || 1)) * weight * (closeCombat ? 500 : 900);
      fy += (dy / (distance || 1)) * weight * (closeCombat ? 500 : 900);
    }
  }
  for (const shot of sim.state.shots) {
    if (shot.friendly) {
      continue;
    }
    const dx = player.x - shot.x;
    const dy = player.y - shot.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 120) {
      fx += (dx / (distance || 1)) * (1 / Math.max(20, distance)) * 12;
      fy += (dy / (distance || 1)) * (1 / Math.max(20, distance)) * 12;
    }
  }

  // Raender abstossen, damit der Bot sich nicht in eine Ecke druecken laesst.
  const margin = 70;
  fx += Math.max(0, margin - player.x) / margin - Math.max(0, player.x - (ARENA.width - margin)) / margin;
  fy += Math.max(0, margin - player.y) / margin - Math.max(0, player.y - (ARENA.height - margin)) / margin;

  // Ohne Gefahr zum naechsten Material.
  if (Math.hypot(fx, fy) < 0.15) {
    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;
    for (const pickup of sim.state.pickups) {
      const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = pickup;
      }
    }
    if (best) {
      return { mx: (best.x - player.x) / bestDistance, my: (best.y - player.y) / bestDistance };
    }
  }

  const length = Math.hypot(fx, fy);
  return length > 0.001 ? { mx: fx / length, my: fy / length } : { mx: 0, my: 0 };
}

function scoreItem(player: PlayerState, index: number): number {
  const item = ITEMS[index];
  if (!item) {
    return 0;
  }
  const hasMelee = player.weapons.some((weapon) => WEAPONS[weapon.id].kind === "melee");
  const hasRanged = player.weapons.some((weapon) => WEAPONS[weapon.id].kind === "ranged");
  let score = 0;
  for (const [key, value] of Object.entries(item.mods)) {
    let weight = STAT_WEIGHT[key] ?? 0;
    if (key === "melee" && !hasMelee) {
      weight = 0;
    }
    if (key === "ranged" && !hasRanged) {
      weight = 0;
    }
    score += weight * value;
  }
  return score / item.price;
}

function shopTurn(sim: Simulation, player: PlayerState): void {
  // Level-Ups: bevorzugt Schaden und Tempo.
  const preference = ["damage", "speedAtk", "melee", "ranged", "armor", "hp", "crit", "steal", "regen", "dodge"];
  let guard = 0;
  while (player.pendingLevels > 0 && guard < 80) {
    guard += 1;
    const choices = player.shop.upgradeChoices ?? [];
    let pick = 0;
    let bestRank = Infinity;
    choices.forEach((id, index) => {
      const rank = preference.indexOf(id);
      const effective = rank < 0 ? 99 : rank;
      if (effective < bestRank) {
        bestRank = effective;
        pick = index;
      }
    });
    if (!sim.command(player.id, { k: "upgrade", pick })) {
      break;
    }
  }
  void UPGRADES;

  for (let round = 0; round < 6; round += 1) {
    let bought = false;
    const wave = sim.state.wave;
    const options = player.shop.offers
      .map((offer, slot) => ({ offer, slot }))
      .filter((entry) => entry.offer !== null && entry.offer.price <= player.gold)
      .map(({ offer, slot }) => {
        if (!offer) {
          return { slot, score: -1 };
        }
        if (offer.kind === "weapon") {
          const id = offer.id as WeaponId;
          if (!canTakeWeapon(player, id, offer.tier)) {
            return { slot, score: -1 };
          }
          const def = WEAPONS[id];
          const dps = (def.damage[offer.tier - 1] ?? 1) * def.count / (def.cooldown[offer.tier - 1] ?? 1);
          const wantMore = player.weapons.length < CHARACTERS[player.character].slots ? 1.6 : 1;
          return { slot, score: (dps / offer.price) * 1.4 * wantMore };
        }
        const index = ITEMS.findIndex((item) => item.id === offer.id);
        return { slot, score: scoreItem(player, index) * 6 };
      })
      .sort((a, b) => b.score - a.score);

    const best = options[0];
    if (best && best.score > 0 && sim.command(player.id, { k: "buy", slot: best.slot })) {
      bought = true;
    }
    if (!bought) {
      if (player.gold >= rerollCost(player, wave) * 3 && player.shop.rerolls < 3) {
        sim.command(player.id, { k: "reroll" });
        continue;
      }
      break;
    }
  }
  // Doppelte Waffen verschmelzen - aber nur, wenn der Platz knapp wird.
  if (player.weapons.length >= CHARACTERS[player.character].slots - 1) {
    for (let i = 0; i < player.weapons.length; i += 1) {
      if (sim.command(player.id, { k: "merge", index: i })) {
        i = -1;
      }
    }
  }
  sim.command(player.id, { k: "ready", value: true });
}

export interface BotResult {
  /** Hoechste Welle, die erreicht wurde. */
  wave: number;
  won: boolean;
  kills: number;
  weapons: string;
}

export function playBot(options: {
  seed: number;
  character: CharacterId;
  startWeapon: WeaponId;
  /** Spielerzahl, alle vom Bot gesteuert. */
  players?: number;
  maxSeconds?: number;
}): BotResult {
  const count = options.players ?? 1;
  const setups = Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `Bot ${index}`,
    character: options.character,
    startWeapon: options.startWeapon,
  }));
  const sim = new Simulation(setups, options.seed);
  const limit = (options.maxSeconds ?? 2400) * 60;

  for (let tick = 0; tick < limit; tick += 1) {
    const phase = sim.state.phase;
    if (phase === "won" || phase === "lost") {
      break;
    }
    if (phase === "shop") {
      for (const player of sim.state.players) {
        shopTurn(sim, player);
      }
    }
    const inputs = new Map<string, PlayerInput>();
    for (const player of sim.state.players) {
      if (player.alive) {
        inputs.set(player.id, steer(sim, player));
      }
    }
    sim.step(inputs);
  }

  const first = sim.state.players[0];
  return {
    wave: sim.state.wave,
    won: sim.state.phase === "won",
    kills: sim.state.players.reduce((sum, player) => sum + player.kills, 0),
    weapons: first ? first.weapons.map((weapon) => `${weapon.id}${weapon.tier}`).join(",") : "",
  };
}
