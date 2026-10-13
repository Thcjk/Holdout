/**
 * Zeichnet die gebauten Module auf dem Deck: Bild, Stufen-Punkte, beim Oelkessel
 * die brennende Lache am Boden und herabtropfendes Oel.
 */

import type Phaser from "phaser";
import { ELEVATION, TILE_H, TILE_W } from "../../game/constants";
import { MODULES } from "../../game/data/modules";
import { Simulation } from "../../game/Simulation";
import type { GameState, ModuleState } from "../../game/types";
import { TEX, moduleKey } from "../pixel/textures";
import { DEPTH, deckDepth } from "./view";

interface View {
  image: Phaser.GameObjects.Image;
  pips: Phaser.GameObjects.Image[];
  puddle: Phaser.GameObjects.Image | null;
  level: number;
  dripTimer: number;
}

export class ModuleView {
  private readonly views = new Map<number, View>();

  constructor(private readonly scene: Phaser.Scene) {}

  sync(state: GameState, deltaMs: number): void {
    const seen = new Set<number>();
    for (const m of state.modules) {
      seen.add(m.uid);
      let view = this.views.get(m.uid);
      if (!view || view.level !== m.level) {
        if (view) {
          this.remove(view);
        }
        view = this.create(m);
        this.views.set(m.uid, view);
      }
      this.place(view, m, state, deltaMs);
    }
    for (const [uid, view] of this.views) {
      if (!seen.has(uid)) {
        this.remove(view);
        this.views.delete(uid);
      }
    }
  }

  private create(m: ModuleState): View {
    const image = this.scene.add.image(0, 0, moduleKey(m.type)).setOrigin(0.5, 1);
    const pips = Array.from({ length: m.level }, () => this.scene.add.image(0, 0, TEX.pip));
    const puddle =
      m.type === "oel" ? this.scene.add.image(0, 0, TEX.puddle).setDepth(DEPTH.prints + 1) : null;
    return { image, pips, puddle, level: m.level, dripTimer: 0 };
  }

  private place(view: View, m: ModuleState, state: GameState, deltaMs: number): void {
    const f = state.fort;
    const width = MODULES[m.type].width;
    const bottom = (m.row + 1) * TILE_H;
    const x = f.x + (m.col + width / 2) * TILE_W;
    const y = f.y - ELEVATION + bottom;
    const depth = deckDepth(bottom - 4);
    view.image.setPosition(x, y).setDepth(depth);
    // Waffen-Bilder schauen nach rechts; zeigt das Modul nach links, wird gespiegelt.
    view.image.setFlipX(MODULES[m.type].weapon === true && m.facing < 0);
    view.pips.forEach((pip, i) => {
      pip.setPosition(x - (view.pips.length - 1) * 3.5 + i * 7, y - 2).setDepth(depth + 0.00001);
    });
    if (view.puddle) {
      const zone = Simulation.oilZone(m);
      const cx = f.x + (zone.x0 + zone.x1) / 2;
      const cy = f.y + (zone.y0 + zone.y1) / 2;
      view.puddle.setPosition(cx, cy).setVisible(state.phase === "march");
      // Ab und zu faellt ein Tropfen von der Kante in die Lache.
      view.dripTimer -= deltaMs;
      if (state.phase === "march" && view.dripTimer <= 0) {
        view.dripTimer = 180 + Math.random() * 160;
        const drop = this.scene.add
          .image(x + (Math.random() - 0.5) * 20, y - 6, TEX.drop)
          .setDepth(DEPTH.effects - 2);
        this.scene.tweens.add({
          targets: drop,
          x: cx + (Math.random() - 0.5) * 30,
          y: cy,
          duration: 420,
          ease: "Quad.In",
          onComplete: () => drop.destroy(),
        });
      }
    }
  }

  private remove(view: View): void {
    view.image.destroy();
    view.puddle?.destroy();
    for (const pip of view.pips) {
      pip.destroy();
    }
  }

  /** Wo ein Modul in der Welt steht (fuer Effekte wie den Moerser-Rauch). */
  static top(state: GameState, m: ModuleState): { x: number; y: number } {
    const width = MODULES[m.type].width;
    return {
      x: state.fort.x + (m.col + width / 2) * TILE_W,
      y: state.fort.y - ELEVATION + (m.row + 1) * TILE_H - 34,
    };
  }
}
