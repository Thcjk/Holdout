import { describe, expect, it } from "vitest";
import { CHARACTERS, SKILL_ORDER } from "../../src/config/balance";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import { nearestEnemy } from "../../src/systems/targeting";
import { createWorld, stepWorld } from "../../src/systems/world";
import { makeInput } from "../helpers";
import type { CharacterId, InputState } from "../../src/systems/types";

/** Ein mittelmässiger Spieler: zielt automatisch, weicht grob aus, feuert immer. */
function botInput(state: ReturnType<typeof createWorld>): Map<string, InputState> {
  const player = state.players[0];
  if (!player) return new Map();
  const target = nearestEnemy(state, player.position, 4000);
  let aim: { x: number; y: number } | null = null;
  if (target) {
    const dx = target.position.x - player.position.x;
    const dy = target.position.y - player.position.y;
    const d = Math.hypot(dx, dy) || 1;
    aim = { x: dx / d, y: dy / d };
  }

  // Ausserhalb der eigenen Reichweite: ran an den Gegner.
  const range = CHARACTERS[player.character].shot.range;
  if (target) {
    const d = Math.hypot(
      target.position.x - player.position.x,
      target.position.y - player.position.y,
    );
    if (d > range * 0.85 && aim) {
      return new Map([
        [
          player.id,
          makeInput(
            { x: aim.x, y: aim.y },
            { aim, fire: true, useSuper: player.superCharge >= 100 },
          ),
        ],
      ]);
    }
  }

  // Ausweichen: von allen nahen Gegnern gleichzeitig weg, gewichtet nach Naehe.
  let fleeX = 0;
  let fleeY = 0;
  for (const enemy of state.enemies) {
    const dx = player.position.x - enemy.position.x;
    const dy = player.position.y - enemy.position.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 300) {
      const weight = (300 - d) / 300;
      fleeX += (dx / d) * weight;
      fleeY += (dy / d) * weight;
    }
  }
  // In der Arena bleiben
  fleeX += (800 - player.position.x) / 900;
  fleeY += (600 - player.position.y) / 900;
  const fleeLength = Math.hypot(fleeX, fleeY);
  const move =
    fleeLength > 0.05 ? { x: fleeX / fleeLength, y: fleeY / fleeLength } : { x: 0, y: 0 };
  const useSuper = player.superCharge >= 100;
  // Punkte reihum verteilen - ein Bot, der Aufwertungen liegen liesse, wuerde
  // das Spiel schwerer messen, als es ist.
  const levelUp =
    player.skillPoints > 0
      ? (SKILL_ORDER[player.skills.weapon % SKILL_ORDER.length] ?? null)
      : null;
  return new Map([[player.id, makeInput(move, { aim, fire: true, useSuper, levelUp })]]);
}

/**
 * Balancing-Werkzeug, kein normaler Test.
 *
 * Ein einfacher Bot spielt jeden Charakter fuenfmal durch und gibt aus, wie weit
 * er kommt. Damit laesst sich eine Aenderung in `balance.ts` sofort in Zahlen
 * ablesen, statt zwanzig Runden von Hand zu spielen.
 *
 * Wichtig: Der Bot ist schlechter als ein Mensch. Er nutzt keine Deckung, keine
 * Buesche (in denen Gegner ihn gar nicht sehen) und weicht Projektilen nicht aus.
 * Seine Zahlen sind also eine Untergrenze, kein Zielwert - das Briefing sagt
 * ausdruecklich, dass ueber Game Feel nur das eigene Spielen entscheidet.
 *
 * Die Zusicherung unten ist bewusst grosszuegig: Sie soll nur auffallen, wenn
 * eine Aenderung das Spiel unspielbar macht.
 */
describe("Balancing-Messung", () => {
  for (const character of ["scout", "tank", "sniper"] as CharacterId[]) {
    it(`misst ${character}`, () => {
      const runs: number[] = [];
      for (let seed = 1; seed <= 5; seed += 1) {
        const state = createWorld([{ id: "p", name: "Bot", character }], seed * 7919);
        for (let i = 0; i < TICK_RATE * 900 && state.phase !== "gameover"; i += 1) {
          stepWorld(state, botInput(state), TICK_SECONDS);
        }
        runs.push(state.wave);
      }
      const average = runs.reduce((a, b) => a + b, 0) / runs.length;
      console.log(`${character}: Wellen ${runs.join(", ")} (Schnitt ${average.toFixed(1)})`);

      // Untergrenze: Ein Bot ohne Deckung und Buesche muss mindestens durch die
      // ersten Wellen kommen, sonst stimmt etwas Grundsaetzliches nicht.
      expect(average).toBeGreaterThanOrEqual(3);
    });
  }
});
