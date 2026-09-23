/**
 * Loot: was faellt, was liegt, was man aufhebt.
 *
 * Phaserfrei wie alles unter `systems/` - der Host rechnet das fuer alle.
 *
 * ================================================================
 * AUFHEBEN GEHT AUTOMATISCH, UND DAS IST EINE ENTSCHEIDUNG
 * ================================================================
 *
 * Die naheliegende Alternative waere ein vierter Knopf. Drei Gruende dagegen:
 *
 *  1. Der Bogen unten rechts ist mit FEUER, Faehigkeit und SUPER voll. Der
 *     untere Rand ist der knappste Platz im Bild (siehe CLAUDE.md), und ein
 *     vierter Knopf waere genau der, den man im Gefecht versehentlich trifft.
 *  2. In dieser Phase gibt es NICHTS ZU ENTSCHEIDEN: kein Platzlimit, kein
 *     Ablehnen. Ein Knopf fuer eine Handlung ohne Entscheidung ist reine
 *     Reibung.
 *  3. Es ist das Muster, das dieses Genre benutzt - man laeuft drueber.
 *
 * Ab Phase 11 kann der Rucksack voll sein. Dann bleibt das Aufheben trotzdem
 * automatisch und scheitert sichtbar ("Rucksack voll") - die Entscheidung
 * faellt dann vor dem Run beim Packen, nicht mitten im Gefecht.
 *
 * ================================================================
 * IM KOOP GIBT ES GENAU EINE WAHRHEIT
 * ================================================================
 *
 * `stepLoot` laeuft in der Simulation, also nur beim Host. Ein Bodenfund wird
 * in derselben Schleife entfernt, in der er vergeben wird - zwei Spieler
 * koennen ihn nicht beide bekommen.
 *
 * Der Client sagt beim Loot NICHTS voraus; er zeigt, was im Zustand steht.
 * Eine Vorhersage waere hier falsch: Ein Gegenstand, der aufploppt und wieder
 * verschwindet, weil jemand anderes schneller war, sieht nach einem Fehler
 * aus.
 */

import { ITEMS } from "../config/items";
import { LOOT } from "../config/balance";
import { nextRandom } from "./rng";
import { distanceFromStart, zoneAt } from "./zones";
import type { EnemyState, GroundItem, PlayerState, Vec2, WorldState } from "./types";

/**
 * Eine Zufallszahl aus dem SPIELSTROM - Host und Client ziehen dieselbe.
 *
 * `WorldState` erfuellt `RngHolder` (es hat ein `rngState`), also laeuft das
 * ueber denselben Strom wie Streuung und Spawnpositionen. Bewusst NICHT ueber
 * den Strom des Weltgenerators: Der ist beim Bauen der Karte aufgebraucht,
 * und ein zweiter Verbraucher darin wuerde jede spaetere Position verschieben
 * (siehe `gameplaySeed` in `WorldGenerator.ts`).
 */
function random(state: WorldState): number {
  return nextRandom(state);
}

/**
 * Waehlt einen Gegenstand aus, gewichtet nach Seltenheit und Tiefe.
 *
 * Das Gewicht einer Stufe ist `1 / rarity` mal einem Bonus, der mit der Zone
 * waechst. In Zone 0 ist Schrott (Stufe 1) viermal so wahrscheinlich wie ein
 * Reaktorkern (Stufe 4); weit draussen gleicht sich das an.
 *
 * KEINE HARTE STUFE JE ZONE, sondern eine Verschiebung: Auch tief draussen
 * faellt noch Schrott. Ein Fundsystem, in dem ab Zone 6 NUR noch Gutes
 * kommt, entwertet alles davor rueckwirkend - und der Moment "endlich ein
 * Reaktorkern" braucht ein Davor, in dem er selten war.
 */
function rollItem(state: WorldState, zone: number, minRarity = 1): number {
  const boost = 1 + zone * LOOT.rarityPerZone;

  let total = 0;
  const weights: number[] = [];
  for (const item of ITEMS) {
    if (item.rarity < minRarity) {
      weights.push(0);
      continue;
    }
    // Haeufiges ist grundsaetzlich wahrscheinlicher; die Tiefe hebt genau die
    // hohen Stufen an, nicht alle gleichmaessig.
    const weight = (1 / item.rarity) * Math.pow(boost, item.rarity - 1);
    weights.push(weight);
    total += weight;
  }

  if (total <= 0) {
    return 0;
  }

  let pick = random(state) * total;
  for (let i = 0; i < weights.length; i += 1) {
    pick -= weights[i] ?? 0;
    if (pick <= 0) {
      return i;
    }
  }
  return weights.length - 1;
}

/** Legt einen Gegenstand in die Welt. */
export function dropItem(
  state: WorldState,
  def: number,
  position: Vec2,
  fromWorld = false,
): GroundItem {
  const item: GroundItem = {
    id: state.nextItemId++,
    def,
    // Kopie, keine Referenz: Der Gegner, von dem die Position stammt, wird
    // gleich aus der Liste entfernt - und bei einem Fundort der Karte wuerde
    // sonst das Gebaeude mitwandern.
    position: { x: position.x, y: position.y },
    lifetime: fromWorld ? Number.POSITIVE_INFINITY : LOOT.dropLifetime,
    fromWorld,
  };
  state.groundItems.push(item);
  return item;
}

/**
 * Was ein gefallener Gegner hinterlaesst.
 *
 * Wird aus `killEnemy` gerufen - also an genau der einen Stelle, an der ein
 * Gegner stirbt, egal woran. Ein zweiter Weg (etwa "nur wenn ein Spieler ihn
 * getroffen hat") waere eine zweite Regel, die mit der ersten auseinanderlaeuft.
 */
export function dropFromEnemy(state: WorldState, enemy: EnemyState): void {
  const zone = zoneAt(distanceFromStart(state, enemy.position));

  if (enemy.type === "boss") {
    // Bosse lassen immer etwas fallen, und zwar mehreres. Zusaetzlich wird
    // die untere Seltenheitsstufe ausgeschlossen: Nach einem Boss ist
    // Schrott eine Beleidigung.
    const count = enemy.isBoss ? LOOT.finalBossDrops : LOOT.bossDrops;
    for (let i = 0; i < count; i += 1) {
      dropItem(state, rollItem(state, zone, enemy.isBoss ? 3 : 2), enemy.position);
    }
    return;
  }

  const chance = LOOT.dropChance[enemy.type] ?? 0;
  if (random(state) > chance) {
    return;
  }

  dropItem(state, rollItem(state, zone), enemy.position);
}

/** Ein Tick: Liegezeit abziehen und aufheben, was nah genug ist. */
export function stepLoot(state: WorldState, dt: number): void {
  expireDrops(state, dt);
  pickUp(state);
}

/**
 * Laesst alte Bodenfunde verschwinden.
 *
 * RUECKWAERTS durch die Liste, weil dabei Eintraege entfernt werden. Vorwaerts
 * ruecken die folgenden beim Entfernen eine Stelle vor, und jeder zweite
 * bliebe uebersprungen - genau die Falle, die bei der Splittergranate schon
 * einmal beinahe durchgerutscht waere (siehe `abilities.ts`).
 */
function expireDrops(state: WorldState, dt: number): void {
  for (let i = state.groundItems.length - 1; i >= 0; i -= 1) {
    const item = state.groundItems[i];
    if (!item || item.fromWorld) {
      continue;
    }
    item.lifetime -= dt;
    if (item.lifetime <= 0) {
      state.groundItems.splice(i, 1);
    }
  }
}

/**
 * Hebt auf, was nah genug liegt.
 *
 * Der NAECHSTE stehende Spieler bekommt es. Am Boden Liegende nicht: Wer
 * nicht laufen kann, kann auch nichts aufheben - und im Koop waere es sonst
 * moeglich, Loot einzusammeln, waehrend man auf Wiederbelebung wartet.
 *
 * Auch hier rueckwaerts durch die Liste.
 */
function pickUp(state: WorldState): void {
  const standing = state.players.filter((player) => !player.down);
  if (standing.length === 0) {
    return;
  }

  for (let i = state.groundItems.length - 1; i >= 0; i -= 1) {
    const item = state.groundItems[i];
    if (!item) {
      continue;
    }

    let best: PlayerState | null = null;
    let bestDistance: number = LOOT.pickupRadius;

    for (const player of standing) {
      const distance = Math.hypot(
        player.position.x - item.position.x,
        player.position.y - item.position.y,
      );
      if (distance <= bestDistance) {
        best = player;
        bestDistance = distance;
      }
    }

    if (!best) {
      continue;
    }

    best.items.push({ id: state.nextItemId++, def: item.def });
    state.groundItems.splice(i, 1);
    state.events.push({
      type: "itemPicked",
      playerId: best.id,
      def: item.def,
      x: item.position.x,
      y: item.position.y,
    });
  }
}
