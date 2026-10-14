/**
 * Wer macht wie viel Rumpfschaden? Spielt den Bot und zaehlt mit.
 *   npx tsx tools/analyse.ts [Anzahl] [deck|klug]
 */

import { playBot, type BotStyle } from "../tests/bot";

const runs = Number(process.argv[2] ?? 4);
const style = (process.argv[3] ?? "klug") as BotStyle;
const total: Record<string, number> = {};
for (let seed = 1; seed <= runs; seed += 1) {
  const r = playBot(seed, style, 900, (event) => {
    if (event.kind === "hullHit") {
      const key = event.source ?? "sonst (Seilwinde)";
      total[key] = (total[key] ?? 0) + event.amount;
    }
  });
  console.log(
    `Lauf ${seed}: ${r.won ? "geschafft" : "verloren"} · Märsche ${r.marches} · ${r.seconds} s`,
  );
}
const sorted = Object.entries(total).sort((a, b) => b[1] - a[1]);
for (const [source, amount] of sorted) {
  console.log(`${source.padEnd(20)} ${Math.round(amount / runs)} Rumpf pro Lauf`);
}
