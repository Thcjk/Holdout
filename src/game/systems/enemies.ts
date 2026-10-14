/**
 * Die goldene Armee: Trupps planen und ankuendigen, Gegner auftauchen lassen
 * und jede Art nach ihrer Aufgabe handeln lassen.
 *
 * Alle Ziele (`slotX/slotY`, `tx/ty`) sind relativ zur Festung - sie laeuft ja
 * weiter, und die Gegner sollen ihr folgen.
 *
 *   Sandlaeufer, Phalanx: an einen Fuss oder unter den Bauch, dort hacken.
 *   Enterer:      zu einer Kletterstelle, die Wand hoch, auf dem Deck Module zerlegen.
 *   Skarabaeus:   fliegt ueber das Deck und landet dort.
 *   Sandpriester: haelt Abstand, gibt Verbuendeten in der Naehe einen Schild.
 *   Streitwagen:  rammt einen Fuss (Festung kurz langsamer), dreht ab, rammt wieder.
 *   Ballista:     haelt grossen Abstand und schiesst Bolzen auf Module.
 *   Belagerungsturm: dockt seitlich an, ueber seine Bruecke kommen Enterer aufs Deck.
 *   Goldener Koloss: laeuft vor der Festung mit und schlaegt aufs Deck (vorher rot markiert).
 */

import {
  BEHIND,
  DECK_COLS,
  DECK_H,
  DECK_ROWS,
  DECK_W,
  ELEVATION,
  FRONT_SPAWN,
  GROUND_BOTTOM,
  GROUND_TOP,
  MAX_ENEMIES,
  TICK,
  TILE_H,
  TILE_W,
  WARNING_TIME,
} from "../constants";
import { CREW } from "../data/crew";
import { ENEMIES, TRUPPS } from "../data/enemies";
import { CLIMB_POINTS, climbOpen, moduleCenter, moduleRect } from "../deck";
import { ATTACK_SLOTS, DECK_WALK, LEGS, STRIDE } from "../fortress";
import type { EnemyState, EnemyType, PlayerState, Side, TruppKind } from "../types";
import { clamp, type World } from "../world";
import { damageHull, damageModule, hurtPlayer } from "./combat";

/** Wie oft Trupps aus welcher Richtung kommen. */
const SIDE_WEIGHTS: readonly [Side, number][] = [
  ["hinten", 0.32],
  ["vorn", 0.24],
  ["oben", 0.22],
  ["unten", 0.22],
];

/** Mitte des Sonnenherzens (relativ zur Festung) - dorthin wollen Gegner auf dem Deck. */
const HEART = { x: 160, y: 64 } as const;
/** So lange braucht ein Enterer die Rumpfwand hoch. */
export const ENEMY_CLIMB_TIME = 2.4;
/** So lange ist der Schlag des Koloss vorher zu sehen. */
export const SLAM_WARNING = 1.4;
/** So lange laeuft die Festung nach einem Rammstoss gebremst. */
export const RAM_SLOW = 2;
/** Nach dem Rammstoss: so lange steckt der Streitwagen fest, so lange faehrt er zurueck. */
export const STUCK_TIME = 1.6;
const RETREAT_TIME = 3;
/** Andockpunkte des Belagerungsturms und wo seine Enterer auf dem Deck ankommen. */
const DOCKS = [
  { x: -42, y: 92, deckX: 12, deckY: 92 },
  { x: DECK_W + 42, y: 92, deckX: DECK_W - 12, deckY: 92 },
] as const;
/** Der Koloss laeuft hier vor der Festung mit. */
const KOLOSS_LANE = { x: DECK_W / 2, y: DECK_H + 132 } as const;
/** Die Sonnenbarke schwebt vor dem Bug der Festung her, so hoch ueber dem Boden. */
const BARKE_LANE = { x: DECK_W + 110, y: 40 } as const;
const BARKE_HEIGHT = 64;

// --- Planen und Auftauchen -----------------------------------------------------------------------

/** Trupps planen, ankuendigen, auftauchen lassen; den Endgegner rufen. */
export function spawn(w: World): void {
  const s = w.state;
  const spec = w.march();
  if (!spec) {
    return;
  }
  // Angekuendigte Trupps tauchen auf.
  for (const warning of s.warnings) {
    warning.eta -= TICK;
    if (warning.eta <= 0) {
      spawnGroup(w, warning.side, warning.at, warning.members, warning.trupp, spec.hp);
    }
  }
  s.warnings = s.warnings.filter((warning) => warning.eta > 0);

  const progress = Math.min(1, s.march.done / s.march.length);
  if (s.march.boss === "waiting" && spec.boss && progress >= 0.25) {
    spawnBoss(w, spec.boss, spec.hp);
  }

  s.march.spawnTimer -= TICK;
  if (s.march.spawnTimer > 0) {
    return;
  }
  // Solange der Endgegner da ist, schickt die Armee weniger Trupps hinterher.
  const bossFactor = s.march.boss === "alive" ? 0.5 : 1;
  // Beim Pluendern steht die Festung - die Armee kommt etwas gemaechlicher.
  const lootFactor = s.phase === "loot" ? 0.4 : 1;
  const rate =
    (spec.spawnStart + (spec.spawnEnd - spec.spawnStart) * progress) * bossFactor * lootFactor;
  if (rate <= 0) {
    s.march.spawnTimer = 1;
    return;
  }
  // Ab und zu ein Einzelgaenger ohne Warnung, sonst ein Trupp aus der Mischung des Marschs.
  const loner = w.rng() < 0.22;
  const trupp: TruppKind = loner ? "laeufer" : pickTrupp(w, spec.mix);
  const members: EnemyType[] = loner ? ["laeufer"] : rollMembers(w, trupp, progress);
  const threat = members.reduce((sum, type) => sum + ENEMIES[type].threat, 0);
  // Im Mittel kommt `rate` Bedrohung pro Sekunde.
  s.march.spawnTimer = (Math.max(1, threat) / rate) * (0.75 + w.rng() * 0.5);
  const side = trupp === "turm" ? (w.rng() < 0.6 ? "hinten" : "vorn") : pickSide(w);
  const at = pickEdgeSpot(w, side);
  if (loner) {
    spawnGroup(w, side, at, members, trupp, spec.hp);
    return;
  }
  s.warnings.push({
    id: s.nextId++,
    side,
    at,
    eta: WARNING_TIME + earlyWarning(w),
    count: members.length,
    trupp,
    members,
  });
}

/** Die Funkerin hoert Trupps frueher kommen. */
function earlyWarning(w: World): number {
  let bonus = 0;
  for (const p of w.state.players) {
    if (p.alive) {
      bonus = Math.max(bonus, CREW[p.crew].earlyWarning ?? 0);
    }
  }
  return bonus;
}

function pickTrupp(w: World, mix: Partial<Record<TruppKind, number>>): TruppKind {
  const entries = Object.entries(mix) as [TruppKind, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = w.rng() * total;
  for (const [kind, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      return kind;
    }
  }
  return "laeufer";
}

/** Wer mitlaeuft. Spaeter im Marsch werden die Trupps groesser. */
function rollMembers(w: World, trupp: TruppKind, progress: number): EnemyType[] {
  const members: EnemyType[] = [];
  for (const [type, min, max] of TRUPPS[trupp]) {
    const extra =
      max > min ? Math.round((max - min) * (0.3 + progress * 0.7) * w.rng() + w.rng() * 0.6) : 0;
    const count = Math.min(max, min + extra);
    for (let i = 0; i < count; i += 1) {
      members.push(type);
    }
  }
  return members.length > 0 ? members : ["laeufer"];
}

function pickSide(w: World): Side {
  let roll = w.rng();
  for (const [side, weight] of SIDE_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) {
      return side;
    }
  }
  return "hinten";
}

/** Stelle am Rand: y fuer hinten/vorn, x relativ zur Festung fuer oben/unten. */
function pickEdgeSpot(w: World, side: Side): number {
  if (side === "hinten" || side === "vorn") {
    return GROUND_TOP + 20 + w.rng() * (GROUND_BOTTOM - GROUND_TOP - 40);
  }
  return -BEHIND + 30 + w.rng() * (BEHIND + DECK_W + 300 - 60);
}

/** Wo ein Trupp von dieser Seite auftaucht (Welt). */
export function edgePoint(w: World, side: Side, at: number): { x: number; y: number } {
  const f = w.state.fort;
  switch (side) {
    case "hinten":
      return { x: f.x - BEHIND - 40, y: at };
    case "vorn":
      return { x: f.x + FRONT_SPAWN, y: at };
    case "oben":
      return { x: f.x + at, y: GROUND_TOP - 110 };
    case "unten":
      return { x: f.x + at, y: GROUND_BOTTOM + 40 };
  }
}

function spawnGroup(
  w: World,
  side: Side,
  at: number,
  members: readonly EnemyType[],
  trupp: TruppKind,
  hpFactor: number,
): void {
  const s = w.state;
  const origin = edgePoint(w, side, at);
  const along = side === "hinten" || side === "vorn" ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const count = members.length;
  members.forEach((type, i) => {
    if (s.enemies.length >= MAX_ENEMIES) {
      return;
    }
    const spread = (i - (count - 1) / 2) * 18 + (w.rng() - 0.5) * 8;
    const depth = (w.rng() - 0.5) * 24;
    addEnemy(
      w,
      type,
      origin.x + along.x * spread + along.y * depth,
      origin.y + along.y * spread + along.x * depth,
      hpFactor,
    );
  });
  if (count > 1) {
    w.emit({ kind: "trupp", side, count, trupp });
  }
}

function spawnBoss(w: World, type: EnemyType, hpFactor: number): void {
  const s = w.state;
  s.march.boss = "alive";
  // Der Endgegner kommt immer von hinten - er hat die Festung eingeholt.
  const y = type === "barke" ? BARKE_LANE.y : KOLOSS_LANE.y;
  addEnemy(w, type, s.fort.x - BEHIND - 80, s.fort.y + y, 0.5 + hpFactor * 0.5);
  w.emit({ kind: "boss", type });
}

/** Neuer Gegner mit dem passenden ersten Ziel fuer seine Art. */
export function addEnemy(
  w: World,
  type: EnemyType,
  x: number,
  y: number,
  hpFactor: number,
): EnemyState {
  const spec = ENEMIES[type];
  const f = w.state.fort;
  const hp = Math.round(spec.hp * hpFactor);
  const e: EnemyState = {
    id: w.state.nextId++,
    type,
    x,
    y,
    z: 0,
    layer: "ground",
    mode: "approach",
    timer: 0,
    hp,
    hpMax: hp,
    speed: spec.speed * (0.9 + w.rng() * 0.2),
    facing: x > f.x + DECK_W / 2 ? -1 : 1,
    slotX: 0,
    slotY: 0,
    tx: 0,
    ty: 0,
    attacking: false,
    attackCd: 0.5,
    cd2: 0,
    shield: 0,
    pushX: 0,
    pushY: 0,
  };
  switch (type) {
    case "laeufer":
    case "phalanx": {
      const slot = pickNear(w, ATTACK_SLOTS, x, y, 4);
      e.slotX = slot.x + (w.rng() - 0.5) * 12;
      e.slotY = slot.y + (w.rng() - 0.5) * 10;
      break;
    }
    case "enterer":
      chooseClimbPoint(w, e);
      break;
    case "skarabaeus":
      e.layer = "air";
      e.mode = "fly";
      e.z = 30;
      e.slotX = DECK_WALK.x0 + 10 + w.rng() * (DECK_WALK.x1 - DECK_WALK.x0 - 20);
      e.slotY = DECK_WALK.y0 + 10 + w.rng() * (DECK_WALK.y1 - DECK_WALK.y0 - 20);
      break;
    case "priester":
      e.mode = "standoff";
      setStandoff(w, e, 200);
      break;
    case "streitwagen":
      e.mode = "charge";
      chooseFoot(w, e);
      break;
    case "ballista":
      e.mode = "standoff";
      e.attackCd = 2.5;
      setStandoff(w, e, 270);
      break;
    case "turm": {
      const dock = x < f.x + DECK_W / 2 ? DOCKS[0] : DOCKS[1];
      e.slotX = dock.x;
      e.slotY = dock.y;
      e.tx = dock.deckX;
      e.ty = dock.deckY;
      break;
    }
    case "koloss":
    case "glaskoloss":
      e.mode = "walk";
      e.slotX = KOLOSS_LANE.x;
      e.slotY = KOLOSS_LANE.y;
      e.attackCd = 5;
      break;
    case "barke":
      // Schwebt vor dem Bug her - das Totenschiff weist der Festung den Weg.
      e.layer = "air";
      e.mode = "walk";
      e.z = BARKE_HEIGHT;
      e.slotX = BARKE_LANE.x;
      e.slotY = BARKE_LANE.y;
      e.attackCd = 4;
      e.cd2 = 6;
      break;
  }
  w.state.enemies.push(e);
  return e;
}

/** Zufaellig einer der `count` Punkte, die (x, y) am naechsten liegen. */
function pickNear<T extends { x: number; y: number }>(
  w: World,
  points: readonly T[],
  x: number,
  y: number,
  count: number,
): T {
  const f = w.state.fort;
  const near = [...points]
    .sort(
      (a, b) => Math.hypot(f.x + a.x - x, f.y + a.y - y) - Math.hypot(f.x + b.x - x, f.y + b.y - y),
    )
    .slice(0, count);
  return near[Math.floor(w.rng() * near.length)] ?? points[0]!;
}

function chooseClimbPoint(w: World, e: EnemyState): void {
  const open = CLIMB_POINTS.filter((point) => climbOpen(w.state.modules, point));
  if (open.length === 0) {
    // Ueberall Platten: dann hackt er eben unten am Bauch.
    e.mode = "approach";
    const slot = pickNear(w, ATTACK_SLOTS, e.x, e.y, 4);
    e.slotX = slot.x;
    e.slotY = slot.y;
    e.tx = -1;
    return;
  }
  const point = pickNear(w, open, e.x, e.y, 3);
  e.slotX = point.x;
  e.slotY = point.y;
  e.tx = point.deckX;
  e.ty = point.deckY;
}

function chooseFoot(w: World, e: EnemyState): void {
  const feet = LEGS.map((leg) => ({ x: leg.footX + STRIDE / 2, y: leg.footY + 4 }));
  const foot = pickNear(w, feet, e.x, e.y, 3);
  e.slotX = foot.x;
  e.slotY = foot.y;
}

/** Haltepunkt in `distance` Abstand zur Festungsmitte, auf der Seite, von der er kommt. */
function setStandoff(w: World, e: EnemyState, distance: number): void {
  const f = w.state.fort;
  const cx = DECK_W / 2;
  const cy = DECK_H / 2;
  const dx = e.x - (f.x + cx);
  const dy = e.y - (f.y + cy);
  const length = Math.hypot(dx, dy) || 1;
  e.slotX = cx + (dx / length) * distance;
  e.slotY = clamp(
    cy + (dy / length) * distance * 0.7,
    GROUND_TOP + 20 - f.y,
    GROUND_BOTTOM - 20 - f.y,
  );
}

// --- Handeln ----------------------------------------------------------------------------------------

export function updateEnemies(w: World, fortDx: number): void {
  const s = w.state;
  const f = s.fort;
  for (const e of s.enemies) {
    if (e.hp <= 0) {
      continue;
    }
    e.attackCd = Math.max(0, e.attackCd - TICK);
    e.cd2 = Math.max(0, e.cd2 - TICK);
    if (e.layer === "ground") {
      e.x += e.pushX * TICK;
      e.y += e.pushY * TICK;
    }
    e.pushX *= 0.88;
    e.pushY *= 0.88;
    switch (e.type) {
      case "laeufer":
      case "phalanx":
        hackAtFort(w, e, fortDx);
        break;
      case "enterer":
        updateEnterer(w, e, fortDx);
        break;
      case "skarabaeus":
        updateScarab(w, e, fortDx);
        break;
      case "priester":
        updatePriest(w, e, fortDx);
        break;
      case "streitwagen":
        updateChariot(w, e);
        break;
      case "ballista":
        updateBallista(w, e);
        break;
      case "turm":
        updateTower(w, e);
        break;
      case "koloss":
      case "glaskoloss":
      case "barke":
        updateBoss(w, e);
        break;
    }
  }
  separate(w);
  // Wer weit hinter der Festung haengen bleibt, gibt auf.
  const giveUp = f.x - BEHIND - 700;
  s.enemies = s.enemies.filter((e) => e.hp > 0 && e.x > giveUp);
  if (s.march.boss === "alive" && !s.enemies.some((e) => ENEMIES[e.type].boss)) {
    s.march.boss = "down";
  }
}

/** Schritt in Richtung Ziel; gibt die Entfernung vor dem Schritt zurueck. */
function moveToward(e: EnemyState, tx: number, ty: number, step: number): number {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 0.5) {
    const move = Math.min(distance, step);
    e.x += (dx / distance) * move;
    e.y += (dy / distance) * move;
    if (Math.abs(dx) > 1) {
      e.facing = dx >= 0 ? 1 : -1;
    }
  }
  return distance;
}

function nearestPlayer(
  w: World,
  x: number,
  y: number,
  range: number,
  layer: PlayerState["layer"],
): PlayerState | null {
  let best: PlayerState | null = null;
  let bestDistance = range;
  for (const p of w.state.players) {
    if (!p.alive || p.layer !== layer || p.transition) {
      continue;
    }
    const distance = Math.hypot(p.x - x, p.y - y);
    if (distance < bestDistance) {
      best = p;
      bestDistance = distance;
    }
  }
  return best;
}

/** Geht auf einen Mech am Boden in der Naehe los. `true`, wenn es einen gab. */
function chasePrey(w: World, e: EnemyState): boolean {
  const spec = ENEMIES[e.type];
  if (spec.aggro <= 0) {
    return false;
  }
  const prey = nearestPlayer(w, e.x, e.y, spec.aggro, "ground");
  if (!prey) {
    return false;
  }
  e.attacking = false;
  const distance = Math.hypot(prey.x - e.x, prey.y - e.y);
  if (distance > spec.radius + 10) {
    moveToward(e, prey.x, prey.y, e.speed * TICK);
  } else {
    e.facing = prey.x >= e.x ? 1 : -1;
    if (e.attackCd <= 0) {
      e.attackCd = spec.attackCooldown;
      hurtPlayer(w, prey, spec.touchDamage);
    }
  }
  return true;
}

/** Sandlaeufer und Phalanx: an einen Fuss oder unter den Bauch, dort auf den Rumpf einhacken. */
function hackAtFort(w: World, e: EnemyState, fortDx: number): void {
  if (chasePrey(w, e)) {
    return;
  }
  const f = w.state.fort;
  if (e.attacking) {
    e.x += fortDx;
  }
  const distance = moveToward(e, f.x + e.slotX, f.y + e.slotY, e.speed * TICK);
  if (!e.attacking && distance < 8) {
    e.attacking = true;
  } else if (e.attacking && distance > 24) {
    e.attacking = false;
  }
  if (e.attacking && e.attackCd <= 0) {
    const spec = ENEMIES[e.type];
    e.attackCd = spec.attackCooldown;
    damageHull(w, spec.hullDamage, e.x, e.y, e.type);
  }
}

function updateEnterer(w: World, e: EnemyState, fortDx: number): void {
  const f = w.state.fort;
  if (e.mode === "deck") {
    fightOnDeck(w, e, fortDx);
    return;
  }
  if (e.mode === "climb") {
    e.x += fortDx;
    e.timer -= TICK;
    e.z = ELEVATION * (1 - Math.max(0, e.timer) / ENEMY_CLIMB_TIME);
    if (e.timer <= 0) {
      landOnDeck(w, e, e.tx, e.ty);
    }
    return;
  }
  // Keine Kletterstelle frei: wie ein Sandlaeufer am Bauch.
  if (e.tx < 0) {
    hackAtFort(w, e, fortDx);
    return;
  }
  if (chasePrey(w, e)) {
    return;
  }
  const distance = moveToward(e, f.x + e.slotX, f.y + e.slotY, e.speed * TICK);
  if (distance < 6) {
    e.mode = "climb";
    e.layer = "climb";
    e.timer = ENEMY_CLIMB_TIME;
    e.pushX = 0;
    e.pushY = 0;
    w.emit({ kind: "enemyClimb", x: e.x, y: e.y });
  }
}

function landOnDeck(w: World, e: EnemyState, deckX: number, deckY: number): void {
  const f = w.state.fort;
  e.layer = "deck";
  e.mode = "deck";
  e.z = ELEVATION;
  e.x = f.x + clamp(deckX, DECK_WALK.x0, DECK_WALK.x1);
  e.y = f.y + clamp(deckY, DECK_WALK.y0, DECK_WALK.y1);
  e.attackCd = 0.6;
  e.pushX = 0;
  e.pushY = 0;
  w.emit({ kind: "land", x: e.x, y: e.y });
}

/**
 * Auf dem Deck: erst auf einen Mech in der Naehe, sonst zum naechsten heilen
 * Modul, sonst zum Sonnenherz - dort leidet der Rumpf.
 */
function fightOnDeck(w: World, e: EnemyState, fortDx: number): void {
  const f = w.state.fort;
  const spec = ENEMIES[e.type];
  e.x += fortDx;
  let tx = f.x + HEART.x;
  let ty = f.y + HEART.y;
  let reach = 30;
  let strike: () => void = () => damageHull(w, Math.max(2, spec.hullDamage), e.x, e.y, e.type);
  const mech = nearestPlayer(w, e.x, e.y, 80, "deck");
  if (mech) {
    tx = mech.x;
    ty = mech.y;
    reach = 14;
    strike = () => hurtPlayer(w, mech, spec.touchDamage);
  } else {
    let bestDistance = Infinity;
    for (const m of w.state.modules) {
      if (m.broken) {
        continue;
      }
      const c = moduleCenter(m);
      const distance = Math.hypot(f.x + c.x - e.x, f.y + c.y - e.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        tx = f.x + c.x;
        ty = f.y + c.y;
        reach = 20;
        strike = () => damageModule(w, m, spec.moduleDamage);
      }
    }
  }
  const distance = Math.hypot(tx - e.x, ty - e.y);
  if (distance > reach) {
    e.attacking = false;
    moveToward(e, tx, ty, e.speed * 0.8 * TICK);
  } else {
    e.attacking = true;
    e.facing = tx >= e.x ? 1 : -1;
    if (e.attackCd <= 0) {
      e.attackCd = spec.attackCooldown;
      strike();
    }
  }
  e.x = f.x + clamp(e.x - f.x, DECK_WALK.x0, DECK_WALK.x1);
  e.y = f.y + clamp(e.y - f.y, DECK_WALK.y0, DECK_WALK.y1);
}

/** Skarabaeus: fliegt hoch ueber das Deck und landet auf einem freien Fleck. */
function updateScarab(w: World, e: EnemyState, fortDx: number): void {
  if (e.mode === "deck") {
    fightOnDeck(w, e, fortDx);
    return;
  }
  const f = w.state.fort;
  const distance = moveToward(e, f.x + e.slotX, f.y + e.slotY, e.speed * TICK);
  // Steigt im Flug langsam auf Deckhoehe.
  e.z = Math.min(ELEVATION + 10, e.z + 22 * TICK);
  if (distance < 6 && e.z >= ELEVATION) {
    landOnDeck(w, e, e.slotX, e.slotY);
  }
}

/** Sandpriester: haelt Abstand, flieht vor Mechs und schuetzt alle in der Naehe. */
function updatePriest(w: World, e: EnemyState, fortDx: number): void {
  const f = w.state.fort;
  const spec = ENEMIES[e.type];
  const threat = nearestPlayer(w, e.x, e.y, 110, "ground");
  if (threat) {
    const dx = e.x - threat.x;
    const dy = e.y - threat.y;
    const length = Math.hypot(dx, dy) || 1;
    e.x += (dx / length) * e.speed * TICK;
    e.y = clamp(e.y + (dy / length) * e.speed * TICK, GROUND_TOP - 60, GROUND_BOTTOM + 30);
    e.facing = dx >= 0 ? 1 : -1;
  } else {
    moveToward(e, f.x + e.slotX, f.y + e.slotY, Math.max(e.speed, fortDx / TICK + 8) * TICK);
  }
  e.attacking = false;
  if (e.attackCd <= 0) {
    e.attackCd = spec.attackCooldown;
    const amount = Math.round(30 * (e.hpMax / spec.hp));
    for (const other of w.state.enemies) {
      if (
        other.hp > 0 &&
        other.layer !== "deck" &&
        Math.hypot(other.x - e.x, other.y - e.y) < 110
      ) {
        other.shield = Math.max(other.shield, amount);
      }
    }
    e.attacking = true;
    w.emit({ kind: "shield", x: e.x, y: e.y });
  }
}

/** Streitwagen: rammt einen Fuss, faehrt zurueck, rammt wieder. Ueberfaehrt Mechs am Boden. */
function updateChariot(w: World, e: EnemyState): void {
  const f = w.state.fort;
  const spec = ENEMIES[e.type];
  if (e.attackCd <= 0) {
    const victim = nearestPlayer(w, e.x, e.y, spec.radius + 10, "ground");
    if (victim) {
      e.attackCd = spec.attackCooldown;
      hurtPlayer(w, victim, spec.touchDamage);
    }
  }
  if (e.mode === "retreat") {
    e.timer -= TICK;
    // Nach dem Rammstoss steckt er kurz fest (steht still) - jetzt kann ihn der Fuss zertreten.
    if (e.timer < RETREAT_TIME) {
      moveToward(e, f.x + e.tx, f.y + e.ty, e.speed * 0.7 * TICK);
    }
    e.attacking = e.timer >= RETREAT_TIME;
    if (e.timer <= 0) {
      e.mode = "charge";
      chooseFoot(w, e);
    }
    return;
  }
  const distance = moveToward(e, f.x + e.slotX, f.y + e.slotY, e.speed * TICK);
  e.attacking = distance < 60;
  if (distance < 12) {
    damageHull(w, spec.hullDamage, e.x, e.y, e.type);
    f.slow = RAM_SLOW;
    w.emit({ kind: "ram", x: e.x, y: e.y });
    e.mode = "retreat";
    e.timer = RETREAT_TIME + STUCK_TIME;
    // Weg von der Festung, um Anlauf zu nehmen.
    const away = e.slotX < DECK_W / 2 ? -1 : 1;
    e.tx = e.slotX + away * 220;
    e.ty = clamp(e.slotY + (w.rng() - 0.5) * 160, GROUND_TOP - f.y, GROUND_BOTTOM - f.y);
  }
}

/** Ballista: haelt Abstand und schiesst Bolzen auf ein heiles Modul (oder den Rumpf). */
function updateBallista(w: World, e: EnemyState): void {
  const s = w.state;
  const f = s.fort;
  const spec = ENEMIES[e.type];
  const distance = moveToward(e, f.x + e.slotX, f.y + e.slotY, e.speed * TICK);
  e.attacking = e.attackCd < 1;
  if (e.attackCd > 0 || distance > 60) {
    return;
  }
  e.attackCd = spec.attackCooldown;
  const intact = s.modules.filter((m) => !m.broken);
  const module = intact.length > 0 ? intact[Math.floor(w.rng() * intact.length)]! : null;
  const target = module
    ? moduleCenter(module)
    : { x: DECK_W / 2 + (w.rng() - 0.5) * 120, y: DECK_H / 2 };
  const flight = Math.hypot(f.x + target.x - e.x, f.y + target.y - e.y) / 300;
  e.facing = f.x + target.x >= e.x ? 1 : -1;
  s.enemyShots.push({
    id: s.nextId++,
    x0: e.x,
    y0: e.y,
    z0: 26,
    x1: target.x,
    y1: target.y,
    t: 0,
    duration: Math.max(0.4, flight),
    damage: module ? spec.moduleDamage : spec.hullDamage,
    target: module ? module.uid : 0,
  });
  w.emit({ kind: "ballista", x: e.x, y: e.y });
}

/** Belagerungsturm: dockt an der Seite an und laesst Enterer ueber seine Bruecke aufs Deck. */
function updateTower(w: World, e: EnemyState): void {
  const s = w.state;
  const f = s.fort;
  const spec = ENEMIES[e.type];
  if (e.mode === "dock") {
    e.x = f.x + e.slotX;
    e.y = f.y + e.slotY;
    e.attacking = e.cd2 < 0.6;
    if (e.cd2 <= 0 && s.enemies.length < MAX_ENEMIES) {
      e.cd2 = spec.attackCooldown;
      const crew = addEnemy(w, "enterer", e.x, e.y, e.hpMax / spec.hp);
      crew.z = ELEVATION;
      landOnDeck(w, crew, e.tx, e.ty + (w.rng() - 0.5) * 30);
    }
    return;
  }
  const distance = moveToward(e, f.x + e.slotX, f.y + e.slotY, e.speed * TICK);
  if (distance < 6) {
    e.mode = "dock";
    e.cd2 = 1.2;
    e.facing = e.slotX < 0 ? 1 : -1;
    w.emit({ kind: "bridge", x: e.x, y: e.y });
  }
}

/**
 * Feld, auf das ein Endgegner gleich schlaegt (relativ zur Festung):
 * Koloss 2 x 2 Felder, Glaeserner Koloss 3 x 2, Sonnenbarke eine ganze Reihe.
 */
export function slamRect(e: EnemyState): { x0: number; y0: number; x1: number; y1: number } {
  if (e.type === "barke") {
    return { x0: 0, y0: e.ty - TILE_H / 2, x1: DECK_W, y1: e.ty + TILE_H / 2 };
  }
  const half = e.type === "glaskoloss" ? TILE_W * 1.5 : TILE_W;
  return { x0: e.tx - half, y0: e.ty - TILE_H, x1: e.tx + half, y1: e.ty + TILE_H };
}

/**
 * Endgegner: laufen (oder schweben) mit der Festung, zertreten Mechs am Boden
 * und schlagen aufs Deck - das Feld leuchtet vorher rot.
 *   Goldener Koloss: 2 x 2 Felder.
 *   Glaeserner Koloss: 3 x 2 Felder, ruft dabei zwei Phalanx-Wachen.
 *   Sonnenbarke: schwebt hinter der Festung, brennt eine ganze Reihe weg und
 *   wirft zwischendurch Skarabaeen ab.
 */
function updateBoss(w: World, e: EnemyState): void {
  const s = w.state;
  const f = s.fort;
  const spec = ENEMIES[e.type];
  const flying = e.type === "barke";
  const distance = moveToward(e, f.x + e.slotX, f.y + e.slotY, e.speed * TICK);
  if (flying) {
    e.z = BARKE_HEIGHT + Math.sin(s.time * 1.6) * 6;
    if (e.cd2 <= 0 && distance < 120) {
      // Skarabaeen abwerfen.
      e.cd2 = 10;
      for (let i = 0; i < 4 && s.enemies.length < MAX_ENEMIES; i += 1) {
        const bug = addEnemy(w, "skarabaeus", e.x + (i - 1.5) * 16, e.y, e.hpMax / spec.hp / 2);
        bug.z = e.z;
      }
    }
  } else if (e.cd2 <= 0) {
    const victim = nearestPlayer(w, e.x, e.y, 70, "ground");
    if (victim) {
      e.cd2 = 1.6;
      hurtPlayer(w, victim, spec.touchDamage);
      w.emit({ kind: "stomp", x: victim.x, y: victim.y });
    }
  }
  if (e.mode === "slam") {
    e.timer -= TICK;
    e.attacking = true;
    if (e.timer > 0) {
      return;
    }
    slam(w, e);
    e.mode = "walk";
    e.attacking = false;
    e.attackCd = spec.attackCooldown;
    return;
  }
  if (e.attackCd <= 0 && distance < 120) {
    if (flying) {
      const row = Math.floor(w.rng() * DECK_ROWS);
      e.tx = DECK_W / 2;
      e.ty = (row + 0.5) * TILE_H;
    } else if (e.type === "glaskoloss") {
      const col = Math.floor(w.rng() * (DECK_COLS - 2));
      const row = Math.floor(w.rng() * (DECK_ROWS - 1));
      e.tx = (col + 1.5) * TILE_W;
      e.ty = (row + 1) * TILE_H;
    } else {
      const col = Math.floor(w.rng() * (DECK_COLS - 1));
      const row = Math.floor(w.rng() * (DECK_ROWS - 1));
      e.tx = (col + 1) * TILE_W;
      e.ty = (row + 1) * TILE_H;
    }
    e.mode = "slam";
    e.timer = SLAM_WARNING + (flying ? 0.3 : 0);
    w.emit({ kind: "slamWarn", x: f.x + e.tx, y: f.y + e.ty });
  }
}

/** Der Schlag trifft Module, Mechs und Gegner im Feld und den Rumpf. */
function slam(w: World, e: EnemyState): void {
  const s = w.state;
  const f = s.fort;
  const spec = ENEMIES[e.type];
  const area = slamRect(e);
  for (const m of s.modules) {
    const r = moduleRect(m);
    if (r.x0 < area.x1 && r.x1 > area.x0 && r.y0 < area.y1 && r.y1 > area.y0) {
      damageModule(w, m, spec.moduleDamage);
    }
  }
  for (const p of s.players) {
    const lx = p.x - f.x;
    const ly = p.y - f.y;
    if (p.layer === "deck" && lx >= area.x0 && lx <= area.x1 && ly >= area.y0 && ly <= area.y1) {
      hurtPlayer(w, p, 30);
    }
  }
  damageHull(w, spec.hullDamage, f.x + e.tx, f.y + e.ty, e.type);
  w.emit({ kind: "slam", x: f.x + e.tx, y: f.y + e.ty });
  if (e.type === "glaskoloss") {
    // Zwei Wachen aus Glas springen ihm zur Seite.
    for (let i = 0; i < 2 && s.enemies.length < MAX_ENEMIES; i += 1) {
      addEnemy(w, "phalanx", e.x + (i === 0 ? -40 : 40), e.y - 20, e.hpMax / spec.hp / 3);
    }
  }
}

/** Nicht alle auf einem Haufen: Gegner derselben Ebene sanft auseinanderschieben. */
function separate(w: World): void {
  const list = w.state.enemies;
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i]!;
    if (a.layer === "climb" || a.layer === "air") {
      continue;
    }
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j]!;
      if (b.layer !== a.layer) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minimum = Math.max(16, (ENEMIES[a.type].radius + ENEMIES[b.type].radius) * 0.9);
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < minimum * minimum) {
        const d = Math.sqrt(d2);
        const push = (minimum - d) * 0.25;
        // Schwere Brocken weichen nicht.
        const aFixed = a.type === "turm" || ENEMIES[a.type].boss === true || a.mode === "dock";
        const bFixed = b.type === "turm" || ENEMIES[b.type].boss === true || b.mode === "dock";
        if (!aFixed) {
          a.x -= (dx / d) * push * (bFixed ? 2 : 1);
          a.y -= (dy / d) * push * (bFixed ? 2 : 1);
        }
        if (!bFixed) {
          b.x += (dx / d) * push * (aFixed ? 2 : 1);
          b.y += (dy / d) * push * (aFixed ? 2 : 1);
        }
      }
    }
  }
}
