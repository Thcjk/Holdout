/**
 * Balance-Messung: Der Bot spielt viele Runden, und die Tabelle zeigt, wie weit er kommt.
 *
 * Aufruf:  npm run balance
 * Optional: npm run balance -- 6      (Anzahl Durchlaeufe je Charakter, Standard 6)
 */

import { playBot } from "../tests/bot";
import { CHARACTERS, CHARACTER_IDS } from "../src/game/data/characters";

const runs = Number(process.argv[2] ?? 6);

console.log(`Bot-Messung, ${runs} Durchlaeufe je Charakter\n`);
console.log("Charakter     Welle (je Lauf)                 Sieg  Mittel");

for (const id of CHARACTER_IDS) {
  const waves: number[] = [];
  let wins = 0;
  for (let seed = 1; seed <= runs; seed += 1) {
    const start = CHARACTERS[id].starts[0];
    if (!start) {
      continue;
    }
    const result = playBot({ seed: seed * 977, character: id, startWeapon: start });
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
  const result = playBot({ seed: seed * 313, character: "kartoffel", startWeapon: "smg", players: 4 });
  coop.push(result.wave);
  if (result.won) {
    coopWins += 1;
  }
}
console.log(`\nKoop (4 Bots) ${coop.join(" ").padEnd(30)}  ${String(coopWins).padStart(2)}`);
