/**
 * Balancing-Protokoll: was ein Durchlauf pro Charakter und Welle wirklich tut.
 *
 * Die kurze Messung in `balanceProbe.test.ts` sagt nur, wie weit ein Bot kommt.
 * Das hier beantwortet die Fragen dahinter:
 *
 *   - Wie schnell stirbt ein durchschnittlicher Gegner pro Charakter?
 *   - Ab welcher Welle wird es spuerbar schwer?
 *   - Ist einer der drei deutlich staerker oder schwaecher?
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
import { CHARACTERS, ENEMIES, PLAYER, WAVES } from "../../src/config/balance";
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

/** Gegnerleben in einer bestimmten Welle - Wachstum aus der Wellenformel. */
function enemyHealth(type: EnemyType, wave: number): number {
  return Math.round(ENEMIES[type].health * Math.pow(WAVES.healthGrowth, Math.max(0, wave - 1)));
}

interface WaveRecord {
  wave: number;
  seconds: number;
  damageDealt: number;
  damageTaken: number;
  kills: number;
  healthAfterPercent: number;
  wentDown: boolean;
}

/** Ein Durchlauf mit Aufzeichnung je Welle. */
function runOnce(character: CharacterId, seed: number, maxWave: number): WaveRecord[] {
  const state = createWorld([{ id: "p", name: "Bot", character }], seed);
      const bot = createBot();
  const records: WaveRecord[] = [];

  let current: WaveRecord | null = null;
  let seenWave = 0;

  for (let i = 0; i < TICK_RATE * 900 && state.phase !== "gameover"; i += 1) {
    stepWorld(state, bot(state), TICK_SECONDS);

    if (state.phase === "wave") {
      if (state.wave !== seenWave) {
        seenWave = state.wave;
        current = {
          wave: state.wave,
          seconds: 0,
          damageDealt: 0,
          damageTaken: 0,
          kills: 0,
          healthAfterPercent: 100,
          wentDown: false,
        };
        records.push(current);
      }
      if (current) {
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
      }
    }

    if (records.length >= maxWave && state.phase === "break" && seenWave >= maxWave) {
      break;
    }
  }

  return records;
}

describe("Balancing-Protokoll", () => {
  it("misst alle drei Charaktere ueber acht Wellen", () => {
    const characters: CharacterId[] = ["scout", "tank", "sniper"];
    const seeds = [7919, 15837, 23755];

    const lines: string[] = [];
    lines.push("");
    lines.push("=== RECHNERISCH: Dauerfeuer, wenn jede Kugel trifft ===");
    lines.push("Charakter  Schuss/s  Schaden/s   Laeufer(600)  Schuetze(900)  Brocken(2800)");
    for (const character of characters) {
      const dps = paperDps(character);
      const ttk = (type: EnemyType, wave: number) => (enemyHealth(type, wave) / dps).toFixed(2);
      lines.push(
        `${character.padEnd(10)} ${sustainedShotsPerSecond(character).toFixed(2).padStart(8)} ` +
          `${Math.round(dps).toString().padStart(9)}   ` +
          `${ttk("runner", 1).padStart(10)} s  ${ttk("shooter", 1).padStart(11)} s  ` +
          `${ttk("brute", 1).padStart(11)} s`,
      );
    }
    lines.push("");
    lines.push("Dieselben Gegner in Welle 8 (Leben waechst 8 % je Welle, also x1,71):");
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
      lines.push("Welle  Dauer   Schaden/s  erlitten  Kills  Leben danach  am Boden");

      const perWave = new Map<number, WaveRecord[]>();
      let reached = 0;
      for (const seed of seeds) {
        const records = runOnce(character, seed, 8);
        reached += records.length;
        for (const record of records) {
          const list = perWave.get(record.wave) ?? [];
          list.push(record);
          perWave.set(record.wave, list);
        }
      }

      for (let wave = 1; wave <= 8; wave += 1) {
        const list = perWave.get(wave);
        if (!list || list.length === 0) {
          lines.push(`${String(wave).padStart(5)}  - nicht erreicht -`);
          continue;
        }
        const avg = (pick: (r: WaveRecord) => number) =>
          list.reduce((sum, r) => sum + pick(r), 0) / list.length;
        const seconds = avg((r) => r.seconds);
        const dps = seconds > 0 ? avg((r) => r.damageDealt) / seconds : 0;
        const downs = list.filter((r) => r.wentDown).length;
        lines.push(
          `${String(wave).padStart(5)}  ${seconds.toFixed(1).padStart(5)}s  ` +
            `${Math.round(dps).toString().padStart(9)}  ` +
            `${Math.round(avg((r) => r.damageTaken))
              .toString()
              .padStart(8)}  ` +
            `${avg((r) => r.kills).toFixed(1).padStart(5)}  ` +
            `${avg((r) => r.healthAfterPercent).toFixed(0).padStart(11)}%  ` +
            `${downs > 0 ? `${downs}/${list.length}` : "-"}`,
        );
      }
      lines.push(`Erreichte Wellen im Schnitt: ${(reached / seeds.length).toFixed(1)}`);
    }

    console.log(lines.join("\n"));
  }, 120_000);
});
