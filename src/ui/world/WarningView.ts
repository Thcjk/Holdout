/**
 * Warnungen am Bildrand: Ein Trupp der goldenen Armee ist im Anmarsch. Ein roter
 * Pfeil zeigt, woher er kommt, darunter die Zahl der Gegner. Er blinkt schneller,
 * je naeher der Trupp ist.
 */

import type Phaser from "phaser";
import { SAFE, VIEWPORT } from "../../config/constants";
import type { EnemyType, GameState } from "../../game/types";
import { ARMY_SIZE } from "../pixel/armee";
import { TEX, armyKey } from "../pixel/textures";
import { FONT_TITLE, T } from "../theme";
import { DEPTH } from "./view";

interface Marker {
  arrow: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.Text;
  /** Kleines Bild der wichtigsten Gegnerart im Trupp. */
  icon: Phaser.GameObjects.Image;
}

/** Welche Art zeigt das Bild am Pfeil (die gefaehrlichste im Trupp)? */
const ICON_ORDER: readonly EnemyType[] = [
  "turm",
  "ballista",
  "streitwagen",
  "priester",
  "phalanx",
  "enterer",
  "skarabaeus",
  "laeufer",
];

export class WarningView {
  private readonly markers = new Map<number, Marker>();
  private time = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  sync(state: GameState, camera: Phaser.Cameras.Scene2D.Camera, deltaMs: number): void {
    this.time += deltaMs / 1000;
    const seen = new Set<number>();
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    for (const warning of state.warnings) {
      seen.add(warning.id);
      let marker = this.markers.get(warning.id);
      if (!marker) {
        marker = {
          arrow: this.scene.add
            .image(0, 0, TEX.warning)
            .setScrollFactor(0)
            .setDepth(DEPTH.hud - 1)
            .setScale(1.6),
          count: this.scene.add
            .text(0, 0, "", { fontFamily: FONT_TITLE, fontSize: "22px", color: "#ff7a6a" })
            .setOrigin(0.5)
            .setStroke(T.outline, 5)
            .setScrollFactor(0)
            .setDepth(DEPTH.hud - 1),
          icon: this.scene.add.image(0, 0, armyKey(pickIcon(warning.members))).setScrollFactor(0),
        };
        const type = pickIcon(warning.members);
        // Etwa 26 Pixel hoch, egal wie gross die Figur ist.
        marker.icon.setScale(Math.min(0.6, 26 / ARMY_SIZE[type][1])).setDepth(DEPTH.hud - 1);
        this.markers.set(warning.id, marker);
      }
      let x = 0;
      let y = 0;
      let rotation = 0;
      let tx = 0;
      let ty = 0;
      switch (warning.side) {
        case "hinten":
          x = SAFE.left + 16;
          y = clamp(warning.at - camera.scrollY, 100, h - 30);
          rotation = 0;
          tx = 30;
          break;
        case "vorn":
          x = w - SAFE.right - 16;
          y = clamp(warning.at - camera.scrollY, 100, h - 30);
          rotation = Math.PI;
          tx = -30;
          break;
        case "oben":
          x = clamp(state.fort.x + warning.at - camera.scrollX, 30, w - 30);
          y = 98;
          rotation = Math.PI / 2;
          ty = 26;
          break;
        case "unten":
          x = clamp(state.fort.x + warning.at - camera.scrollX, 30, w - 30);
          y = h - SAFE.bottom - 16;
          rotation = -Math.PI / 2;
          ty = -26;
          break;
      }
      // Der Pfeil zeigt vom Rand nach innen - so laeuft der Trupp gleich ins Bild.
      marker.arrow.setPosition(x, y).setRotation(rotation);
      marker.count.setPosition(x + tx, y + ty).setText(`${warning.count}`);
      marker.icon.setPosition(x + tx * 1.9, y + ty * 1.9);
      const speed = 6 + (2.2 - warning.eta) * 6;
      const visible = Math.sin(this.time * speed) > -0.3;
      marker.arrow.setVisible(visible);
      marker.count.setVisible(visible);
      marker.icon.setVisible(visible);
    }
    for (const [id, marker] of this.markers) {
      if (!seen.has(id)) {
        marker.arrow.destroy();
        marker.count.destroy();
        marker.icon.destroy();
        this.markers.delete(id);
      }
    }
  }
}

function pickIcon(members: readonly EnemyType[]): EnemyType {
  return ICON_ORDER.find((type) => members.includes(type)) ?? "laeufer";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
