/**
 * Die Angriffe des Bosses.
 *
 * Eigene Datei, damit `enemies.ts` nicht weiter waechst: Dort steht die
 * Bewegung aller Gegner, hier nur, was der Boss zusaetzlich kann. Die BEWEGUNG
 * des Bosses ist bewusst dieselbe simple KI wie bei allen anderen - direkter
 * Vektor plus Ausweichen, kein Pathfinding (Briefing, Abschnitt 4). Neu sind
 * ausschliesslich die Angriffsmuster.
 *
 * ================================================================
 * ZWEI MUSTER, DIE SICH GEGENSEITIG DIE LUECKE SCHLIESSEN
 * ================================================================
 *
 *   SCHOCKWELLE  Flaechenschaden rundherum, wenn jemand nah ist.
 *   SALVE        Faecher aus Geschossen, wenn alle weiter weg sind.
 *
 * Mit nur einem der beiden haette der Boss einen toten Winkel: Bei blosser
 * Flaeche bliebe man auf Abstand und er waere harmlos; bei blosser Salve kaeme
 * der Tank mit seinen 250 Pixeln Reichweite nie heran. Zusammen gibt es keine
 * Stelle, an der man sicher steht.
 *
 * ================================================================
 * DER VORWARNKREIS IST DER EIGENTLICHE INHALT DER SCHOCKWELLE
 * ================================================================
 *
 * In `abilities.ts` steht die Leitregel "eine Faehigkeit muss binnen einer
 * Sekunde sichtbar sein". Beim Gegner gilt sie gespiegelt: Ein Treffer, den man
 * nicht kommen sieht, fuehlt sich nicht schwer an, sondern unfair - man lernt
 * nichts daraus und aendert sein Spiel nicht.
 *
 * Deshalb passiert die Schockwelle in zwei Schritten: erst ein Kreis auf dem
 * Boden, dann - 0,8 Sekunden spaeter - der Schaden, und zwar in genau diesem
 * Kreis. Nicht in einem groesseren; der angezeigte Radius IST der wirkende.
 * Alles andere waere eine Anzeige, die luegt.
 */

import { BOSS, PROJECTILE } from "../config/balance";
import { damagePlayer } from "./combat";
import { hasLineOfSight } from "./collision";
import { spawnProjectile } from "./projectiles";
import type { BossState, EnemyState, PlayerState, WorldState } from "./types";

/** Frischer Angriffszustand fuer einen neu erweckten Boss. */
export function createBossState(): BossState {
  return {
    // Beide Angriffe starten auf Abklingzeit: Wer den Encounter betritt, soll
    // eine Sekunde haben, um zu sehen, was da aufgewacht ist.
    slamCooldown: 1.5,
    slamWindup: 0,
    salvoCooldown: 1.5,
  };
}

/**
 * Ein Tick der Boss-Angriffe.
 *
 * Wird aus `stepEnemies` gerufen, nachdem sich der Boss bewegt hat - so liegt
 * der Warnkreis dort, wo er am Ende des Ticks wirklich steht.
 */
export function stepBoss(
  state: WorldState,
  enemy: EnemyState,
  target: PlayerState | null,
  dt: number,
): void {
  const boss = enemy.boss;
  if (!boss) {
    return;
  }

  boss.slamCooldown = Math.max(0, boss.slamCooldown - dt);
  boss.salvoCooldown = Math.max(0, boss.salvoCooldown - dt);

  /*
   * Betaeubt heisst betaeubt - auch fuer den Boss.
   *
   * Eine schon begonnene Schockwelle wird dabei ABGEBROCHEN, nicht nur
   * verzoegert: Der Warnkreis waere sonst weg, der Schaden kaeme trotzdem.
   * Genau das ist die Art von Treffer, gegen die der Kreis da ist.
   */
  if (enemy.stunned > 0) {
    boss.slamWindup = 0;
    return;
  }

  if (boss.slamWindup > 0) {
    boss.slamWindup = Math.max(0, boss.slamWindup - dt);
    if (boss.slamWindup === 0) {
      detonateSlam(state, enemy);
    }
    return;
  }

  if (!target) {
    return;
  }

  const distance = Math.hypot(
    target.position.x - enemy.position.x,
    target.position.y - enemy.position.y,
  );

  if (distance <= BOSS.slam.triggerRange && boss.slamCooldown === 0) {
    startSlam(state, enemy, boss);
    return;
  }

  if (boss.salvoCooldown === 0) {
    fireSalvo(state, enemy, boss, target, distance);
  }
}

/** Ausholen: Der Warnkreis geht an, der Schaden kommt spaeter. */
function startSlam(state: WorldState, enemy: EnemyState, boss: BossState): void {
  boss.slamWindup = BOSS.slam.windupSeconds;
  boss.slamCooldown = BOSS.slam.cooldown;

  state.events.push({
    type: "bossWindup",
    x: enemy.position.x,
    y: enemy.position.y,
    radius: BOSS.slam.radius,
    seconds: BOSS.slam.windupSeconds,
  });
}

/**
 * Die Schockwelle schlaegt ein.
 *
 * Der Rueckstoss ist kein Beiwerk: Ohne ihn steht man nach dem Treffer noch
 * genauso nah und bekommt die naechste Welle auch ab. Mit ihm ist ein Treffer
 * ein Fehler, aus dem man wieder herauskommt.
 */
function detonateSlam(state: WorldState, enemy: EnemyState): void {
  state.events.push({
    type: "blast",
    x: enemy.position.x,
    y: enemy.position.y,
    radius: BOSS.slam.radius,
  });

  const damage = Math.round(BOSS.slam.damage * enemy.damageMultiplier);

  for (const player of state.players) {
    if (player.down) {
      continue;
    }

    const dx = player.position.x - enemy.position.x;
    const dy = player.position.y - enemy.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance > BOSS.slam.radius) {
      continue;
    }

    /*
     * Rueckstoss VOR dem Schaden.
     *
     * `damagePlayer` setzt die Unverwundbarkeit und kann den Spieler zu Boden
     * gehen lassen. Wer danach noch schiebt, schiebt unter Umstaenden eine
     * Leiche durch die Gegend - und wer den Schaden zuerst nimmt und dabei
     * ueberlebt, soll trotzdem aus der Flaeche geraten.
     */
    const length = distance || 1;
    player.velocity.x += (dx / length) * BOSS.slam.knockback;
    player.velocity.y += (dy / length) * BOSS.slam.knockback;

    damagePlayer(state, player, damage);
  }
}

/**
 * Ein Faecher aus langsamen Geschossen.
 *
 * Langsam (300 px/s gegen 600 beim Spieler), weil man ihnen ausweichen koennen
 * soll. Ein Faecher statt eines einzelnen Schusses, damit blosses Seitwaerts-
 * laufen nicht reicht - man muss sich entscheiden, wohin.
 */
function fireSalvo(
  state: WorldState,
  enemy: EnemyState,
  boss: BossState,
  target: PlayerState,
  distance: number,
): void {
  // Durch Waende schiesst niemand. Ohne diese Zeile beschiesst der Boss einen
  // Spieler, der hinter einem Deckungsblock in Sicherheit steht.
  if (!hasLineOfSight(state.walls, enemy.position, target.position) || distance < 1e-6) {
    return;
  }

  boss.salvoCooldown = BOSS.salvo.cooldown;

  const baseAngle = Math.atan2(
    target.position.y - enemy.position.y,
    target.position.x - enemy.position.x,
  );
  const spread = (BOSS.salvo.spread * Math.PI) / 180;
  const damage = Math.round(BOSS.salvo.damage * enemy.damageMultiplier);
  // Als Zahl statt als Literal: Sonst haelt TypeScript die Absicherung unten
  // fuer toten Code, weil in der Konfiguration gerade 5 steht.
  const bullets: number = BOSS.salvo.bullets;

  for (let i = 0; i < bullets; i += 1) {
    // Von -spread/2 bis +spread/2 gleichmaessig verteilt. Bei einer einzelnen
    // Kugel waere der Nenner 0 - deshalb die Fallunterscheidung.
    const offset = bullets === 1 ? 0 : -spread / 2 + (spread * i) / (bullets - 1);
    const angle = baseAngle + offset;

    spawnProjectile(state, {
      owner: "enemy",
      ownerId: String(enemy.id),
      position: enemy.position,
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      speed: BOSS.salvo.speed,
      damage,
      range: 1200,
      radius: PROJECTILE.enemyRadius,
      piercing: false,
    });
  }

  state.events.push({
    type: "shot",
    x: enemy.position.x,
    y: enemy.position.y,
    dx: Math.cos(baseAngle),
    dy: Math.sin(baseAngle),
    owner: "enemy",
  });
}
