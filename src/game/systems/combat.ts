/**
 * Kampf: Schaden an Rumpf, Modulen, Mechs und Gegnern, Zielwahl, Geschosse,
 * Moerser-Granaten und Ballista-Bolzen.
 *
 * Wer wen treffen kann (Ebenen):
 *   - Von oben (Deck): Gegner am Boden ausser denen unter dem Deck, Kletterer,
 *     Flieger und Gegner auf dem Deck.
 *   - Vom Boden: alle am Boden (auch unter dem Deck), Kletterer, Flieger -
 *     aber nicht die auf dem Deck.
 */

import { DECK_H, ELEVATION, RESPAWN_TIME, TICK } from "../constants";
import { CREW } from "../data/crew";
import { ENEMIES } from "../data/enemies";
import { BLIND_SPOT, LEGS, STRIDE, insideRect } from "../fortress";
import type { EnemyState, EnemyType, ModuleState, PlayerState, ShotState } from "../types";
import type { World } from "../world";

/** Liegt der Bodenpunkt im toten Winkel unter dem Deck? */
export function underDeck(w: World, x: number, y: number): boolean {
  const f = w.state.fort;
  return insideRect(BLIND_SPOT, x - f.x, y - f.y);
}

/** Kann ein Schuetze auf dieser Ebene diesen Gegner treffen? */
export function canReach(w: World, fromDeck: boolean, e: EnemyState): boolean {
  switch (e.layer) {
    case "ground":
      return !fromDeck || !underDeck(w, e.x, e.y);
    case "deck":
      return fromDeck;
    default:
      return true;
  }
}

/** Schaden am Rumpf. `source` = welche Gegnerart (fuer Anzeige und Balance-Messung). */
export function damageHull(
  w: World,
  amount: number,
  x: number,
  y: number,
  source?: EnemyType,
): void {
  w.state.fort.hull = Math.max(0, w.state.fort.hull - amount);
  w.emit(source ? { kind: "hullHit", x, y, amount, source } : { kind: "hullHit", x, y, amount });
}

export function hurtPlayer(w: World, p: PlayerState, amount: number): void {
  if (!p.alive || p.transition) {
    return;
  }
  // Der Brecher steckt weniger ein.
  p.hp -= amount * (1 - (CREW[p.crew].armor ?? 0));
  w.emit({ kind: "playerHit", id: p.id });
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    p.respawn = RESPAWN_TIME;
    p.moving = false;
    w.emit({ kind: "playerDown", id: p.id });
  }
}

/** Ein Modul nimmt Schaden. Bei 0 Leben ist es kaputt und tut nichts mehr. */
export function damageModule(w: World, m: ModuleState, amount: number): void {
  if (m.broken) {
    return;
  }
  m.hp = Math.max(0, m.hp - amount);
  w.emit({ kind: "moduleHit", uid: m.uid });
  if (m.hp <= 0) {
    m.broken = true;
    w.emit({ kind: "moduleBroken", uid: m.uid });
    // Kaputte Platten und Motoren zaehlen nicht mehr mit.
    w.refreshFortress();
  }
}

export interface DamageOptions {
  /** Geht durch Schilde (Moerser, Oel, Blitz, Stampfen). */
  pierce?: boolean;
  /** Ohne Rueckstoss (Oel brennt leise). */
  quiet?: boolean;
}

/**
 * Ein Gegner nimmt Schaden. Der Schild des Sandpriesters faengt zuerst ab,
 * der Turmschild der Phalanx haelt Treffer von vorn fast ganz ab.
 */
export function damageEnemy(
  w: World,
  e: EnemyState,
  amount: number,
  fromX: number,
  fromY: number,
  owner: string | null,
  options: DamageOptions = {},
): void {
  if (e.hp <= 0) {
    return;
  }
  let damage = amount;
  if (!options.pierce) {
    if (e.type === "phalanx" && (fromX - e.x) * e.facing > 0) {
      damage *= 0.2;
    }
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, damage);
      e.shield -= absorbed;
      damage -= absorbed;
    }
  }
  e.hp -= damage;
  // Grosse Gegner lassen sich kaum schubsen.
  const heavy = e.type === "turm" || e.type === "koloss" || e.type === "ballista";
  if (!options.quiet && !heavy && e.layer !== "climb") {
    const dx = e.x - fromX;
    const dy = e.y - fromY;
    const distance = Math.hypot(dx, dy) || 1;
    e.pushX += (dx / distance) * 70;
    e.pushY += (dy / distance) * 70;
  }
  if (!options.quiet) {
    w.emit({ kind: "hit", id: e.id, x: e.x, y: e.y });
  }
  if (e.hp <= 0) {
    killEnemy(w, e, owner);
  }
}

export function killEnemy(w: World, e: EnemyState, owner: string | null): void {
  const s = w.state;
  e.hp = 0;
  s.kills += 1;
  const killer = owner ? s.players.find((p) => p.id === owner) : undefined;
  if (killer) {
    killer.kills += 1;
  }
  const spec = ENEMIES[e.type];
  // Schrott faellt zu Boden - auch von Deck und Rumpfwand.
  const pieces = e.type === "koloss" ? 8 : e.type === "turm" ? 4 : 1;
  for (let i = 0; i < pieces; i += 1) {
    const spread = pieces > 1 ? 30 : 0;
    s.scrap.push({
      id: s.nextId++,
      x: e.x + (w.rng() - 0.5) * spread,
      y:
        e.layer === "deck" ? s.fort.y + DECK_H + 18 + w.rng() * 10 : e.y + (w.rng() - 0.5) * spread,
      z: 0,
      value: Math.max(1, Math.round(spec.scrap / pieces)),
    });
  }
  w.emit({ kind: "kill", x: e.x, y: e.y - e.z, type: e.type });
  if (e.type === "koloss") {
    s.stats.bossKills += 1;
    w.emit({ kind: "bossDown", type: e.type });
  }
}

/** Naechster Gegner in Reichweite, den man von hier aus treffen kann. */
export function findTarget(
  w: World,
  x: number,
  y: number,
  range: number,
  fromDeck: boolean,
  minimum = 0,
): EnemyState | null {
  let best: EnemyState | null = null;
  let bestDistance = range;
  for (const e of w.state.enemies) {
    if (e.hp <= 0 || !canReach(w, fromDeck, e)) {
      continue;
    }
    const distance = Math.hypot(e.x - x, e.y - y) - ENEMIES[e.type].radius * 0.5;
    if (distance < bestDistance && distance >= minimum) {
      best = e;
      bestDistance = distance;
    }
  }
  return best;
}

/** Ein Geschoss von (x, y, z) auf einen Gegner abfeuern. */
export function fire(
  w: World,
  owner: string,
  x: number,
  y: number,
  z: number,
  target: EnemyState,
  speed: number,
  damage: number,
  look: ShotState["look"],
  pull = 0,
  extra: { splash?: number; pierce?: number } = {},
): void {
  const dx = target.x - x;
  const dy = target.y - y;
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;
  const flight = distance / speed;
  const targetZ = target.layer === "deck" ? ELEVATION + 14 : target.z + 14;
  w.state.shots.push({
    id: w.state.nextId++,
    owner,
    look,
    pull,
    x: x + ux * 12,
    y: y + uy * 4,
    z,
    vx: ux * speed,
    vy: uy * speed,
    vz: (targetZ - z) / flight,
    damage,
    life: flight + 0.3,
    splash: extra.splash ?? 0,
    pierce: extra.pierce ?? 0,
    hit: [],
  });
  w.emit({ kind: "shot", owner, x: x + ux * 12, y, z, look });
}

/** Harpune: reisst den Getroffenen zur Aufsetzstelle des naechsten Fusses. */
export function pullToFoot(w: World, e: EnemyState, strength: number): void {
  const f = w.state.fort;
  let best: { x: number; y: number } | null = null;
  let bestDistance = Infinity;
  for (const leg of LEGS) {
    const x = f.x + leg.footX + STRIDE / 2;
    const y = f.y + leg.footY;
    const distance = Math.hypot(x - e.x, y - e.y);
    if (distance < bestDistance) {
      best = { x, y };
      bestDistance = distance;
    }
  }
  if (best && bestDistance > 1) {
    e.pushX = ((best.x - e.x) / bestDistance) * strength;
    e.pushY = ((best.y - e.y) / bestDistance) * strength;
  }
}

export function updateShots(w: World): void {
  const s = w.state;
  for (const shot of s.shots) {
    shot.x += shot.vx * TICK;
    shot.y += shot.vy * TICK;
    shot.z += shot.vz * TICK;
    shot.life -= TICK;
    const fromDeck = shot.z > 40;
    for (const e of s.enemies) {
      if (e.hp <= 0 || shot.hit.includes(e.id) || !canReach(w, fromDeck, e)) {
        continue;
      }
      if (Math.hypot(e.x - shot.x, e.y - shot.y) < ENEMIES[e.type].radius + 5) {
        const fromX = shot.x - shot.vx * 0.05;
        const fromY = shot.y - shot.vy * 0.05;
        damageEnemy(w, e, shot.damage, fromX, fromY, shot.owner);
        if (shot.pull > 0 && e.hp > 0 && e.layer === "ground") {
          pullToFoot(w, e, shot.pull);
        }
        if (shot.splash > 0) {
          // Splitter: Nachbarn auf derselben Ebene bekommen die Haelfte ab.
          for (const other of s.enemies) {
            if (
              other !== e &&
              other.hp > 0 &&
              other.layer === e.layer &&
              Math.hypot(other.x - e.x, other.y - e.y) < shot.splash
            ) {
              damageEnemy(w, other, shot.damage / 2, e.x, e.y, shot.owner, { pierce: true });
            }
          }
          w.emit({ kind: "boom", x: e.x, y: e.y - e.z, radius: shot.splash });
        }
        shot.hit.push(e.id);
        if (shot.pierce > 0) {
          shot.pierce -= 1;
        } else {
          shot.life = 0;
          break;
        }
      }
    }
  }
  s.shots = s.shots.filter((shot) => shot.life > 0);
}

/** Moerser-Granaten: fliegen eine Sekunde, dann trifft die Explosion alles im Umkreis. */
export function updateShells(w: World): void {
  const s = w.state;
  for (const shell of s.shells) {
    shell.t += TICK;
    if (shell.t < shell.duration) {
      continue;
    }
    w.emit({ kind: "boom", x: shell.x1, y: shell.y1, radius: shell.radius });
    for (const e of s.enemies) {
      if (
        e.hp > 0 &&
        e.layer !== "deck" &&
        Math.hypot(e.x - shell.x1, e.y - shell.y1) < shell.radius
      ) {
        damageEnemy(w, e, shell.damage, shell.x1, shell.y1, null, { pierce: true });
      }
    }
  }
  s.shells = s.shells.filter((shell) => shell.t < shell.duration);
}

/** Bolzen der Ballista: treffen ihr Modul (oder den Rumpf, wenn es weg ist). */
export function updateEnemyShots(w: World): void {
  const s = w.state;
  const f = s.fort;
  for (const bolt of s.enemyShots) {
    bolt.t += TICK;
    if (bolt.t < bolt.duration) {
      continue;
    }
    const module = bolt.target ? s.modules.find((m) => m.uid === bolt.target) : undefined;
    if (module && !module.broken) {
      damageModule(w, module, bolt.damage);
    } else {
      // Ziel inzwischen kaputt: Der Bolzen steckt dann im Rumpf, aber schwaecher.
      damageHull(
        w,
        bolt.target ? Math.round(bolt.damage * 0.4) : bolt.damage,
        f.x + bolt.x1,
        f.y + bolt.y1,
        "ballista",
      );
    }
  }
  s.enemyShots = s.enemyShots.filter((bolt) => bolt.t < bolt.duration);
}
