/**
 * Die Mechs der Crew: laufen auf dem Deck oder am Boden, springen ab, klettern
 * die Strickleiter hoch, werden von der Seilwinde geholt, kaempfen von selbst,
 * sammeln Schrott und setzen ihre Faehigkeit ein.
 *
 * Jeder Mech hat eine Waffe (Geschoss oder Nahkampf), eine Faehigkeit und eine
 * Eigenheit (`data/crew.ts`). Teile am Arm und Ruecken veraendern die Werte
 * (`data/parts.ts`, ausgerechnet in `statsOf`).
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
import { PARTS, partValue } from "../data/parts";
import { moduleCenter } from "../deck";
import { DECK_OBSTACLES, DECK_WALK, insideRect } from "../fortress";
import type {
  Anchor,
  EnemyState,
  PartId,
  PlayerInput,
  PlayerSetup,
  PlayerState,
  Transition,
} from "../types";
import { clamp, earn, type World } from "../world";
import { canReach, damageEnemy, damageHull, fire, findTarget } from "./combat";
import { healModule } from "./modules";

/** So weit reicht ein Nahkampfschlag zur Seite (halber Kreis vor dem Mech). */
const MELEE_BACK = 8;
/** Rammstoss des Brechers. */
const DASH_TIME = 0.28;
const DASH_SPEED = 400;
/** Sturzflug des Sturmspringers: Reichweite, Flugzeit, Schaden und Umkreis beim Aufkommen. */
const LEAP_RANGE = 260;
const LEAP_TIME = 0.55;
const LEAP_DAMAGE = 55;
export const LEAP_RADIUS = 52;

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
    parts: { arm: null, back: null },
    droneCd: 0.8,
    dash: null,
    lastCmd: 0,
  };
}

/** Werte des Mechs mit allen Teilen. */
export function statsOf(p: PlayerState): {
  speed: number;
  damage: number;
  cooldown: number;
  range: number;
  pierce: number;
  pickup: number;
  abilityCooldown: number;
  moduleRepair: number;
} {
  const spec = CREW[p.crew];
  const part = (id: PartId): number => partValue(p.parts, id);
  return {
    speed: spec.speed * (1 + part("turbine")),
    damage: spec.weapon.damage * (1 + part("schwerer_lauf")),
    cooldown: spec.weapon.cooldown / (1 + part("schnellfeuer")),
    range: spec.weapon.range * (1 + part("weitschuss")),
    pierce: (spec.weapon.pierce ?? 0) + part("durchschlag"),
    pickup: (spec.pickup ?? SCRAP_MAGNET) + part("sammler"),
    abilityCooldown: spec.ability.cooldown * Math.max(0.4, 1 - part("kuehler")),
    moduleRepair: (spec.moduleRepair ?? 0) + part("werkzeug"),
  };
}

/** Ein Teil anlegen: gleiches Teil wird besser, ein anderes ersetzt das alte. */
export function equipPart(w: World, p: PlayerState, id: PartId): void {
  const slot = PARTS[id].slot;
  const current = p.parts[slot];
  if (current && current.id === id) {
    current.level = Math.min(3, current.level + 1);
  } else {
    if (current) {
      // Das alte Teil wird zu Schrott.
      earn(w.state, 10);
    }
    p.parts[slot] = { id, level: 1 };
  }
  // Panzerung: mehr Leben, sofort.
  const hpMax = CREW[p.crew].hp + partValue(p.parts, "panzerung");
  p.hp = Math.min(hpMax, p.hp + Math.max(0, hpMax - p.hpMax));
  p.hpMax = hpMax;
  w.emit({ kind: "part", player: p.id, part: id, level: p.parts[slot]!.level });
}

export function updatePlayer(w: World, p: PlayerState, input: PlayerInput, fortDx: number): void {
  const spec = CREW[p.crew];
  const stats = statsOf(p);
  // Den Faehigkeits-Zaehler immer quittieren, auch wenn gerade nichts geht -
  // sonst loeste ein alter Druck spaeter ueberraschend aus.
  if (input.ability !== undefined && input.ability > p.abilityAck) {
    p.abilityAck = input.ability;
    if (p.alive && p.abilityCd <= 0 && !p.transition) {
      useAbility(w, p, spec, stats.abilityCooldown);
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
  let mx = input.mx * scale;
  let my = input.my * scale;
  let step = stats.speed * TICK;
  if (p.dash) {
    // Rammstoss: geradeaus, schnell, alles im Weg fliegt.
    mx = p.dash.dx;
    my = p.dash.dy;
    step = DASH_SPEED * TICK;
    ram(w, p);
    p.dash.t -= TICK;
    if (p.dash.t <= 0) {
      p.dash = null;
    }
  }
  p.moving = length > 0.05 || p.dash !== null;
  if (Math.abs(mx) > 0.1) {
    p.facing = mx > 0 ? 1 : -1;
  }
  if (p.layer === "deck") {
    p.x += fortDx;
    moveOnDeck(w, p, mx, my, step);
  } else {
    moveOnGround(w, p, mx, my, step);
  }
  if (p.transition) {
    return;
  }
  const fighting = w.state.phase === "march" || w.state.phase === "loot";
  if (fighting) {
    attack(w, p, spec, stats);
    if (spec.drones) {
      droneFire(w, p);
    }
    if (p.layer === "deck" && stats.moduleRepair > 0) {
      repairNearby(w, p, stats.moduleRepair);
    }
  }
  if (p.layer === "ground") {
    collectScrap(w, p, stats.pickup);
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
  if (p.dash) {
    return;
  }

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
  const spec = CREW[p.crew];
  p.x = Math.min(p.x + mx * step, f.x + DECK_W + AHEAD);
  p.y = clamp(p.y + my * step, GROUND_TOP, GROUND_BOTTOM);
  if (p.x < f.x - BEHIND) {
    // Zu weit zurueckgefallen: Die Seilwinde holt den Mech aufs Deck, das kostet Rumpf.
    if (!spec.freeWinch) {
      damageHull(w, WINCH_COST, p.x, p.y);
    }
    w.state.stats.winches += 1;
    p.dash = null;
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
    p.dash = null;
    startTransition(
      w,
      p,
      "climb",
      CLIMB_TIME,
      { x: lx, y: ly, z: 0, onFort: true },
      { x: LADDER_TOP.x, y: LADDER_TOP.y, z: ELEVATION, onFort: true },
      "deck",
    );
    return;
  }
  // Sturmspringer: ueberall an der Wand hoch, wenn man gegen sie laeuft.
  if (spec.leapUp && !p.dash) {
    // Ein Streifen vor der Vorderkante und an den Seiten (auch ein Stueck darunter).
    const front = lx > -10 && lx < DECK_W + 10 && ly > DECK_H - 40 && ly < DECK_H + 30 && my < -0.4;
    const left = lx > -40 && lx < 10 && ly > 0 && ly < DECK_H && mx > 0.4;
    const right = lx > DECK_W - 10 && lx < DECK_W + 40 && ly > 0 && ly < DECK_H && mx < -0.4;
    if (front || left || right) {
      p.edgeTime += TICK;
      if (p.edgeTime >= EDGE_HOLD) {
        startTransition(
          w,
          p,
          "leap",
          0.45,
          { x: lx, y: ly, z: 0, onFort: true },
          {
            x: clamp(lx, DECK_WALK.x0 + 6, DECK_WALK.x1 - 6),
            y: clamp(ly, DECK_WALK.y0 + 6, DECK_WALK.y1 - 6),
            z: ELEVATION,
            onFort: true,
          },
          "deck",
        );
      }
    } else {
      p.edgeTime = 0;
    }
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
  impact?: number,
): void {
  p.transition = { kind, t: 0, duration, from, to, toLayer };
  if (impact) {
    p.transition.impact = impact;
  }
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
  const arc =
    tr.kind === "jump"
      ? 18
      : tr.kind === "winch"
        ? 46
        : tr.kind === "leap"
          ? 60
          : tr.kind === "hook"
            ? 30
            : 0;
  p.z = a.z + (b.z - a.z) * u + Math.sin(u * Math.PI) * arc;
  if (b.x !== a.x) {
    p.facing = b.x > a.x ? 1 : -1;
  }
  if (u >= 1) {
    p.layer = tr.toLayer;
    p.z = b.z;
    p.transition = null;
    if (tr.impact) {
      impact(w, p, tr.impact);
    }
  }
}

/** Sturzflug kommt auf: alles im Umkreis auf derselben Ebene wird umgerissen. */
function impact(w: World, p: PlayerState, damage: number): void {
  const fromDeck = p.layer === "deck";
  for (const e of w.state.enemies) {
    const sameLayer = fromDeck ? e.layer === "deck" || e.layer === "climb" : e.layer !== "deck";
    if (e.hp > 0 && sameLayer && Math.hypot(e.x - p.x, e.y - p.y) < LEAP_RADIUS) {
      damageEnemy(w, e, damage, p.x, p.y, p.id, { pierce: true });
    }
  }
  w.emit({ kind: "impact", x: p.x, y: p.y - p.z, radius: LEAP_RADIUS });
}

// --- Kaempfen --------------------------------------------------------------------------------------

function attack(w: World, p: PlayerState, spec: CrewSpec, stats: ReturnType<typeof statsOf>): void {
  p.cooldown -= TICK;
  if (p.cooldown > 0) {
    return;
  }
  const weapon = spec.weapon;
  const fromDeck = p.layer === "deck";
  const target = findTarget(w, p.x, p.y, stats.range, fromDeck);
  if (!target) {
    p.cooldown = 0;
    return;
  }
  p.cooldown = stats.cooldown;
  p.facing = target.x >= p.x ? 1 : -1;
  if (weapon.kind === "melee") {
    // Hammer: trifft alle im Halbkreis vor dem Mech.
    for (const e of w.state.enemies) {
      const dx = e.x - p.x;
      if (
        e.hp > 0 &&
        canReach(w, fromDeck, e) &&
        dx * p.facing > -MELEE_BACK &&
        Math.hypot(dx, e.y - p.y) < stats.range + 10
      ) {
        damageEnemy(w, e, stats.damage, p.x, p.y, p.id);
      }
    }
    w.emit({ kind: "melee", id: p.id, x: p.x + p.facing * 22, y: p.y - p.z - 18 });
    return;
  }
  const look = p.crew === "springer" ? "harpoon" : "rivet";
  fire(w, p.id, p.x, p.y, p.z + 26, target, weapon.speed, stats.damage, look, 0, {
    splash: weapon.splash ?? 0,
    pierce: stats.pierce,
  });
}

/** Die zwei Drohnen der Funkerin schiessen abwechselnd. */
function droneFire(w: World, p: PlayerState): void {
  p.droneCd -= TICK;
  if (p.droneCd > 0) {
    return;
  }
  const side = Math.round(w.state.time * 10) % 2 === 0 ? 1 : -1;
  const x = p.x + side * 18;
  const target = findTarget(w, x, p.y, 190, p.layer === "deck");
  if (!target) {
    p.droneCd = 0.1;
    return;
  }
  p.droneCd = 0.32;
  fire(w, p.id, x, p.y, p.z + 46, target, 520, 5, "bolt");
}

/** Schrauber und Werkzeugkiste: Module in der Naehe flicken. */
function repairNearby(w: World, p: PlayerState, perSecond: number): void {
  const f = w.state.fort;
  for (const m of w.state.modules) {
    const c = moduleCenter(m);
    if (Math.hypot(f.x + c.x - p.x, f.y + c.y - p.y) < 60) {
      healModule(w, m, perSecond * TICK);
    }
  }
}

function collectScrap(w: World, p: PlayerState, reach: number): void {
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
      earn(s, piece.value);
      p.scrap += piece.value;
      w.emit({ kind: "pickup", player: p.id, x: piece.x, y: piece.y, value: piece.value });
    } else if (distance < reach) {
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

// --- Faehigkeiten ----------------------------------------------------------------------------------

function useAbility(w: World, p: PlayerState, spec: CrewSpec, cooldown: number): void {
  const used = ABILITIES[spec.id](w, p);
  if (!used) {
    return;
  }
  p.abilityCd = cooldown;
  w.emit({ kind: "ability", id: p.id });
}

/** Jede Faehigkeit gibt zurueck, ob sie ausgeloest hat (sonst bleibt sie bereit). */
const ABILITIES: Record<PlayerState["crew"], (w: World, p: PlayerState) => boolean> = {
  schrauber: notreparatur,
  kanonier: breitseite,
  brecher: rammstoss,
  bergung: enterhaken,
  funkerin: luftschlag,
  springer: sturzflug,
};

/** Schrauber: Rumpf, eigenes Leben und Module in der Naehe. */
function notreparatur(w: World, p: PlayerState): boolean {
  const f = w.state.fort;
  const before = f.hull;
  f.hull = Math.min(f.hullMax, f.hull + 45);
  w.emit({ kind: "repair", amount: f.hull - before });
  p.hp = Math.min(p.hpMax, p.hp + 40);
  for (const m of w.state.modules) {
    const c = moduleCenter(m);
    if (Math.hypot(f.x + c.x - p.x, f.y + c.y - p.y) < 110) {
      healModule(w, m, 40);
    }
  }
  return true;
}

/** Kanonier: acht Granaten auf die naechsten Gegner am Boden und an der Wand. */
function breitseite(w: World, p: PlayerState): boolean {
  const targets = w.state.enemies
    .filter((e) => e.hp > 0 && (e.layer === "ground" || e.layer === "climb"))
    .map((e) => ({ e, d: Math.hypot(e.x - p.x, e.y - p.y) }))
    .filter((t) => t.d < 340)
    .sort((a, b) => a.d - b.d)
    .slice(0, 8);
  if (targets.length === 0) {
    return false;
  }
  targets.forEach(({ e }, i) => {
    w.state.shells.push({
      id: w.state.nextId++,
      x0: p.x,
      y0: p.y,
      z0: p.z + 30,
      x1: e.x,
      y1: e.y,
      t: -i * 0.06,
      duration: 0.75,
      damage: 32,
      radius: 34,
    });
  });
  return true;
}

/** Brecher: Rammstoss in Laufrichtung. */
function rammstoss(_w: World, p: PlayerState): boolean {
  const dx = p.facing;
  p.dash = { t: DASH_TIME, dx, dy: 0, hit: [] };
  return true;
}

/** Waehrend des Rammstosses: Gegner im Weg werden weggeschleudert - vom Deck sogar herunter. */
function ram(w: World, p: PlayerState): void {
  const f = w.state.fort;
  const dash = p.dash;
  if (!dash) {
    return;
  }
  for (const e of w.state.enemies) {
    if (e.hp <= 0 || dash.hit.includes(e.id) || Math.hypot(e.x - p.x, e.y - p.y) > 28) {
      continue;
    }
    dash.hit.push(e.id);
    if (p.layer === "deck" && (e.layer === "deck" || e.layer === "climb")) {
      // Ueber Bord: Er landet am Boden vor der naechsten Kante.
      const lx = e.x - f.x;
      e.layer = "ground";
      e.mode = "approach";
      e.z = 0;
      if (lx < 30) {
        e.x = f.x - 40;
      } else if (lx > DECK_W - 30) {
        e.x = f.x + DECK_W + 40;
      } else {
        e.y = f.y + DECK_H + 30;
      }
      e.timer = 0;
      // Enterer suchen sich dann eine neue Kletterstelle.
      e.tx = -1;
      damageEnemy(w, e, 40, p.x, p.y, p.id, { pierce: true });
    } else if (p.layer === "ground" && e.layer !== "deck") {
      damageEnemy(w, e, 40, p.x, p.y, p.id, { pierce: true });
      e.pushX = dash.dx * 300;
      e.pushY = (e.y - p.y) * 4;
    }
  }
}

/** Bergungslaeuferin: am Boden zurueck aufs Deck, oben allen Schrott heranziehen. */
function enterhaken(w: World, p: PlayerState): boolean {
  const s = w.state;
  const f = s.fort;
  if (p.layer === "ground") {
    p.dash = null;
    startTransition(
      w,
      p,
      "hook",
      0.45,
      { x: p.x, y: p.y, z: 0, onFort: false },
      {
        x: clamp(p.x - f.x, DECK_WALK.x0 + 10, DECK_WALK.x1 - 10),
        y: clamp(p.y - f.y, DECK_WALK.y0 + 10, DECK_WALK.y1 - 10),
        z: ELEVATION,
        onFort: true,
      },
      "deck",
    );
    return true;
  }
  const reach = 300;
  const taken = s.scrap.filter((piece) => Math.hypot(piece.x - p.x, piece.y - p.y) < reach);
  if (taken.length === 0) {
    return false;
  }
  for (const piece of taken) {
    earn(s, piece.value);
    p.scrap += piece.value;
    w.emit({ kind: "pickup", player: p.id, x: piece.x, y: piece.y, value: piece.value });
  }
  const ids = new Set(taken.map((piece) => piece.id));
  s.scrap = s.scrap.filter((piece) => !ids.has(piece.id));
  w.emit({ kind: "hook", id: p.id });
  return true;
}

/** Funkerin: fuenf Einschlaege in einer Reihe auf die dichteste Gruppe. */
function luftschlag(w: World, p: PlayerState): boolean {
  const center = densest(w, p, 420, (e) => e.layer === "ground" || e.layer === "climb");
  if (!center) {
    return false;
  }
  for (let i = 0; i < 5; i += 1) {
    const x = center.x + (i - 2) * 34;
    w.state.shells.push({
      id: w.state.nextId++,
      x0: x,
      y0: center.y,
      z0: 320,
      x1: x,
      y1: center.y + (i % 2 === 0 ? -8 : 8),
      t: -0.5 - i * 0.12,
      duration: 0.6,
      damage: 45,
      radius: 40,
    });
  }
  return true;
}

/** Sturmspringer: mitten in die naechste Gruppe springen - vom Deck runter oder hinauf. */
function sturzflug(w: World, p: PlayerState): boolean {
  const f = w.state.fort;
  const onDeck = p.layer === "deck";
  // Am Boden lieber hoch aufs Deck, wenn dort Gegner stehen.
  const deckTarget = !onDeck ? densest(w, p, LEAP_RANGE + 80, (e) => e.layer === "deck") : null;
  const groundTarget = densest(w, p, LEAP_RANGE, (e) => e.layer === "ground");
  const target = deckTarget ?? groundTarget;
  if (!target) {
    return false;
  }
  p.dash = null;
  const toDeck = deckTarget !== null;
  const from: Anchor = onDeck
    ? { x: p.x - f.x, y: p.y - f.y, z: p.z, onFort: true }
    : { x: p.x, y: p.y, z: p.z, onFort: false };
  const to: Anchor = toDeck
    ? {
        x: clamp(target.x - f.x, DECK_WALK.x0, DECK_WALK.x1),
        y: clamp(target.y - f.y, DECK_WALK.y0, DECK_WALK.y1),
        z: ELEVATION,
        onFort: true,
      }
    : {
        x: target.x,
        y: clamp(target.y, GROUND_TOP, GROUND_BOTTOM),
        z: 0,
        onFort: false,
      };
  startTransition(w, p, "leap", LEAP_TIME, from, to, toDeck ? "deck" : "ground", LEAP_DAMAGE);
  return true;
}

/** Mitte der dichtesten Gruppe in Reichweite (oder null). */
function densest(
  w: World,
  p: PlayerState,
  range: number,
  filter: (e: EnemyState) => boolean,
): { x: number; y: number } | null {
  const candidates = w.state.enemies.filter(
    (e) => e.hp > 0 && filter(e) && Math.hypot(e.x - p.x, e.y - p.y) < range,
  );
  let best: EnemyState | null = null;
  let bestCount = 0;
  for (const e of candidates) {
    const count = candidates.filter((o) => Math.hypot(o.x - e.x, o.y - e.y) < 60).length;
    if (count > bestCount) {
      best = e;
      bestCount = count;
    }
  }
  return best ? { x: best.x, y: best.y } : null;
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
  p.dash = null;
  w.emit({ kind: "respawn", id: p.id });
}
