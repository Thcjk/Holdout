/**
 * Figuren, Gegner und Geschosse als 3D-Objekte (3D-Umbau).
 *
 * ================================================================
 * EINE EINBAHNSTRASSE: SIMULATION -> DARSTELLUNG
 * ================================================================
 *
 * Diese Klasse LIEST den Weltzustand und setzt danach Modelle und
 * Animationen. Sie schreibt nie zurueck. Positionen, Leben, wer am Boden
 * liegt - das alles entscheidet die Simulation (`systems/`), die weiterhin
 * flach in Pixeln rechnet und von Three.js nichts weiss.
 *
 * Gelesen wird ueber `WorldView`, nicht direkt aus `state`: Dort stecken
 * Interpolation (weich zwischen zwei Ticks) und die Vorhersage der eigenen
 * Figur im Koop.
 *
 * ================================================================
 * MODELL, SOBALD GELADEN - VORHER PLATZHALTER
 * ================================================================
 *
 * Die GLB-Modelle laden im Hintergrund (`preloadGameModels`). Solange sie
 * nicht da sind, steht eine Kapsel bzw. ein Quader an ihrer Stelle - und
 * sobald sie da sind, wird getauscht. So startet ein Run nie mit Warten,
 * und eine fehlende Datei macht das Spiel nicht kaputt.
 *
 * ================================================================
 * WELCHE ANIMATION? ABGELESEN AN DER BEWEGUNG
 * ================================================================
 *
 * Laufen oder Stehen wird aus der DARGESTELLTEN Bewegung abgeleitet
 * (Positionsaenderung je Bild), nicht aus einem Feld der Simulation. Das
 * klappt beim Host und beim Koop-Client gleich - der Client bekommt keine
 * Geschwindigkeiten der Gegner, nur Positionen. Und das Abspieltempo folgt
 * dem echten Tempo: Ein Brocken, der langsamer wird, stapft langsamer.
 *
 * ================================================================
 * ANLEGEN UND AUFRAEUMEN
 * ================================================================
 *
 * Taucht eine neue ID auf, entsteht eine Figur; verschwindet sie aus dem
 * Zustand, wird sie abgebaut. Genau das hatte die 2D-Darstellung bei
 * Spielern einmal vergessen - uebrig blieb eine eingefrorene
 * "Geisterfigur" (Etappe 2).
 */

import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  SphereGeometry,
} from "three";
import type { Scene } from "three";
import { COLORS } from "../config/constants";
import { CHARACTER_LOOKS, ENEMY_LOOKS, FIGURE_HEIGHT_PER_DIAMETER } from "../config/models";
import type { FigureLook } from "../config/models";
import type { WorldView } from "../net/GameSession";
import type { EnemyType, Vec2 } from "../systems/types";
import { FigureModel } from "./FigureModel";
import {
  CHARACTER_COLORS,
  DOWN_COLOR,
  ENEMY_COLORS,
  PLAYER_SHAPE,
  enemyHeight,
} from "./placeholders";
import { meters, toThree } from "./space3d";

/** Geschosse fliegen auf Brusthoehe - sonst verschwaenden sie im Boden. */
const PROJECTILE_HEIGHT = 1;
/** Ab diesem Tempo (Pixel/s) laeuft eine Figur, darunter steht sie. */
const MOVING_SPEED = 25;
/** Wie schnell sich eine Figur zu ihrer neuen Blickrichtung dreht (je s). */
const TURN_RATE = 14;
/**
 * Bis zu so vielen Gegnern wird jedes Skelett in jedem Bild bewegt. Darueber
 * nur jedes zweite Bild, abwechselnd und mit der aufgelaufenen Zeit - die
 * Animation laeuft gleich schnell, nur mit halb so vielen Zwischenposen.
 * Skelette zu bewegen kostet Rechenzeit auf dem Hauptprozessor, nicht auf
 * der Grafikkarte; bei 40 Zombies ist es der groesste Einzelposten.
 */
const FULL_RATE_ENEMIES = 16;

/** Eine Figur in der Welt - Modell oder, solange es laedt, Platzhalter. */
interface FigureSlot {
  group: Group;
  placeholder: Group | Mesh;
  figure: FigureModel | null;
  look: FigureLook;
  height: number;
  /** Letzte dargestellte Position (Pixel) - daraus das Tempo. */
  last: Vec2 | null;
  /** Geglaettetes Tempo in Pixel/s. */
  speed: number;
  /** Aktuelle Drehung um die Hochachse. */
  yaw: number;
  /** Noch nicht an die Animation weitergegebene Zeit (gedrosselte Gegner). */
  pending: number;
  /** Restzeit der Schlag-Animation (Faust ohne Waffe), Sekunden. */
  punch: number;
}

/** So lange steht der Schlag-Clip, bevor die Bewegung wieder uebernimmt. */
const PUNCH_SECONDS = 0.4;

export class EntityView {
  private readonly root = new Group();

  private readonly capsule = new CapsuleGeometry(
    PLAYER_SHAPE.radius,
    PLAYER_SHAPE.height - 2 * PLAYER_SHAPE.radius,
    6,
    14,
  );
  private readonly nose = new BoxGeometry(0.2, 0.2, 0.4);
  private readonly noseMaterial = new MeshToonMaterial({ color: 0x1b2230 });
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly sphere = new SphereGeometry(1, 10, 8);
  /**
   * Weicher Schatten unter jeder Figur: eine dunkle, halb durchsichtige
   * Scheibe. Ohne sie scheinen Figuren ueber dem Boden zu schweben, weil
   * echte Schatten auf dem Handy zu teuer sind. ALLE Schatten sind eine
   * Instanzliste - ein Zeichenaufruf statt einem je Figur.
   */
  private readonly shadowGeometry = new CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  private readonly shadowMaterial = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  private readonly shadows = new InstancedMesh(this.shadowGeometry, this.shadowMaterial, 64);
  private readonly shadowMatrix = new Matrix4();

  private readonly enemyMaterials: Record<EnemyType, MeshToonMaterial>;
  private readonly bulletMaterials = {
    player: new MeshBasicMaterial({ color: COLORS.playerBullet }),
    enemy: new MeshBasicMaterial({ color: COLORS.enemyBullet }),
  };

  private readonly players = new Map<string, FigureSlot>();
  private readonly enemies = new Map<number, FigureSlot>();
  private readonly projectiles: Mesh[] = [];

  /** Wiederverwendete Menge fuer "wer ist noch da?" - kein Muell je Bild. */
  private readonly seen = new Set<string | number>();
  private frame = 0;

  constructor(scene: Scene) {
    this.enemyMaterials = {
      runner: new MeshToonMaterial({ color: ENEMY_COLORS.runner }),
      brute: new MeshToonMaterial({ color: ENEMY_COLORS.brute }),
      shooter: new MeshToonMaterial({ color: ENEMY_COLORS.shooter }),
      boss: new MeshToonMaterial({ color: ENEMY_COLORS.boss }),
    };
    this.shadows.count = 0;
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = 1;
    scene.add(this.root, this.shadows);
  }

  /** Wie viele animierte Figuren gerade stehen - fuer die Leistungsanzeige. */
  get figureCount(): number {
    return this.players.size + this.enemies.size;
  }

  /**
   * Ein Bild: alle Objekte an den aktuellen Zustand angleichen.
   *
   * @param seconds Zeit seit dem letzten Bild - fuer Animation und Drehung.
   */
  sync(view: WorldView, seconds: number): void {
    this.frame += 1;
    // Faustschlaege dieses Bildes: Die Figur holt aus (Clip "punch").
    for (const event of view.events) {
      if (event.type === "punch") {
        const slot = this.players.get(event.playerId);
        if (slot) slot.punch = PUNCH_SECONDS;
      }
    }
    this.syncPlayers(view, seconds);
    this.syncEnemies(view, seconds);
    this.syncProjectiles(view);
    this.syncShadows();
  }

  /** Ein Schatten je Figur, etwa so breit wie die Schultern. */
  private syncShadows(): void {
    let index = 0;
    for (const slots of [this.players, this.enemies] as Array<Map<unknown, FigureSlot>>) {
      for (const slot of slots.values()) {
        if (index >= this.shadows.instanceMatrix.count) break;
        const size = slot.height * 0.26;
        this.shadowMatrix.makeScale(size, 1, size);
        this.shadowMatrix.setPosition(slot.group.position.x, 0.03, slot.group.position.z);
        this.shadows.setMatrixAt(index, this.shadowMatrix);
        index += 1;
      }
    }
    this.shadows.count = index;
    this.shadows.instanceMatrix.needsUpdate = true;
  }

  private syncPlayers(view: WorldView, seconds: number): void {
    this.seen.clear();
    for (const player of view.state.players) {
      this.seen.add(player.id);
      let slot = this.players.get(player.id);
      if (!slot) {
        slot = this.createSlot(
          CHARACTER_LOOKS[player.character],
          PLAYER_SHAPE.height,
          this.createCapsule(),
        );
        this.players.set(player.id, slot);
      }

      const position = view.renderPlayerPosition(player.id);
      this.move(slot, position, seconds);
      // Spieler schauen in ihre Blickrichtung (Zielen), nicht in die
      // Laufrichtung - wer rueckwaerts schiessend flieht, dreht sich nicht um.
      this.turn(slot, player.facing, seconds);

      if (slot.figure) {
        if (player.down) {
          slot.figure.play("death", 1, true);
        } else if (slot.punch > 0) {
          slot.punch -= seconds;
          slot.figure.play("punch", 1.6);
        } else {
          this.playMovement(slot);
        }
        slot.figure.update(seconds);
      } else {
        // Platzhalter: flach gelegt und grau, wenn am Boden.
        const capsule = slot.placeholder as Group;
        capsule.rotation.x = player.down ? -Math.PI / 2 : 0;
        const body = capsule.children[0] as Mesh;
        (body.material as MeshToonMaterial).color.setHex(
          player.down ? DOWN_COLOR : CHARACTER_COLORS[player.character],
        );
      }
    }
    this.prune(this.players);
  }

  private syncEnemies(view: WorldView, seconds: number): void {
    this.seen.clear();
    for (const enemy of view.state.enemies) {
      this.seen.add(enemy.id);
      let slot = this.enemies.get(enemy.id);
      if (!slot) {
        const diameter = meters(enemy.radius * 2);
        const box = new Mesh(this.box, this.enemyMaterials[enemy.type]);
        const boxHeight = enemyHeight(diameter);
        box.scale.set(diameter, boxHeight, diameter);
        box.position.y = boxHeight / 2;
        slot = this.createSlot(
          ENEMY_LOOKS[enemy.type],
          diameter * FIGURE_HEIGHT_PER_DIAMETER,
          box,
        );
        this.enemies.set(enemy.id, slot);
      }

      const position = view.renderEnemyPosition(enemy.id, enemy.position);
      const step = this.move(slot, position, seconds);
      // Gegner schauen dorthin, wohin sie laufen.
      if (step) {
        this.turn(slot, step, seconds);
      }

      if (slot.figure) {
        if (enemy.stunned > 0) {
          slot.figure.play("idle", 0.4);
        } else if (enemy.type === "shooter" && slot.speed < MOVING_SPEED) {
          // Ein stehender Schuetze legt an - dafuer steht er ja.
          slot.figure.play("shoot");
        } else {
          this.playMovement(slot);
        }
        slot.pending += seconds;
        const throttled = view.state.enemies.length > FULL_RATE_ENEMIES;
        if (!throttled || (enemy.id + this.frame) % 2 === 0) {
          slot.figure.update(slot.pending);
          slot.pending = 0;
        }
      }
    }
    this.prune(this.enemies);
  }

  private createSlot(look: FigureLook, height: number, placeholder: Group | Mesh): FigureSlot {
    const group = new Group();
    group.add(placeholder);
    this.root.add(group);
    return {
      group,
      placeholder,
      figure: null,
      look,
      height,
      last: null,
      speed: 0,
      yaw: 0,
      pending: 0,
      punch: 0,
    };
  }

  private createCapsule(): Group {
    const body = new Mesh(this.capsule, new MeshToonMaterial({ color: 0xffffff }));
    body.position.y = PLAYER_SHAPE.height / 2;
    const nose = new Mesh(this.nose, this.noseMaterial);
    nose.position.set(0, PLAYER_SHAPE.height * 0.68, PLAYER_SHAPE.radius + 0.12);
    const capsule = new Group();
    capsule.add(body, nose);
    return capsule;
  }

  /**
   * Position setzen, Tempo messen - und das Modell einsetzen, sobald es
   * geladen ist.
   *
   * @returns die Bewegung seit dem letzten Bild (Pixel), oder null.
   */
  private move(slot: FigureSlot, position: Vec2, seconds: number): Vec2 | null {
    if (!slot.figure) {
      const figure = FigureModel.create(slot.look, slot.height);
      if (figure) {
        slot.group.remove(slot.placeholder);
        disposePlaceholder(slot.placeholder);
        slot.group.add(figure.root);
        slot.figure = figure;
      }
    }

    toThree(position, 0, slot.group.position);

    let step: Vec2 | null = null;
    if (slot.last && seconds > 0) {
      step = { x: position.x - slot.last.x, y: position.y - slot.last.y };
      const speed = Math.hypot(step.x, step.y) / seconds;
      // Glaetten: Ein einzelnes Bild mit Ruckler soll die Animation nicht
      // zwischen Stehen und Laufen flackern lassen.
      slot.speed += (speed - slot.speed) * Math.min(1, seconds * 10);
      if (Math.hypot(step.x, step.y) < 0.5) {
        step = null;
      }
    }
    slot.last = { x: position.x, y: position.y };
    return step;
  }

  /**
   * Zur Richtung drehen, mit begrenzter Drehgeschwindigkeit.
   *
   * Das Modell schaut in seiner Ruhelage nach +z. Eine Drehung um die
   * Hochachse um atan2(x, z) bringt +z auf die gewuenschte Richtung - Sim-y
   * ist Three-z (siehe `space3d.ts`).
   */
  private turn(slot: FigureSlot, direction: Vec2, seconds: number): void {
    if (Math.hypot(direction.x, direction.y) < 1e-6) {
      return;
    }
    const target = Math.atan2(direction.x, direction.y);
    let delta = target - slot.yaw;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    slot.yaw += delta * Math.min(1, seconds * TURN_RATE);
    slot.group.rotation.y = slot.yaw;
  }

  /** Laufen oder Stehen, mit Abspieltempo passend zur Geschwindigkeit. */
  private playMovement(slot: FigureSlot): void {
    const figure = slot.figure;
    if (!figure) {
      return;
    }
    if (slot.speed > MOVING_SPEED) {
      const rate = Math.min(1.8, Math.max(0.5, slot.speed / slot.look.moveClipSpeed));
      figure.play(slot.look.moveClip, rate);
    } else {
      figure.play("idle");
    }
  }

  private prune<K>(slots: Map<K, FigureSlot>): void {
    for (const [id, slot] of slots) {
      if (!this.seen.has(id as string | number)) {
        slot.figure?.dispose();
        disposePlaceholder(slot.placeholder);
        slot.group.removeFromParent();
        slots.delete(id);
      }
    }
  }

  private syncProjectiles(view: WorldView): void {
    const pool = view.state.projectiles;
    while (this.projectiles.length < pool.length) {
      const mesh = new Mesh(this.sphere, this.bulletMaterials.player);
      mesh.visible = false;
      this.root.add(mesh);
      this.projectiles.push(mesh);
    }

    pool.forEach((projectile, index) => {
      const mesh = this.projectiles[index] as Mesh;
      mesh.visible = projectile.active;
      if (!projectile.active) {
        return;
      }
      mesh.material = this.bulletMaterials[projectile.owner];
      // Etwas groesser als der Trefferradius: Ein 7-px-Geschoss waere auf
      // 30 m Abstand kaum ein Bildpunkt.
      mesh.scale.setScalar(Math.max(0.12, meters(projectile.radius) * 1.4));
      toThree(
        view.renderProjectilePosition(projectile.position, projectile.velocity),
        PROJECTILE_HEIGHT,
        mesh.position,
      );
    });
  }

  dispose(): void {
    for (const slots of [this.players, this.enemies] as Array<Map<unknown, FigureSlot>>) {
      for (const slot of slots.values()) {
        slot.figure?.dispose();
        disposePlaceholder(slot.placeholder);
      }
      slots.clear();
    }
    this.root.removeFromParent();
    this.projectiles.length = 0;
    this.capsule.dispose();
    this.nose.dispose();
    this.box.dispose();
    this.sphere.dispose();
    this.shadows.removeFromParent();
    this.shadows.dispose();
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
    this.noseMaterial.dispose();
    for (const material of Object.values(this.enemyMaterials)) {
      material.dispose();
    }
    this.bulletMaterials.player.dispose();
    this.bulletMaterials.enemy.dispose();
  }
}

/**
 * Nur das eigene Material der Kapsel freigeben - Geometrien und die
 * Gegner-Materialien sind geteilt und gehoeren der EntityView.
 */
function disposePlaceholder(placeholder: Group | Mesh): void {
  if (placeholder instanceof Group) {
    const body = placeholder.children[0] as Mesh | undefined;
    (body?.material as MeshToonMaterial | undefined)?.dispose();
  }
}
