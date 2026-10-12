/**
 * Der Shop zwischen den Wellen: Angebote wuerfeln, kaufen, verkaufen, Level-Ups waehlen.
 *
 * Alles reine Funktionen auf dem Spielerzustand - der Host ruft sie auf, wenn
 * ein Befehl eintrifft. Jede gibt `true` zurueck, wenn sie etwas veraendert hat.
 */

import { SHOP_SLOTS } from "./constants";
import { CHARACTERS } from "./data/characters";
import { ITEMS } from "./data/items";
import { UPGRADES } from "./data/upgrades";
import { MAX_TIER, TIER_PRICE, WEAPONS } from "./data/weapons";
import { recomputeStats, weaponSlots } from "./player";
import type { Rng } from "./rng";
import { pick } from "./rng";
import type { Offer, OwnedWeapon, PlayerState, WeaponId } from "./types";

/** Alles wird mit der Welle teurer - sonst haette man ab Welle 8 immer genug. */
function waveFactor(wave: number): number {
  return 1.3 + 0.13 * (wave - 1);
}

export function itemPrice(itemIndex: number, wave: number): number {
  const item = ITEMS[itemIndex];
  return Math.max(1, Math.round((item?.price ?? 20) * waveFactor(wave)));
}

export function weaponPrice(id: WeaponId, tier: number, wave: number): number {
  const factor = TIER_PRICE[tier - 1] ?? 1;
  return Math.max(1, Math.round(WEAPONS[id].price * factor * waveFactor(wave)));
}

/** Was beim Verkauf einer Waffe zurueckkommt: die Haelfte des heutigen Preises. */
export function sellPrice(weapon: OwnedWeapon, wave: number): number {
  return Math.max(1, Math.floor(weaponPrice(weapon.id, weapon.tier, wave) / 2));
}

/** Neu wuerfeln kostet mehr, je oefter man es in dieser Pause schon getan hat. */
export function rerollCost(player: PlayerState, wave: number): number {
  return Math.ceil(wave * 0.8) + player.shop.rerolls * Math.ceil(1 + wave * 0.4);
}

/** Welche Stufe eine angebotene Waffe hat. Glueck hebt die Chancen auf hoehere Stufen. */
export function rollTier(wave: number, luck: number, rng: Rng): number {
  const boost = Math.max(0.3, 1 + luck / 100);
  const p4 = Math.min(0.2, Math.max(0, 0.02 * (wave - 11))) * boost;
  const p3 = Math.min(0.35, Math.max(0, 0.035 * (wave - 6))) * boost;
  const p2 = Math.min(0.6, Math.max(0, 0.06 * (wave - 2))) * boost;
  const roll = rng();
  if (roll < p4) {
    return 4;
  }
  if (roll < p4 + p3) {
    return 3;
  }
  if (roll < p4 + p3 + p2) {
    return 2;
  }
  return 1;
}

function rollOffer(player: PlayerState, wave: number, rng: Rng, taken: Set<string>): Offer | null {
  const character = CHARACTERS[player.character];
  const wantWeapon = rng() < 0.35;

  if (wantWeapon) {
    const options = character.allowed.filter((id) => !taken.has(`w:${id}`));
    if (options.length > 0) {
      const id = pick(rng, options);
      const tier = rollTier(wave, player.stats.luck, rng);
      taken.add(`w:${id}`);
      return { kind: "weapon", id, tier, price: weaponPrice(id, tier, wave) };
    }
  }

  const indices = ITEMS.map((_, index) => index).filter((index) => !taken.has(`i:${index}`));
  if (indices.length === 0) {
    return null;
  }
  const index = pick(rng, indices);
  taken.add(`i:${index}`);
  return { kind: "item", id: ITEMS[index]?.id ?? "", tier: 1, price: itemPrice(index, wave) };
}

/** Wuerfelt alle Plaetze neu, ausser den gesperrten. */
export function refreshOffers(player: PlayerState, wave: number, rng: Rng): void {
  const taken = new Set<string>();
  // Gesperrte Angebote zuerst eintragen, damit die neuen sie nicht doppeln.
  player.shop.offers.forEach((offer, slot) => {
    if (offer && player.shop.locked[slot]) {
      taken.add(offer.kind === "weapon" ? `w:${offer.id}` : `i:${ITEMS.findIndex((i) => i.id === offer.id)}`);
    }
  });

  for (let slot = 0; slot < SHOP_SLOTS; slot += 1) {
    const current = player.shop.offers[slot];
    if (current && player.shop.locked[slot]) {
      // Der Preis folgt der Welle, auch wenn das Angebot gesperrt blieb.
      current.price =
        current.kind === "weapon"
          ? weaponPrice(current.id as WeaponId, current.tier, wave)
          : itemPrice(
              ITEMS.findIndex((item) => item.id === current.id),
              wave,
            );
      continue;
    }
    player.shop.locked[slot] = false;
    player.shop.offers[slot] = rollOffer(player, wave, rng, taken);
  }
}

/** Bereitet die Pause fuer einen Spieler vor. */
export function openShop(player: PlayerState, wave: number, rng: Rng): void {
  player.shop.rerolls = 0;
  player.ready = false;
  refreshOffers(player, wave, rng);
  prepareUpgradeChoices(player, rng);
}

/**
 * Verschmilzt die Waffe an `index` mit einer gleichen derselben Stufe zur naechsten Stufe.
 *
 * Bewusst ein eigener Befehl: Wer sechs Faeuste tragen will (der Raufbold),
 * soll sie nicht gegen seinen Willen verschmelzen muessen. Nur wenn kein Platz
 * mehr frei ist, verschmilzt der Kauf von selbst (siehe `buy`).
 */
export function merge(player: PlayerState, index: number): boolean {
  const weapon = player.weapons[index];
  if (!weapon || weapon.tier >= MAX_TIER) {
    return false;
  }
  const other = player.weapons.findIndex(
    (candidate, i) => i !== index && candidate.id === weapon.id && candidate.tier === weapon.tier,
  );
  if (other < 0) {
    return false;
  }
  weapon.tier += 1;
  player.weapons.splice(other, 1);
  return true;
}

/** Kann dieser Spieler die Waffe aufnehmen (freier Platz oder Verschmelzung)? */
export function canTakeWeapon(player: PlayerState, id: WeaponId, tier: number): boolean {
  if (player.weapons.length < weaponSlots(player)) {
    return true;
  }
  return player.weapons.some((weapon) => weapon.id === id && weapon.tier === tier && tier < MAX_TIER);
}

export function buy(player: PlayerState, slot: number): boolean {
  const offer = player.shop.offers[slot];
  if (!offer || player.gold < offer.price) {
    return false;
  }

  if (offer.kind === "weapon") {
    const id = offer.id as WeaponId;
    if (!canTakeWeapon(player, id, offer.tier)) {
      return false;
    }
    const twin = player.weapons.find((weapon) => weapon.id === id && weapon.tier === offer.tier);
    if (player.weapons.length >= weaponSlots(player) && twin) {
      // Kein Platz mehr, aber eine gleiche Waffe da: Der Kauf verschmilzt.
      twin.tier += 1;
    } else {
      player.weapons.push({ id, tier: offer.tier, cd: 0.3 });
    }
  } else {
    const index = ITEMS.findIndex((item) => item.id === offer.id);
    if (index < 0) {
      return false;
    }
    player.items[index] = (player.items[index] ?? 0) + 1;
    recomputeStats(player);
  }

  player.gold -= offer.price;
  player.shop.offers[slot] = null;
  player.shop.locked[slot] = false;
  return true;
}

export function reroll(player: PlayerState, wave: number, rng: Rng): boolean {
  const cost = rerollCost(player, wave);
  if (player.gold < cost) {
    return false;
  }
  player.gold -= cost;
  player.shop.rerolls += 1;
  refreshOffers(player, wave, rng);
  return true;
}

export function toggleLock(player: PlayerState, slot: number): boolean {
  if (!player.shop.offers[slot]) {
    return false;
  }
  player.shop.locked[slot] = !player.shop.locked[slot];
  return true;
}

/** Eine Waffe verkaufen. Die letzte bleibt: Ohne Waffe kaempft niemand. */
export function sell(player: PlayerState, index: number, wave: number): boolean {
  const weapon = player.weapons[index];
  if (!weapon || player.weapons.length <= 1) {
    return false;
  }
  player.gold += sellPrice(weapon, wave);
  player.weapons.splice(index, 1);
  return true;
}

/** Vier verschiedene Level-Ups zur Auswahl, falls eines offen ist. */
export function prepareUpgradeChoices(player: PlayerState, rng: Rng): void {
  if (player.pendingLevels <= 0) {
    player.shop.upgradeChoices = null;
    return;
  }
  if (player.shop.upgradeChoices) {
    return;
  }
  const pool = UPGRADES.map((upgrade) => upgrade.id);
  const choices: string[] = [];
  while (choices.length < 4 && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    choices.push(pool.splice(index, 1)[0] ?? "");
  }
  player.shop.upgradeChoices = choices;
}

export function chooseUpgrade(player: PlayerState, pickIndex: number, rng: Rng): boolean {
  const choices = player.shop.upgradeChoices;
  const id = choices?.[pickIndex];
  if (!choices || id === undefined || player.pendingLevels <= 0) {
    return false;
  }
  const index = UPGRADES.findIndex((upgrade) => upgrade.id === id);
  if (index < 0) {
    return false;
  }
  player.upgrades[index] = (player.upgrades[index] ?? 0) + 1;
  player.pendingLevels -= 1;
  player.shop.upgradeChoices = null;
  recomputeStats(player);
  prepareUpgradeChoices(player, rng);
  return true;
}
