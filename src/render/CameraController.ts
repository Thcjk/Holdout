/**
 * Eine gemeinsame Kamera fuer alle lebenden Spieler.
 *
 * Sie folgt dem Mittelpunkt der Gruppe und zoomt so weit heraus, dass alle ins
 * Bild passen - aber nicht weiter als `CAMERA.minZoom`, sonst ruinieren sich
 * verstreute Spieler gegenseitig die Sicht. Wer trotzdem aus dem Bild laeuft,
 * bekommt einen Richtungspfeil am Bildschirmrand.
 */

import Phaser from "phaser";
import { CAMERA, COLORS, DEPTH, VIEWPORT } from "../config/constants";
import type { Vec2 } from "../systems/types";

export interface TrackedPlayer {
  position: Vec2;
  isSelf: boolean;
  down: boolean;
}

export class CameraController {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly arrows: Phaser.GameObjects.Graphics;
  private currentZoom: number = CAMERA.maxZoom;
  private readonly focus: Vec2 = { x: 0, y: 0 };
  private initialized = false;

  constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number) {
    this.camera = scene.cameras.main;
    this.camera.setBounds(0, 0, worldWidth, worldHeight);
    this.camera.setBackgroundColor(COLORS.background);

    this.arrows = scene.add.graphics();
    this.arrows.setScrollFactor(0);
    this.arrows.setDepth(DEPTH.hud - 1);
  }

  get zoom(): number {
    return this.currentZoom;
  }

  update(tracked: readonly TrackedPlayer[]): void {
    const relevant = tracked.filter((entry) => !entry.down);
    const framed = relevant.length > 0 ? relevant : tracked;
    if (framed.length === 0) {
      return;
    }

    const target = averagePosition(framed);
    const zoom = this.desiredZoom(framed);

    if (!this.initialized) {
      this.focus.x = target.x;
      this.focus.y = target.y;
      this.currentZoom = zoom;
      this.initialized = true;
    } else {
      // Weiches Nachziehen: Die Kamera springt nie, sie holt nur auf.
      this.focus.x += (target.x - this.focus.x) * CAMERA.followLerp;
      this.focus.y += (target.y - this.focus.y) * CAMERA.followLerp;
      this.currentZoom += (zoom - this.currentZoom) * CAMERA.zoomLerp;
    }

    this.camera.setZoom(this.currentZoom);
    this.camera.centerOn(this.focus.x, this.focus.y);

    this.drawOffscreenArrows(tracked);
  }

  destroy(): void {
    this.arrows.destroy();
  }

  /**
   * Der Zoom, bei dem die ganze Gruppe samt Rand ins Bild passt - begrenzt auf
   * den erlaubten Bereich.
   */
  private desiredZoom(tracked: readonly TrackedPlayer[]): number {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const entry of tracked) {
      minX = Math.min(minX, entry.position.x);
      minY = Math.min(minY, entry.position.y);
      maxX = Math.max(maxX, entry.position.x);
      maxY = Math.max(maxY, entry.position.y);
    }

    const width = maxX - minX + CAMERA.padding * 2;
    const height = maxY - minY + CAMERA.padding * 2;
    const zoom = Math.min(VIEWPORT.width / width, VIEWPORT.height / height);

    return Phaser.Math.Clamp(zoom, CAMERA.minZoom, CAMERA.maxZoom);
  }

  /** Pfeile am Bildschirmrand fuer Mitspieler, die ausserhalb des Bildes sind. */
  private drawOffscreenArrows(tracked: readonly TrackedPlayer[]): void {
    this.arrows.clear();

    const halfWidth = VIEWPORT.width / 2;
    const halfHeight = VIEWPORT.height / 2;
    const margin = 26;

    for (const entry of tracked) {
      if (entry.isSelf) {
        continue;
      }

      const dx = (entry.position.x - this.focus.x) * this.currentZoom;
      const dy = (entry.position.y - this.focus.y) * this.currentZoom;

      if (Math.abs(dx) < halfWidth - margin && Math.abs(dy) < halfHeight - margin) {
        continue;
      }

      const angle = Math.atan2(dy, dx);
      // Den Pfeil auf den Rand des sichtbaren Rechtecks setzen.
      const scale = Math.min(
        (halfWidth - margin) / Math.max(1e-3, Math.abs(dx)),
        (halfHeight - margin) / Math.max(1e-3, Math.abs(dy)),
      );
      const screenX = halfWidth + dx * scale;
      const screenY = halfHeight + dy * scale;

      this.arrows.fillStyle(entry.down ? COLORS.danger : COLORS.mate, 0.9);
      this.arrows.fillTriangle(
        screenX + Math.cos(angle) * 14,
        screenY + Math.sin(angle) * 14,
        screenX + Math.cos(angle + 2.5) * 12,
        screenY + Math.sin(angle + 2.5) * 12,
        screenX + Math.cos(angle - 2.5) * 12,
        screenY + Math.sin(angle - 2.5) * 12,
      );
    }
  }
}

function averagePosition(tracked: readonly TrackedPlayer[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const entry of tracked) {
    x += entry.position.x;
    y += entry.position.y;
  }
  return { x: x / tracked.length, y: y / tracked.length };
}
