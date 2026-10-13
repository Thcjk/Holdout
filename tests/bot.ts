/**
 * Ein einfacher Bot fuer die Balance-Messung (`npm run balance`).
 *
 * "deck": bleibt immer oben und schiesst nur.
 * "klug": springt ab, wenn Gegner unter dem Bauch hacken oder Schrott liegt,
 *         raeumt auf und klettert ueber die Strickleiter wieder hoch. In der
 *         Rast repariert er, so viel der Schrott hergibt.
 * Die Zahlen sind Untergrenzen: Ein Mensch spielt geschickter.
 */

import { DECK_H, DECK_W, LADDER, LADDER_TOP, REPAIR_COST, TICK } from "../src/game/constants";
import { BLIND_SPOT, insideRect } from "../src/game/fortress";
import { Simulation } from "../src/game/Simulation";
import type { GameState, PlayerInput } from "../src/game/types";

export type BotStyle = "deck" | "klug";

export interface BotResult {
  won: boolean;
  marches: number;
  hull: number;
  kills: number;
  scrap: number;
  repairs: number;
  winches: number;
  seconds: number;
}

function toward(x: number, y: number, tx: number, ty: number): PlayerInput {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy);
  return d < 4 ? { mx: 0, my: 0 } : { mx: dx / d, my: dy / d };
}

function decide(state: GameState, style: BotStyle, memory: { downSince: number }): PlayerInput {
  const p = state.players[0]!;
  const f = state.fort;
  if (!p.alive || p.transition || style === "deck") {
    return { mx: 0, my: 0 };
  }
  const belly = state.enemies.filter((e) => insideRect(BLIND_SPOT, e.x - f.x, e.y - f.y));
  const nearScrap = state.scrap.filter((s) => s.x > f.x - 120 && s.x < f.x + DECK_W + 120);
  if (p.layer === "deck") {
    memory.downSince = state.time;
    if (
      belly.length >= 2 ||
      nearScrap.length >= 4 ||
      (state.phase === "rest" && nearScrap.length > 0)
    ) {
      // Vorne abspringen: zur Vorderkante neben der Strickleiter.
      return toward(p.x, p.y, f.x + 150, f.y + DECK_H + 20);
    }
    return { mx: 0, my: 0 };
  }
  const lowHp = p.hp < p.hpMax * 0.4;
  const tooLong = state.time - memory.downSince > 18 && state.phase === "march";
  if (lowHp || tooLong || (belly.length === 0 && nearScrap.length === 0)) {
    // Zur Strickleiter
    return toward(p.x, p.y, f.x + (LADDER.x0 + LADDER.x1) / 2, f.y + LADDER_TOP.y - 4);
  }
  // Schrott einsammeln oder unter den Bauch zielen (von vorne unten).
  const piece = nearScrap.sort(
    (a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
  )[0];
  if (piece && (belly.length < 2 || Math.hypot(piece.x - p.x, piece.y - p.y) < 80)) {
    return toward(p.x, p.y, piece.x, piece.y);
  }
  return toward(p.x, p.y, f.x + 140, f.y + DECK_H + 60);
}

export function playBot(seed: number, style: BotStyle, maxSeconds = 900): BotResult {
  const sim = new Simulation([{ id: "bot", name: "Bot", crew: "schrauber" }], seed);
  const memory = { downSince: 0 };
  let ability = 0;
  let repairs = 0;
  let winches = 0;
  let restTime = 0;
  const steps = Math.round(maxSeconds / TICK);
  for (let i = 0; i < steps; i += 1) {
    const s = sim.state;
    if (s.phase === "won" || s.phase === "lost") {
      break;
    }
    if (s.phase === "rest") {
      const nearScrap = s.scrap.filter((piece) => Math.abs(piece.x - s.fort.x - 140) < 260);
      const p = s.players[0]!;
      restTime += TICK;
      const done =
        style === "deck" ||
        restTime > 20 ||
        (nearScrap.length === 0 && p.layer === "deck" && !p.transition);
      if (done) {
        restTime = 0;
        while (s.bank >= REPAIR_COST && s.fort.hull < s.fort.hullMax) {
          sim.command("bot", { kind: "repair" });
          repairs += 1;
        }
        sim.command("bot", { kind: "depart" });
      }
    }
    const input = decide(s, style, memory);
    const p = s.players[0]!;
    if (p.abilityCd <= 0 && s.fort.hull < s.fort.hullMax - 60) {
      ability += 1;
    }
    sim.advance(TICK * 1000 + 0.01, new Map([["bot", { ...input, ability }]]));
    winches += sim.events.filter((e) => e.kind === "winch").length;
  }
  const s = sim.state;
  return {
    won: s.phase === "won",
    marches: s.march.index + (s.phase === "won" ? 1 : 0),
    hull: Math.round(s.fort.hull),
    kills: s.kills,
    scrap: s.players[0]!.scrap,
    repairs,
    winches,
    seconds: Math.round(s.time),
  };
}
