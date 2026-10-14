/**
 * Balance-Messung: Der Bot spielt Akt 1 mehrmals.
 *   npm run balance -- [Anzahl] [deck|klug] [neu|voll] [Mech] [Hitze]
 * `neu`: wie ein frisches Profil (nur Start-Bauplaene), `voll`: alle Module.
 */

import { CREW_IDS } from "../src/game/data/crew";
import { newProfile, runOptions } from "../src/game/meta";
import type { CrewId } from "../src/game/types";
import { playBot, type BotStyle } from "../tests/bot";

const runs = Number(process.argv[2] ?? 8);
const style = (process.argv[3] ?? "klug") as BotStyle;
const fresh = (process.argv[4] ?? "neu") === "neu";
const crew = (CREW_IDS.find((id) => id === process.argv[5]) ?? "schrauber") as CrewId;
const heat = Number(process.argv[6] ?? 0);
const profile = newProfile();
profile.heat = heat;
const options = fresh ? runOptions(profile) : { heat };
let wins = 0;
for (let seed = 1; seed <= runs; seed += 1) {
  const r = playBot(seed, style, 2400, undefined, undefined, options, crew);
  if (r.won) {
    wins += 1;
  }
  console.log(
    `Lauf ${seed}: ${r.won ? "geschafft" : "verloren"} · Akt ${r.act + 1} · Märsche ${r.marches} · Rumpf ${r.hull} · ${r.kills} besiegt · Schrott ${r.scrap} · ${r.modules} Module · ${r.repairs} Reparaturen · Seilwinde ${r.winches} · ${r.seconds} s`,
  );
}
console.log(
  `${style} · ${crew} · ${fresh ? "neues Profil" : "alle Module"} · Hitze ${heat}: ${wins} von ${runs} geschafft`,
);
