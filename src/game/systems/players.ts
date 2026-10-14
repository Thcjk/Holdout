/**
 * Die Mechs der Crew: laufen auf dem Deck oder am Boden, springen ab, klettern
 * die Strickleiter hoch, werden von der Seilwinde geholt, schiessen von selbst,
 * sammeln Schrott und setzen ihre Faehigkeit ein.
 */

import {
  AHEAD,
  BEHIND,
  CLIMB_TIME,
  DECK_H,
  DECK_W,
  EDGE_HOLD,
  ELEVATION,
  GROUND_BOTTOM,
  GROUND_TOP,
  JUMP_TIME,
  LADDER,
  LADDER_TOP,
  RESPAWN_SPOT,
  SCRAP_MAGNET,
  SCRAP_PICKUP,
  TICK,
  WINCH_COST,
  WINCH_LANDING,
  WINCH_TIME,
} from "../constants";
import { CREW, type CrewSpec } from "../data/crew";
import { moduleCenter } from "../deck";
import { DECK_OBSTACLES, DECK_WALK, insideRect } from "../fortress";
import type { Anchor, PlayerInput, PlayerSetup, PlayerState, Transition } from "../types";
import { clamp, type World } from "../world";
import { damageHull, fire, findTarget } from "./combat";
import { healModule } from "./modules";

export function newPlayer(setup: PlayerSetup, index: number): PlayerState {
  const spec = CREW[setup.crew];
  return {
    id: setup.id,
    name: setup.name,
    crew: setup.crew,
    layer: "deck",
    x: RESPAWN_SPOT.x - 40 + index * 28,
    y: RESPAWN_SPOT.y,
    z: ELEVATION,
    facing: -1,
    moving: false,
    hp: spec.hp,
    hpMax: spec.hp,
    alive: true,
    respawn: 0,
    transition: null,
    edgeTime: 0,
    cooldown: 0.5,
    abilityCd: 0,
    abilityAck: 0,
    kills: 0,
    scrap: 0,
  };
}

export function updatePlayer(w: World, p: PlayerState, input: PlayerInput, fortDx: number): void {
  const spec = CREW[p.crew];
  // Den Faehigkeits-Zaehler immer quittieren, auch wenn gerade nichts geht -
  // sonst loeste ein alter Druck spaeter ueberraschend aus.
  if (input.ability !== undefined && input.ability > p.abilityAck) {
    p.abilityAck = input.ability;
    if (p.alive && p.abilityCd <= 0) {
      useAbility(w, p, spec);
    }
  }
  p.abilityCd = Math.max(0, p.abilityCd - TICK);

  if (!p.alive) {
    p.respawn -= TICK;
    if (p.respawn <= 0) {
      respawn(w, p);
    }
    return;
  }
  if (p.transition) {
    advanceTransition(w, p, p.transition);
    return;
  }

  const length = Math.hypot(input.mx, input.my);
  const scale = length > 1 ? 1 / length : 1;
  const mx = input.mx * scale;
  const my = input.my * scale;
  p.moving = length > 0.05;
  if (Math.abs(mx) > 0.1) {
    p.facing = mx > 0 ? 1 : -1;
  }
  const step = spec.speed * TICK;
  if (p.layer === "deck") {
    p.x += fortDx;
    moveOnDeck(w, p, mx, my, step);
  } else {
    moveOnGround(w, p, mx, my, step);
  }
  if (p.transition) {
    return;
  }
  if (w.state.phase === "march") {
    shoot(w, p, spec);
    if (p.layer === "deck" && spec.moduleRepair) {
      repairNearby(w, p, spec.moduleRepair);
    }
  }
  if (p.layer === "ground") {
    collectScrap(w, p);
  }
}

function blockedOnDeck(x: number, y: number): boolean {
  return DECK_OBSTACLES.some((r) => insideRect(r, x, y));
}

function moveOnDeck(w: World, p: PlayerState, mx: number, my: number, step: number): void {
  const f = w.state.fort;
  let lx = p.x - f.x;
  let ly = p.y - f.y;
  // Achsen getrennt: So gleitet man an Aufbauten entlang, statt haengen zu bleiben.
  const nx = lx + mx * step;
  if (!blockedOnDeck(nx, ly)) {
    lx = nx;
  }
  const ny = ly + my * step;
  if (!blockedOnDeck(lx, ny)) {
    ly = ny;
  }
  lx = clamp(lx, DECK_WALK.x0, DECK_WALK.x1);
  ly = clamp(ly, DECK_WALK.y0, DECK_WALK.y1);
  p.x = f.x + lx;
  p.y = f.y + ly;

  // Gegen eine Kante druecken (hinten ist ein Gelaender): kurz halten, dann abspringen.
  let edge: "left" | "right" | "front" | null = null;
  if (lx <= DECK_WALK.x0 + 0.5 && mx < -0.4) {
    edge = "left";
  } else if (lx >= DECK_WALK.x1 - 0.5 && mx > 0.4) {
    edge = "right";
  } else if (ly >= DECK_WALK.y1 - 0.5 && my > 0.4) {
    edge = "front";
  }
  if (!edge) {
    p.edgeTime = 0;
    return;
  }
  p.edgeTime += TICK;
  if (p.edgeTime >= EDGE_HOLD) {
    jumpOff(w, p, edge, lx, ly);
  }
}

function jumpOff(
  w: World,
  p: PlayerState,
  edge: "left" | "right" | "front",
  lx: number,
  ly: number,
): void {
  const f = w.state.fort;
  let x = f.x + lx;
  let y = f.y + ly;
  if (edge === "left") {
    x = f.x - 34;
  } else if (edge === "right") {
    x = f.x + DECK_W + 34;
  } else {
    y = f.y + DECK_H + 30;
  }
  startTransition(
    w,
    p,
    "jump",
    JUMP_TIME,
    { x: lx, y: ly, z: ELEVATION, onFort: true },
    { x, y: clamp(y, GROUND_TOP, GROUND_BOTTOM), z: 0, onFort: false },
    "ground",
  );
}

function moveOnGround(w: World, p: PlayerState, mx: number, my: number, step: number): void {
  const f = w.state.fort;
  p.x = Math.min(p.x + mx * step, f.x + DECK_W + AHEAD);
  p.y = clamp(p.y + my * step, GROUND_TOP, GROUND_BOTTOM);
  if (p.x < f.x - BEHIND) {
    // Zu weit zurueckgefallen: Die Seilwinde holt den Mech aufs Deck, das kostet Rumpf.
    damageHull(w, WINCH_COST, p.x, p.y);
    startTransition(
      w,
      p,
      "winch",
      WINCH_TIME,
      { x: p.x, y: p.y, z: 0, onFort: false },
      { x: WINCH_LANDING.x, y: WINCH_LANDING.y, z: ELEVATION, onFort: true },
      "deck",
    );
    return;
  }
  const lx = p.x - f.x;
  const ly = p.y - f.y;
  // An der Strickleiter: hochklettern (ausser man laeuft gerade von ihr weg nach vorn).
  if (lx >= LADDER.x0 && lx <= LADDER.x1 && ly >= LADDER.y0 && ly <= LADDER.y1 && my < 0.3) {
    startTransition(
      w,
      p,
      "climb",
      CLIMB_TIME,
      { x: lx, y: ly, z: 0, onFort: true },
      { x: LADDER_TOP.x, y: LADDER_TOP.y, z: ELEVATION, onFort: true },
      "deck",
    );
  }
}

function startTransition(
  w: World,
  p: PlayerState,
  kind: Transition["kind"],
  duration: number,
  from: Anchor,
  to: Anchor,
  toLayer: PlayerState["layer"],
): void {
  p.transition = { kind, t: 0, duration, from, to, toLayer };
  p.edgeTime = 0;
  p.moving = false;
  w.emit({ kind, id: p.id });
}

function resolve(w: World, anchor: Anchor): { x: number; y: number; z: number } {
  if (!anchor.onFort) {
    return anchor;
  }
  const f = w.state.fort;
  return { x: f.x + anchor.x, y: f.y + anchor.y, z: anchor.z };
}

function advanceTransition(w: World, p: PlayerState, tr: Transition): void {
  tr.t += TICK;
  const u = Math.min(1, tr.t / tr.duration);
  const a = resolve(w, tr.from);
  const b = resolve(w, tr.to);
  p.x = a.x + (b.x - a.x) * u;
  p.y = a.y + (b.y - a.y) * u;
  const arc = tr.kind === "jump" ? 18 : tr.kind === "winch" ? 46 : 0;
  p.z = a.z + (b.z - a.z) * u + Math.sin(u * Math.PI) * arc;
  if (b.x !== a.x) {
    p.facing = b.x > a.x ? 1 : -1;
  }
  if (u >= 1) {
    p.layer = tr.toLayer;
    p.z = b.z;
    p.transition = null;
  }
}

function shoot(w: World, p: PlayerState, spec: CrewSpec): void {
  p.cooldown -= TICK;
  if (p.cooldown > 0) {
    return;
  }
  const weapon = spec.weapon;
  const target = findTarget(w, p.x, p.y, weapon.range, p.layer === "deck");
  if (!target) {
    p.cooldown = 0;
    return;
  }
  p.cooldown = weapon.cooldown;
  p.facing = target.x >= p.x ? 1 : -1;
  fire(w, p.id, p.x, p.y, p.z + 26, target, weapon.speed, weapon.damage, "rivet");
}

/** Der Schrauber flickt im Vorbeigehen Module in seiner Naehe. */
function repairNearby(w: World, p: PlayerState, perSecond: number): void {
  const f = w.state.fort;
  for (const m of w.state.modules) {
    const c = moduleCenter(m);
    if (Math.hypot(f.x + c.x - p.x, f.y + c.y - p.y) < 60) {
      healModule(w, m, perSecond * TICK);
    }
  }
}

function collectScrap(w: World, p: PlayerState): void {
  const s = w.state;
  const taken = new Set<number>();
  for (const piece of s.scrap) {
    if (piece.z > 0) {
      continue;
    }
    const dx = p.x - piece.x;
    const dy = p.y - piece.y;
    const distance = Math.hypot(dx, dy);
    if (distance < SCRAP_PICKUP) {
      taken.add(piece.id);
      s.bank += piece.value;
      p.scrap += piece.value;
      w.emit({ kind: "pickup", player: p.id, x: piece.x, y: piece.y, value: piece.value });
    } else if (distance < SCRAP_MAGNET) {
      // Die letzten Meter fliegt Schrott von selbst heran.
      const pull = Math.min(distance, 300 * TICK);
      piece.x += (dx / distance) * pull;
      piece.y += (dy / distance) * pull;
    }
  }
  if (taken.size > 0) {
    s.scrap = s.scrap.filter((piece) => !taken.has(piece.id));
  }
}

function useAbility(w: World, p: PlayerState, spec: CrewSpec): void {
  const ability = spec.ability;
  p.abilityCd = ability.cooldown;
  w.emit({ kind: "ability", id: p.id });
  const f = w.state.fort;
  if (ability.hull) {
    const before = f.hull;
    f.hull = Math.min(f.hullMax, f.hull + ability.hull);
    w.emit({ kind: "repair", amount: f.hull - before });
  }
  if (ability.heal) {
    p.hp = Math.min(p.hpMax, p.hp + ability.heal);
  }
}

function respawn(w: World, p: PlayerState): void {
  const f = w.state.fort;
  p.alive = true;
  p.hp = p.hpMax;
  p.layer = "deck";
  p.x = f.x + RESPAWN_SPOT.x;
  p.y = f.y + RESPAWN_SPOT.y;
  p.z = ELEVATION;
  p.transition = null;
  p.edgeTime = 0;
  w.emit({ kind: "respawn", id: p.id });
}
