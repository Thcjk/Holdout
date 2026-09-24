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
console.log(
  same
    ? `Zweiter Durchlauf mit Seed ${seed}: identisch (${first.nodes.length} Knoten).`
    : `FEHLER: Zweiter Durchlauf mit Seed ${seed} weicht ab!`,
);
process.exitCode = same ? 0 : 1;
