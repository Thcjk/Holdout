/**
 * Balancing-Protokoll: was ein Durchlauf pro Charakter und ZONE wirklich tut.
 *
 * Die kurze Messung in `balanceProbe.test.ts` sagt nur, wie tief ein Bot kommt.
 * Das hier beantwortet die Fragen dahinter:
 *
 *   - Wie schnell stirbt ein durchschnittlicher Gegner pro Charakter?
 *   - Ab welcher Zone wird es spuerbar schwer?
 *   - Ist einer der drei deutlich staerker oder schwaecher?
 *
 * Seit Phase 8 ist die Zeile eine Zone statt einer Welle. Der Unterschied ist
 * nicht nur eine Beschriftung: Eine Welle war ein abgeschlossener Abschnitt mit
 * Anfang und Ende, eine Zone ist ein Ort, den man betritt und wieder verlaesst.
 * Gemessen wird deshalb die Zeit, die der Bot IN dieser Zone verbracht hat.
 *
 * Zwei Sorten Zahlen, und der Unterschied ist wichtig:
 *
 *   RECHNERISCH  Was auf dem Papier steht, wenn jede Kugel trifft. Fuer den
 *                Tank ist das eine Wunschzahl: Er streut 34 Grad, seine fuenf
 *                Kugeln treffen nur aus naechster Naehe alle.
 *   GEMESSEN     Was im Durchlauf tatsaechlich passiert ist - Schaden aus den
 *                Treffer-Ereignissen geteilt durch die Zeit im Gefecht.
 *
 * Das ist ein Messwerkzeug, kein Test mit Zusicherung. Es faellt nie durch; es
 * druckt. Lauf es mit `npm run test` und lies die Tabelle.
 */

import { describe, it } from "vitest";
import { CHARACTERS, DIFFICULTY, ENEMIES, PLAYER } from "../../src/config/balance";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import { createWorld, stepWorld } from "../../src/systems/world";
import { createBot } from "../bot";
import type { CharacterId, EnemyType } from "../../src/systems/types";

/**
 * Dauerfeuer auf dem Papier.
 *
 * Die Schussfolge wird von zwei Dingen begrenzt: dem Schusstakt (frueheste
 * Wiederholung) und dem Nachladen (drei Ladungen, jede braucht `reloadTime`).
 * Auf Dauer ist das Nachladen der Engpass, im ersten Ansturm der Schusstakt.
 */
function sustainedShotsPerSecond(character: CharacterId): number {
  const reload = CHARACTERS[character].reloadTime;
  return Math.min(1 / PLAYER.shootCooldown, PLAYER.ammoCharges / reload);
}

function paperDps(character: CharacterId): number {
  const shot = CHARACTERS[character].shot;
  return sustainedShotsPerSecond(character) * shot.bullets * shot.damage;
}

/** Gegnerleben in einer bestimmten Zone - Wachstum aus der Distanzformel. */
function enemyHealth(type: EnemyType, zone: number): number {
  return Math.round(ENEMIES[type].health * Math.pow(DIFFICULTY.healthGrowth, Math.max(0, zone)));
}

interface ZoneRecord {
  zone: number;
  seconds: number;
  damageDealt: number;
  damageTaken: number;
  kills: number;
  healthAfterPercent: number;
  wentDown: boolean;
}

/**
 * Ein Durchlauf mit Aufzeichnung je Zone.
 *
 * Anders als bei den Wellen kann der Bot eine Zone mehrfach betreten - er
 * laeuft ja frei herum. Die Zeilen werden deshalb je Zone aufsummiert, nicht
 * je Besuch: Was interessiert, ist "wie teuer war Zone 4 insgesamt".
 */
function runOnce(character: CharacterId, seed: number, maxZone: number): ZoneRecord[] {
  const state = createWorld([{ id: "p", name: "Bot", character }], seed);
  const bot = createBot();
  const byZone = new Map<number, ZoneRecord>();

  for (let i = 0; i < TICK_RATE * 900 && state.phase !== "ended"; i += 1) {
    stepWorld(state, bot(state), TICK_SECONDS);

    const zone = state.zone;
    let current = byZone.get(zone);
    if (!current) {
      current = {
        zone,
        seconds: 0,
        damageDealt: 0,
        damageTaken: 0,
        kills: 0,
        healthAfterPercent: 100,
        wentDown: false,
      };
      byZone.set(zone, current);
    }

    current.seconds += TICK_SECONDS;
    for (const event of state.events) {
      if (event.type === "hit") current.damageDealt += event.damage;
      if (event.type === "playerHit") current.damageTaken += event.damage;
      if (event.type === "enemyDied") current.kills += 1;
      if (event.type === "playerDown") current.wentDown = true;
    }
    const player = state.players[0];
    if (player) {
      current.healthAfterPercent = (player.health / player.maxHealth) * 100;
    }

    if (state.deepestZone > maxZone) {
      break;
    }
  }

  return [...byZone.values()].sort((a, b) => a.zone - b.zone);
}

describe("Balancing-Protokoll", () => {
  it("misst alle drei Charaktere ueber acht Zonen", () => {
    const characters: CharacterId[] = ["scout", "tank", "sniper"];
    const seeds = [7919, 15837, 23755];

    const lines: string[] = [];
    lines.push("");
    lines.push("=== RECHNERISCH: Dauerfeuer, wenn jede Kugel trifft ===");
    lines.push("Charakter  Schuss/s  Schaden/s   Laeufer(600)  Schuetze(900)  Brocken(2800)");
    for (const character of characters) {
      const dps = paperDps(character);
      const ttk = (type: EnemyType, zone: number) => (enemyHealth(type, zone) / dps).toFixed(2);
      lines.push(
        `${character.padEnd(10)} ${sustainedShotsPerSecond(character).toFixed(2).padStart(8)} ` +
          `${Math.round(dps).toString().padStart(9)}   ` +
          `${ttk("runner", 0).padStart(10)} s  ${ttk("shooter", 0).padStart(11)} s  ` +
          `${ttk("brute", 0).padStart(11)} s`,
      );
    }
    lines.push("");
    lines.push("Dieselben Gegner in Zone 8 (Leben waechst 8 % je Zone, also x1,85):");
    for (const character of characters) {
      const dps = paperDps(character);
      const ttk = (type: EnemyType) => (enemyHealth(type, 8) / dps).toFixed(2);
      lines.push(
        `${character.padEnd(10)} ${"".padStart(8)} ${"".padStart(9)}   ` +
          `${ttk("runner").padStart(10)} s  ${ttk("shooter").padStart(11)} s  ` +
          `${ttk("brute").padStart(11)} s`,
      );
    }

    for (const character of characters) {
      lines.push("");
      lines.push(`=== GEMESSEN: ${character} (Schnitt aus ${seeds.length} Durchlaeufen) ===`);
      lines.push("Zone   Dauer   Schaden/s  erlitten  Kills  Leben danach  am Boden");

      const perZone = new Map<number, ZoneRecord[]>();
      let deepest = 0;
      for (const seed of seeds) {
        const records = runOnce(character, seed, 8);
        deepest += records.length > 0 ? (records[records.length - 1]?.zone ?? 0) : 0;
        for (const record of records) {
          const list = perZone.get(record.zone) ?? [];
          list.push(record);
          perZone.set(record.zone, list);
        }
      }

      for (let zone = 0; zone <= 8; zone += 1) {
        const list = perZone.get(zone);
        if (!list || list.length === 0) {
          lines.push(`${String(zone).padStart(5)}  - nicht erreicht -`);
          continue;
        }
        const avg = (pick: (r: ZoneRecord) => number) =>
          list.reduce((sum, r) => sum + pick(r), 0) / list.length;
        const seconds = avg((r) => r.seconds);
        const dps = seconds > 0 ? avg((r) => r.damageDealt) / seconds : 0;
        const downs = list.filter((r) => r.wentDown).length;
        lines.push(
          `${String(zone).padStart(5)}  ${seconds.toFixed(1).padStart(5)}s  ` +
            `${Math.round(dps).toString().padStart(9)}  ` +
            `${Math.round(avg((r) => r.damageTaken))
              .toString()
              .padStart(8)}  ` +
            `${avg((r) => r.kills).toFixed(1).padStart(5)}  ` +
            `${avg((r) => r.healthAfterPercent).toFixed(0).padStart(11)}%  ` +
            `${downs > 0 ? `${downs}/${list.length}` : "-"}`,
        );
      }
      lines.push(`Tiefste Zone im Schnitt: ${(deepest / seeds.length).toFixed(1)}`);
    }

    console.log(lines.join("\n"));
  }, 120_000);
});
