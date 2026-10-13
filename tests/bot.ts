/**
 * Ein einfacher Bot fuer die Balance-Messung (`npm run balance`).
 *
 * "deck": bleibt immer oben und schiesst nur.
 * "klug": springt ab, wenn Gegner unter dem Bauch hacken oder Schrott liegt,
 *         raeumt auf und klettert ueber die Strickleiter wieder hoch. In der
 *         Rast repariert er, so viel der Schrott hergibt.
 * Die Zahlen sind Untergrenzen: Ein Mensch spielt geschickter.
 */

import {
  DECK_COLS,
  DECK_H,
  DECK_ROWS,
  DECK_W,
  LADDER,
  LADDER_TOP,
  REPAIR_COST,
  TICK,
} from "../src/game/constants";
import { MODULES, upgradeCost } from "../src/game/data/modules";
import { canPlace, generatorBonus } from "../src/game/deck";
import { BLIND_SPOT, insideRect } from "../src/game/fortress";
import { Simulation } from "../src/game/Simulation";
import type { GameState, ModuleId, PlayerInput } from "../src/game/types";

export type BotStyle = "deck" | "klug";

export interface BotResult {
  won: boolean;
  modules: number;
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

/** Wie gern der Bot ein Modul baut (hoeher = lieber). */
const PRIORITY: Record<ModuleId, number> = {
  geschuetz: 10,
  spule: 9,
  moerser: 8,
  oel: 7,
  harpune: 6,
  generator: 5,
  magnet: 4,
  platte: 3,
  werkstatt: 2,
  motor: 1,
};

/** Ein Feld fuer das Modul: Generatoren neben Waffen, sonst vorn zuerst. */
function chooseTile(state: GameState, type: ModuleId): { col: number; row: number } | null {
  let best: { col: number; row: number; score: number } | null = null;
  for (let row = DECK_ROWS - 1; row >= 0; row -= 1) {
    for (let col = 0; col < DECK_COLS; col += 1) {
      if (!canPlace(state.modules, type, col, row)) {
        continue;
      }
      let score = row * 2 + (col === 0 || col === DECK_COLS - 1 ? 1 : 0);
      if (type === "generator") {
        const fake = {
          uid: -1,
          type: "generator" as const,
          col,
          row,
          level: 1,
          cooldown: 0,
          facing: 1 as const,
        };
        score =
          state.modules.filter(
            (m) => MODULES[m.type].weapon && generatorBonus([...state.modules, fake], m) > 0,
          ).length * 10;
      }
      if (!best || score > best.score) {
        best = { col, row, score };
      }
    }
  }
  return best;
}

/** In der Rast: reparieren, wenn noetig, dann bauen und aufruesten. */
function spend(sim: Simulation, style: BotStyle): number {
  const s = sim.state;
  let repairs = 0;
  const repairBelow = style === "klug" ? 0.7 : 0.5;
  while (s.bank >= REPAIR_COST && s.fort.hull < s.fort.hullMax * repairBelow) {
    sim.command("bot", { kind: "repair" });
    repairs += 1;
  }
  for (let guard = 0; guard < 20; guard += 1) {
    const options = s.offer
      .filter((type) => MODULES[type].cost <= s.bank && chooseTile(s, type))
      .sort((a, b) => PRIORITY[b] - PRIORITY[a]);
    const type = options[0];
    if (!type) {
      break;
    }
    const tile = chooseTile(s, type)!;
    sim.command("bot", { kind: "build", module: type, col: tile.col, row: tile.row });
  }
  // Rest: Waffen aufruesten, billigste zuerst
  for (let guard = 0; guard < 20; guard += 1) {
    const candidates = s.modules
      .filter((m) => MODULES[m.type].weapon)
      .map((m) => ({ m, cost: upgradeCost(m.type, m.level) }))
      .filter(
        (c): c is { m: (typeof s.modules)[number]; cost: number } =>
          c.cost !== null && c.cost <= s.bank,
      )
      .sort((a, b) => a.cost - b.cost);
    const next = candidates[0];
    if (!next) {
      break;
    }
    sim.command("bot", { kind: "upgrade", uid: next.m.uid });
  }
  return repairs;
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
        repairs += spend(sim, style);
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
    modules: s.modules.length,
    marches: s.march.index + (s.phase === "won" ? 1 : 0),
    hull: Math.round(s.fort.hull),
    kills: s.kills,
    scrap: s.players[0]!.scrap,
    repairs,
    winches,
    seconds: Math.round(s.time),
  };
}
