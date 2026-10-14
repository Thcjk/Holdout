/**
 * Module auf dem Deck: bauen, aufruesten, abbauen (nur in der Rast), das
 * Angebot der Rast und was die Module im Marsch tun.
 *
 * Module haben Leben. Gegner auf dem Deck, Ballista-Bolzen und der Koloss
 * machen sie kaputt; ein kaputtes Modul tut nichts, bis es wieder zur Haelfte
 * repariert ist (Schrauber in der Naehe, Werkstatt, oder an der naechsten Station).
 */

import { ELEVATION, OFFER_SIZE, REROLL_COST, REROLL_STEP, TICK } from "../constants";
import { MODULE_IDS, MODULES, moduleHp, sellValue, stat, upgradeCost } from "../data/modules";
import { canPlace, generatorBonus, moduleCenter, oilZone } from "../deck";
import { insideRect } from "../fortress";
import type { EnemyState, GameState, ModuleId, ModuleState } from "../types";
import { clamp, type World } from "../world";
import { canReach, damageEnemy, fire, findTarget, underDeck } from "./combat";

/** Was Neu-Wuerfeln gerade kostet (beim Haendler weniger). */
export function rerollCost(state: GameState): number {
  const trader = state.map.nodes[state.at]?.type === "haendler";
  return trader ? 2 + state.rerolls : REROLL_COST + REROLL_STEP * state.rerolls;
}

/** Zufaelliges Angebot: verschiedene Module aus dem Vorrat. */
export function rollOffer(
  w: World,
  pool: readonly ModuleId[] = MODULE_IDS,
  size = OFFER_SIZE,
): ModuleId[] {
  const left = [...pool];
  const offer: ModuleId[] = [];
  while (offer.length < size && left.length > 0) {
    const index = Math.floor(w.rng() * left.length);
    offer.push(left.splice(index, 1)[0]!);
  }
  return offer;
}

export function build(w: World, type: ModuleId, col: number, row: number): void {
  const s = w.state;
  const spec = MODULES[type];
  if (!s.offer.includes(type) || s.bank < spec.cost || !canPlace(s.modules, type, col, row)) {
    return;
  }
  s.bank -= spec.cost;
  // Jedes Angebot gibt es nur einmal.
  s.offer.splice(s.offer.indexOf(type), 1);
  const hp = moduleHp(type, 1);
  const module: ModuleState = {
    uid: s.nextId++,
    type,
    col,
    row,
    level: 1,
    cooldown: 0.6,
    facing: -1,
    hp,
    hpMax: hp,
    broken: false,
  };
  s.modules.push(module);
  w.refreshFortress();
  w.emit({ kind: "built", uid: module.uid, type });
}

export function upgrade(w: World, uid: number): void {
  const s = w.state;
  const module = s.modules.find((m) => m.uid === uid);
  const cost = module ? upgradeCost(module.type, module.level) : null;
  if (!module || cost === null || s.bank < cost) {
    return;
  }
  s.bank -= cost;
  module.level += 1;
  // Aufruesten macht es auch wieder ganz.
  module.hpMax = moduleHp(module.type, module.level);
  module.hp = module.hpMax;
  module.broken = false;
  w.refreshFortress();
  w.emit({ kind: "upgraded", uid, type: module.type });
}

export function sell(w: World, uid: number): void {
  const s = w.state;
  const module = s.modules.find((m) => m.uid === uid);
  if (!module) {
    return;
  }
  s.bank += sellValue(module.type, module.level);
  s.modules = s.modules.filter((m) => m.uid !== uid);
  w.refreshFortress();
  w.emit({ kind: "sold", uid, type: module.type });
}

/** Tempo und Rumpf-Hoechstwert aus den heilen Modulen (Grundrumpf: `fort.baseHull`). */
export function refreshFortress(state: GameState): void {
  let speed = 1;
  let hullMax = state.fort.baseHull;
  for (const m of state.modules) {
    if (m.broken) {
      continue;
    }
    if (m.type === "motor") {
      speed += stat(MODULES.motor.power, m.level);
    } else if (m.type === "platte") {
      hullMax += stat(MODULES.platte.power, m.level);
    }
  }
  state.fort.speed = speed;
  // Mehr Hoechstwert: Der Zuwachs kommt sofort dazu. Weniger: kappen.
  const gained = hullMax - state.fort.hullMax;
  state.fort.hullMax = hullMax;
  state.fort.hull = clamp(state.fort.hull + Math.max(0, gained), 0, hullMax);
}

/** Ein Modul reparieren. Ab der Haelfte arbeitet ein kaputtes wieder. */
export function healModule(w: World, m: ModuleState, amount: number): void {
  if (m.hp >= m.hpMax) {
    return;
  }
  m.hp = Math.min(m.hpMax, m.hp + amount);
  if (m.broken && m.hp >= m.hpMax / 2) {
    m.broken = false;
    w.refreshFortress();
  }
}

/** An der Station wird alles wieder heil. */
export function repairAllModules(w: World): void {
  for (const m of w.state.modules) {
    m.hp = m.hpMax;
    m.broken = false;
  }
  w.refreshFortress();
}

// --- Im Marsch ------------------------------------------------------------------------------------

export function updateModules(w: World): void {
  const s = w.state;
  const f = s.fort;
  for (const m of s.modules) {
    if (m.broken) {
      continue;
    }
    const spec = MODULES[m.type];
    const c = moduleCenter(m);
    const x = f.x + c.x;
    const y = f.y + c.y;
    const z = ELEVATION + 18;
    if (spec.weapon) {
      m.cooldown -= TICK;
      if (m.cooldown > 0) {
        continue;
      }
      const fired = fireModule(w, m, x, y, z);
      // Ohne Ziel gleich wieder bereit; mit Ziel: Generatoren auf Nachbarfeldern machen schneller.
      m.cooldown = fired ? stat(spec.cooldown, m.level) / (1 + generatorBonus(s.modules, m)) : 0;
      continue;
    }
    if (m.type === "oel") {
      pourOil(w, m);
    } else if (m.type === "magnet") {
      pullScrap(w, x, y, stat(spec.power, m.level));
    } else if (m.type === "werkstatt") {
      f.hull = Math.min(f.hullMax, f.hull + stat(spec.power, m.level) * TICK);
      // Und flickt nebenbei die anderen Module.
      for (const other of s.modules) {
        if (other !== m) {
          healModule(w, other, 2 * m.level * TICK);
        }
      }
    }
  }
}

/** Waffenmodul feuert. `true`, wenn es ein Ziel hatte. */
function fireModule(w: World, m: ModuleState, x: number, y: number, z: number): boolean {
  const spec = MODULES[m.type];
  const range = stat(spec.range, m.level);
  const damage = stat(spec.damage, m.level);
  const owner = `m${m.uid}`;
  if (m.type === "geschuetz") {
    const target = findTarget(w, x, y, range, true);
    if (!target) {
      return false;
    }
    m.facing = target.x >= x ? 1 : -1;
    fire(w, owner, x, y, z, target, 560, damage, "bolt");
    return true;
  }
  if (m.type === "harpune") {
    // Der staerkste Gegner in Reichweite, der nicht schon auf dem Deck steht.
    let target: EnemyState | null = null;
    for (const e of w.state.enemies) {
      if (
        e.hp > 0 &&
        e.layer !== "deck" &&
        canReach(w, true, e) &&
        Math.hypot(e.x - x, e.y - y) < range &&
        (!target || e.hp > target.hp)
      ) {
        target = e;
      }
    }
    if (!target) {
      return false;
    }
    m.facing = target.x >= x ? 1 : -1;
    fire(w, owner, x, y, z, target, 700, damage, "harpoon", 600);
    return true;
  }
  if (m.type === "moerser") {
    return fireMortar(w, m, x, y, z, range, damage, stat(spec.area, m.level));
  }
  if (m.type === "spule") {
    return zap(w, m, x, y, z, range, damage, stat(spec.area, m.level));
  }
  return false;
}

/** Moerser: zielt dorthin, wo die meisten Gegner am Boden beieinanderstehen (nicht zu nah). */
function fireMortar(
  w: World,
  m: ModuleState,
  x: number,
  y: number,
  z: number,
  range: number,
  damage: number,
  radius: number,
): boolean {
  const enemies = w.state.enemies;
  let best: EnemyState | null = null;
  let bestCount = 0;
  for (const e of enemies) {
    const distance = Math.hypot(e.x - x, e.y - y);
    if (
      e.hp <= 0 ||
      (e.layer !== "ground" && e.layer !== "climb") ||
      distance > range ||
      distance < 100 ||
      underDeck(w, e.x, e.y)
    ) {
      continue;
    }
    let count = 0;
    for (const other of enemies) {
      if (
        other.hp > 0 &&
        other.layer !== "deck" &&
        Math.hypot(other.x - e.x, other.y - e.y) < radius
      ) {
        count += 1;
      }
    }
    if (count > bestCount) {
      best = e;
      bestCount = count;
    }
  }
  if (!best) {
    return false;
  }
  m.facing = best.x >= x ? 1 : -1;
  w.state.shells.push({
    id: w.state.nextId++,
    x0: x,
    y0: y,
    z0: z,
    x1: best.x,
    y1: best.y,
    t: 0,
    duration: 1,
    damage,
    radius,
  });
  w.emit({ kind: "mortar", uid: m.uid });
  return true;
}

/** Funkenspule: Blitz springt von Gegner zu Gegner - ueberallhin, auch unters Deck und aufs Deck. */
function zap(
  w: World,
  m: ModuleState,
  x: number,
  y: number,
  z: number,
  range: number,
  damage: number,
  targets: number,
): boolean {
  const enemies = w.state.enemies;
  let first: EnemyState | null = null;
  let firstDistance = range;
  for (const e of enemies) {
    const distance = Math.hypot(e.x - x, e.y - y);
    if (e.hp > 0 && distance < firstDistance) {
      first = e;
      firstDistance = distance;
    }
  }
  if (!first) {
    return false;
  }
  const hit = new Set<number>();
  const points: [number, number, number][] = [[x, y, z + 10]];
  let current: EnemyState | null = first;
  while (current && hit.size < targets) {
    hit.add(current.id);
    points.push([current.x, current.y, current.z + 16]);
    damageEnemy(w, current, damage, x, y, `m${m.uid}`, { pierce: true });
    const from: EnemyState = current;
    current = null;
    let bestDistance = 80;
    for (const e of enemies) {
      const distance = Math.hypot(e.x - from.x, e.y - from.y);
      if (e.hp > 0 && !hit.has(e.id) && distance < bestDistance) {
        current = e;
        bestDistance = distance;
      }
    }
  }
  w.emit({ kind: "zap", points });
  return true;
}

/** Oelkessel: brennt alles am Boden unter seiner Kante - und wer gerade die Wand hochklettert. */
function pourOil(w: World, m: ModuleState): void {
  const f = w.state.fort;
  const zone = oilZone(m);
  const damage = stat(MODULES.oel.power, m.level) * TICK;
  for (const e of w.state.enemies) {
    if (
      e.hp > 0 &&
      (e.layer === "ground" || e.layer === "climb") &&
      insideRect(zone, e.x - f.x, e.y - f.y)
    ) {
      // Kletterer trifft es doppelt: das Oel laeuft genau die Wand hinunter.
      const amount = e.layer === "climb" ? damage * 2 : damage;
      damageEnemy(w, e, amount, e.x, e.y, `m${m.uid}`, { pierce: true, quiet: true });
    }
  }
}

/** Schrottmagnet: hebt Schrott in Reichweite aufs Deck und legt ihn in die Kasse. */
function pullScrap(w: World, x: number, y: number, radius: number): void {
  const s = w.state;
  const taken = new Set<number>();
  for (const piece of s.scrap) {
    const dx = x - piece.x;
    const dy = y - piece.y;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) {
      continue;
    }
    const step = Math.min(distance, 220 * TICK);
    piece.x += (dx / (distance || 1)) * step;
    piece.y += (dy / (distance || 1)) * step;
    // Je naeher am Magneten, desto hoeher schwebt das Stueck.
    piece.z = Math.max(piece.z, ELEVATION * (1 - Math.min(1, distance / radius)));
    if (distance < 14) {
      taken.add(piece.id);
      s.bank += piece.value;
      w.emit({
        kind: "pickup",
        player: "magnet",
        x: piece.x,
        y: piece.y - ELEVATION,
        value: piece.value,
      });
    }
  }
  if (taken.size > 0) {
    s.scrap = s.scrap.filter((piece) => !taken.has(piece.id));
  }
}
