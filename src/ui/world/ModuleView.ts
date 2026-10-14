/**
 * Zeichnet die gebauten Module auf dem Deck: Bild, Stufen-Punkte, beim Oelkessel
 * die brennende Lache am Boden und herabtropfendes Oel. Beschaedigte Module
 * zeigen einen Lebensbalken, kaputte sind dunkel und rauchen.
 */

import type Phaser from "phaser";
import { DECK_H, ELEVATION, TILE_H, TILE_W } from "../../game/constants";
import { MODULES } from "../../game/data/modules";
import { oilZone } from "../../game/deck";
import type { GameState, ModuleState } from "../../game/types";
import { TEX, moduleKey } from "../pixel/textures";
import { DEPTH, deckDepth } from "./view";

interface View {
  image: Phaser.GameObjects.Image;
  pips: Phaser.GameObjects.Image[];
  puddle: Phaser.GameObjects.Image | null;
  level: number;
  dripTimer: number;
  smokeTimer: number;
}

export class ModuleView {
  private readonly views = new Map<number, View>();
  /** Lebensbalken beschaedigter Module. */
  private readonly bars: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.bars = scene.add.graphics().setDepth(deckDepth(DECK_H) + 0.003);
  }

  sync(state: GameState, deltaMs: number): void {
    this.bars.clear();
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
    return { image, pips, puddle, level: m.level, dripTimer: 0, smokeTimer: 0 };
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
    if (m.broken) {
      view.image.setTint(0x55505a);
      view.smokeTimer -= deltaMs;
      if (view.smokeTimer <= 0) {
        view.smokeTimer = 240 + Math.random() * 200;
        const puff = this.scene.add
          .image(x + (Math.random() - 0.5) * 18, y - 22, TEX.smoke)
          .setDepth(DEPTH.smoke)
          .setScale(0.5)
          .setTint(0x3a3440);
        this.scene.tweens.add({
          targets: puff,
          y: puff.y - 26,
          x: puff.x - 10,
          scale: 1.4,
          alpha: 0,
          duration: 900,
          onComplete: () => puff.destroy(),
        });
      }
    } else {
      view.image.clearTint();
    }
    if (m.hp < m.hpMax) {
      const bw = width * TILE_W - 12;
      const left = x - bw / 2;
      const top = y - TILE_H - 8;
      const fill = Math.max(0, m.hp / m.hpMax);
      this.bars.fillStyle(0x120f1e, 1).fillRect(left - 1, top - 1, bw + 2, 5);
      // Unter der Haelfte arbeitet ein kaputtes Modul noch nicht wieder.
      this.bars
        .fillStyle(m.broken ? 0xff5a3a : 0x6cf27a, 1)
        .fillRect(left, top, Math.round(bw * fill), 3);
      if (m.broken) {
        this.bars.fillStyle(0xffffff, 0.7).fillRect(left + Math.round(bw / 2), top - 1, 1, 5);
      }
    }
    if (view.puddle) {
      const zone = oilZone(m);
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
