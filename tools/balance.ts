/**
 * Balance-Messung: Der Bot spielt den Probelauf mehrmals.
 *   npm run balance -- [Anzahl] [deck|klug]
 */

import { playBot, type BotStyle } from "../tests/bot";

const runs = Number(process.argv[2] ?? 8);
const style = (process.argv[3] ?? "klug") as BotStyle;
let wins = 0;
for (let seed = 1; seed <= runs; seed += 1) {
  const r = playBot(seed, style);
  if (r.won) {
    wins += 1;
  }
  console.log(
    `Lauf ${seed}: ${r.won ? "geschafft" : "verloren"} · Märsche ${r.marches} · Rumpf ${r.hull} · ${r.kills} besiegt · Schrott ${r.scrap} · ${r.repairs} Reparaturen · Seilwinde ${r.winches} · ${r.seconds} s`,
  );
}
console.log(`${style}: ${wins} von ${runs} geschafft`);
