/**
 * Beschreibungstexte fuer Gegenstaende, Waffen und Level-Ups.
 *
 * Alles wird aus den Daten abgeleitet, nie von Hand getippt - so stimmt der
 * Text im Shop immer mit dem ueberein, was der Gegenstand wirklich tut.
 */

import { ITEMS } from "../game/data/items";
import { STAT_LABELS } from "../game/data/stats";
import { WEAPONS, weaponCooldown, weaponDamage, weaponReach } from "../game/data/weapons";
import type { StatKey, StatMods, Stats, WeaponId } from "../game/types";

/** "+8 % Schaden". Nachteile mit Minus. */
export function describeStat(key: StatKey, value: number): string {
  const label = STAT_LABELS[key];
  const sign = value > 0 ? "+" : "−";
  const unit = label.unit === "%" ? " %" : "";
  return `${sign}${Math.abs(value)}${unit} ${label.name}`;
}

/** Alle Werte eines Gegenstands, eine Zeile je Wert. Vorteile zuerst. */
export function describeMods(mods: StatMods): { text: string; good: boolean }[] {
  const lines = (Object.keys(mods) as StatKey[]).map((key) => {
    const value = mods[key] ?? 0;
    return { text: describeStat(key, value), good: value > 0 };
  });
  return lines.sort((a, b) => Number(b.good) - Number(a.good));
}

export function itemLines(itemId: string): { text: string; good: boolean }[] {
  const item = ITEMS.find((candidate) => candidate.id === itemId);
  return item ? describeMods(item.mods) : [];
}

/** Die Eckdaten einer Waffe, gerechnet mit den Werten des Spielers. */
export function weaponLines(id: WeaponId, tier: number, stats: Stats): string[] {
  const def = WEAPONS[id];
  const damage = Math.round(weaponDamage(id, tier, stats));
  const cooldown = weaponCooldown(id, tier, stats);
  const perSecond = Math.round((damage * def.count) / cooldown);
  const shots = def.count > 1 ? ` × ${def.count}` : "";
  return [
    `Schaden ${damage}${shots}`,
    `${perSecond} pro Sekunde`,
    `Reichweite ${Math.round(weaponReach(id, stats))}`,
  ];
}
