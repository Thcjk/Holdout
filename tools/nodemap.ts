/**
 * Gibt die Knoten-Karte eines Seeds auf der Konsole aus - zweimal, und
 * prueft, dass beide Male dasselbe herauskommt.
 *
 *   npm run nodemap            Seed 4242
 *   npm run nodemap -- 1234    ein bestimmter Seed
 *
 * Das ist die Sichtpruefung, solange es noch keine Kartenansicht im Spiel
 * gibt. Die eigentliche Absicherung steht in `tests/systems/nodeMap.test.ts`.
 */

import { describeNodeMap, generateNodeMap } from "../src/systems/NodeMapGenerator";

const seed = Number.parseInt(process.argv[2] ?? "4242", 10) | 0;

const first = generateNodeMap(seed);
const second = generateNodeMap(seed);
const same = JSON.stringify(first) === JSON.stringify(second);

console.log(describeNodeMap(first));
console.log("");
// Die Eckdaten je Knoten - die Nummer ist die fuer `?knoten=` im Spiel.
const SIZE = ["", "klein", "mittel", "gross"];
for (const node of first.nodes) {
  console.log(
    `  #${String(node.id).padStart(2)}  Schicht ${String(node.layer).padStart(2)}  ` +
      `${node.type.padEnd(10)}  g ${String(node.danger).padStart(2)}  ` +
      `${SIZE[node.arenaSize]?.padEnd(6)}  Beute ${node.loot}`,
  );
}
console.log("");
console.log(
  same
    ? `Zweiter Durchlauf mit Seed ${seed}: identisch (${first.nodes.length} Knoten).`
    : `FEHLER: Zweiter Durchlauf mit Seed ${seed} weicht ab!`,
);
process.exitCode = same ? 0 : 1;
