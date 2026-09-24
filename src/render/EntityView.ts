/**
 * Figuren, Gegner und Geschosse als 3D-Meshes (3D-Umbau).
 *
 * ================================================================
 * EINE EINBAHNSTRASSE: SIMULATION -> MESH
 * ================================================================
 *
 * Diese Klasse LIEST den Weltzustand und setzt danach die Meshes. Sie
 * schreibt nie zurueck. Positionen, Leben, wer am Boden liegt - das alles
 * entscheidet die Simulation (`systems/`), die weiterhin flach in Pixeln
 * rechnet und von Three.js nichts weiss. Deshalb laeuft der Koop unveraendert:
 * Der Host rechnet, der Client zeigt an, was im Zustandspaket steht.
 *
 * Gelesen wird ueber `WorldView`, nicht direkt aus `state`: Dort stecken
 * Interpolation (weich zwischen zwei Ticks) und die Vorhersage der eigenen
 * Figur im Koop. Die 2D-Darstellung macht es genauso.
 *
 * ================================================================
 * ANLEGEN UND AUFRAEUMEN
 * ================================================================
 *
 * Spieler und Gegner haben feste IDs. Taucht eine neue ID auf, entsteht ein
 * Mesh; verschwindet sie aus dem Zustand, wird es entfernt. Genau das hatte
 * die 2D-Darstellung bei Spielern einmal vergessen - uebrig blieb eine
 * eingefrorene, halbdurchsichtige "Geisterfigur" (Etappe 2).
 *
 * Geschosse liegen in der Simulation in einem festen Pool und werden wieder-
 * verwendet. Hier genauso: ein Mesh je Pool-Platz, sichtbar solange aktiv.
 */

import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  SphereGeometry,
} from "three";
import type { Scene } from "three";
import { COLORS } from "../config/constants";
import type { WorldView } from "../net/GameSession";
import type { EnemyType } from "../systems/types";
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

interface PlayerMesh {
  group: Group;
  body: Mesh;
  material: MeshToonMaterial;
}

export class EntityView {
  private readonly root = new Group();

  private readonly capsule = new CapsuleGeometry(
    PLAYER_SHAPE.radius,
    PLAYER_SHAPE.height - 2 * PLAYER_SHAPE.radius,
    6,
    14,
  );
  /** Die "Nase": zeigt die Blickrichtung. Ohne sie ist eine Kapsel rund. */
  private readonly nose = new BoxGeometry(0.2, 0.2, 0.4);
  private readonly noseMaterial = new MeshToonMaterial({ color: 0x1b2230 });
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly sphere = new SphereGeometry(1, 10, 8);

  private readonly enemyMaterials: Record<EnemyType, MeshToonMaterial>;
  private readonly bulletMaterials = {
    player: new MeshBasicMaterial({ color: COLORS.playerBullet }),
    enemy: new MeshBasicMaterial({ color: COLORS.enemyBullet }),
  };

  private readonly players = new Map<string, PlayerMesh>();
  private readonly enemies = new Map<number, Mesh>();
  private readonly projectiles: Mesh[] = [];

  /** Wiederverwendete Menge fuer "wer ist noch da?" - kein Muell je Bild. */
  private readonly seen = new Set<string | number>();

  constructor(scene: Scene) {
    this.enemyMaterials = {
      runner: new MeshToonMaterial({ color: ENEMY_COLORS.runner }),
      brute: new MeshToonMaterial({ color: ENEMY_COLORS.brute }),
      shooter: new MeshToonMaterial({ color: ENEMY_COLORS.shooter }),
      boss: new MeshToonMaterial({ color: ENEMY_COLORS.boss }),
    };
    scene.add(this.root);
  }

  /** Ein Bild: alle Meshes an den aktuellen Zustand angleichen. */
  sync(view: WorldView): void {
    this.syncPlayers(view);
    this.syncEnemies(view);
    this.syncProjectiles(view);
  }

  private syncPlayers(view: WorldView): void {
    this.seen.clear();
    for (const player of view.state.players) {
      this.seen.add(player.id);
      const mesh = this.players.get(player.id) ?? this.createPlayer(player.id);

      toThree(view.renderPlayerPosition(player.id), 0, mesh.group.position);

      /*
       * Blickrichtung: Die Nase sitzt am Mesh auf +z. Eine Drehung um die
       * Hochachse um atan2(x, z) bringt +z genau auf (facing.x, facing.y) -
       * Sim-y ist Three-z (siehe `space3d.ts`).
       */
      mesh.group.rotation.y = Math.atan2(player.facing.x, player.facing.y);

      // Am Boden: flach gelegt und grau. Die Figur bleibt sichtbar, damit das
      // Team weiss, wohin es zum Wiederbeleben muss.
      mesh.group.rotation.x = player.down ? -Math.PI / 2 : 0;
      mesh.material.color.setHex(player.down ? DOWN_COLOR : CHARACTER_COLORS[player.character]);
    }

    for (const [id, mesh] of this.players) {
      if (!this.seen.has(id)) {
        this.root.remove(mesh.group);
        mesh.material.dispose();
        this.players.delete(id);
      }
    }
  }

  private createPlayer(id: string): PlayerMesh {
    const material = new MeshToonMaterial({ color: 0xffffff });
    const body = new Mesh(this.capsule, material);
    // Kapsel steht mit dem Fuss auf dem Boden, nicht mit der Mitte.
    body.position.y = PLAYER_SHAPE.height / 2;

    const nose = new Mesh(this.nose, this.noseMaterial);
    nose.position.set(0, PLAYER_SHAPE.height * 0.68, PLAYER_SHAPE.radius + 0.12);

    const group = new Group();
    group.add(body, nose);
    this.root.add(group);

    const mesh = { group, body, material };
    this.players.set(id, mesh);
    return mesh;
  }

  private syncEnemies(view: WorldView): void {
    this.seen.clear();
    for (const enemy of view.state.enemies) {
      this.seen.add(enemy.id);
      let mesh = this.enemies.get(enemy.id);
      if (!mesh) {
        mesh = new Mesh(this.box, this.enemyMaterials[enemy.type]);
        const diameter = meters(enemy.radius * 2);
        const height = enemyHeight(diameter);
        mesh.scale.set(diameter, height, diameter);
        this.root.add(mesh);
        this.enemies.set(enemy.id, mesh);
      }
      toThree(view.renderEnemyPosition(enemy.id, enemy.position), mesh.scale.y / 2, mesh.position);
    }

    for (const [id, mesh] of this.enemies) {
      if (!this.seen.has(id)) {
        this.root.remove(mesh);
        this.enemies.delete(id);
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
      // 26 m Abstand kaum ein Bildpunkt.
      mesh.scale.setScalar(Math.max(0.12, meters(projectile.radius) * 1.4));
      toThree(
        view.renderProjectilePosition(projectile.position, projectile.velocity),
        PROJECTILE_HEIGHT,
        mesh.position,
      );
    });
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const mesh of this.players.values()) {
      mesh.material.dispose();
    }
    this.players.clear();
    this.enemies.clear();
    this.projectiles.length = 0;
    this.capsule.dispose();
    this.nose.dispose();
    this.box.dispose();
    this.sphere.dispose();
    this.noseMaterial.dispose();
    for (const material of Object.values(this.enemyMaterials)) {
      material.dispose();
    }
    this.bulletMaterials.player.dispose();
    this.bulletMaterials.enemy.dispose();
  }
}
