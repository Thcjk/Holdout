/**
 * Balance-Messung: Der Bot spielt viele Runden, und die Tabelle zeigt, wie weit er kommt.
 *
 * Aufruf:  npm run balance
 * Optional: npm run balance -- 6      (Anzahl Durchlaeufe je Charakter, Standard 6)
 *           npm run balance -- 6 voll (mit voll ausgebauter Schmiede)
 *           npm run balance -- 6 halb (mit halb ausgebauter Schmiede)
 */

import { playBot } from "../tests/bot";
import { CHARACTERS, CHARACTER_IDS } from "../src/game/data/characters";
import { FORGE, forgeBonus } from "../src/meta/forge";

const runs = Number(process.argv[2] ?? 6);
const forgeMode = process.argv[3] ?? "leer";
const share = forgeMode === "voll" ? 1 : forgeMode === "halb" ? 0.5 : 0;
const levels = Object.fromEntries(FORGE.map((def) => [def.id, Math.round(def.maxLevel * share)]));
const { mods: bonus, startGold } = forgeBonus(levels);

console.log(`Bot-Messung, ${runs} Durchlaeufe je Charakter, Schmiede: ${forgeMode}\n`);
console.log("Charakter     Welle (je Lauf)                 Sieg  Mittel");

for (const id of CHARACTER_IDS) {
  const waves: number[] = [];
  let wins = 0;
  for (let seed = 1; seed <= runs; seed += 1) {
    const start = CHARACTERS[id].starts[0];
    if (!start) {
      continue;
    }
    const result = playBot({ seed: seed * 977, character: id, startWeapon: start, bonus, startGold });
    waves.push(result.wave);
    if (result.won) {
      wins += 1;
    }
  }
  const mean = waves.reduce((sum, wave) => sum + wave, 0) / Math.max(1, waves.length);
  console.log(
    `${id.padEnd(13)} ${waves.join(" ").padEnd(30)}  ${String(wins).padStart(2)}    ${mean.toFixed(1)}`,
  );
}

// Koop: vier Bots gleichzeitig.
const coop: number[] = [];
let coopWins = 0;
for (let seed = 1; seed <= runs; seed += 1) {
  const result = playBot({ seed: seed * 313, character: "magierin", startWeapon: "smg", players: 4, bonus, startGold });
  coop.push(result.wave);
  if (result.won) {
    coopWins += 1;
  }
}
console.log(`\nKoop (4 Bots) ${coop.join(" ").padEnd(30)}  ${String(coopWins).padStart(2)}`);
