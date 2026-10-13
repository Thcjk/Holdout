/**
 * Die Anzeigen im Marsch: oben links der eigene Mech, oben in der Mitte Etappe,
 * Rumpf und Fortschritt, oben rechts der Schrott.
 *
 * Alles klebt am Bildschirm (`setScrollFactor(0)`) und rueckt nach, wenn sich
 * die Breite aendert (`layout`).
 */

import Phaser from "phaser";
import { SAFE, VIEWPORT } from "../config/constants";
import { CREW } from "../game/data/crew";
import type { GameState, PlayerState } from "../game/types";
import { BOX, ComicBox } from "./ComicBox";
import { TEX, crewKey } from "./pixel/textures";
import { FONT_BODY, FONT_TITLE, T } from "./theme";
import { DEPTH } from "./world/view";

const LEFT_W = 250;
const CENTER_W = 380;
const SCRAP_W = 150;

export class Hud {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly leftPanel: ComicBox;
  private readonly centerPanel: ComicBox;
  private readonly scrapPanel: ComicBox;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly name: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hullText: Phaser.GameObjects.Text;
  private readonly scrapIcon: Phaser.GameObjects.Image;
  private readonly scrapText: Phaser.GameObjects.Text;
  private readonly bars: Phaser.GameObjects.Graphics;
  private hullFlash = 0;
  private lastHull = -1;

  constructor(scene: Phaser.Scene, crew: PlayerState["crew"]) {
    const fixed = <
      O extends Phaser.GameObjects.GameObject &
        Phaser.GameObjects.Components.ScrollFactor &
        Phaser.GameObjects.Components.Depth,
    >(
      o: O,
      depth = DEPTH.hud + 1,
    ): O => {
      o.setScrollFactor(0).setDepth(depth);
      this.objects.push(o);
      return o;
    };
    this.leftPanel = new ComicBox(scene, BOX.panel, 0, 0, LEFT_W, 60);
    this.centerPanel = new ComicBox(scene, BOX.panel, 0, 0, CENTER_W, 78);
    this.scrapPanel = new ComicBox(scene, BOX.panel, 0, 0, SCRAP_W, 48);
    for (const panel of [this.leftPanel, this.centerPanel, this.scrapPanel]) {
      panel.container.setScrollFactor(0);
      panel.setDepth(DEPTH.hud);
    }
    this.portrait = fixed(scene.add.image(0, 0, crewKey(crew)).setScale(0.78));
    const text = (size: number, color: string, font = FONT_BODY): Phaser.GameObjects.Text =>
      fixed(
        scene.add
          .text(0, 0, "", {
            fontFamily: font,
            fontSize: `${size}px`,
            color,
            fontStyle: font === FONT_BODY ? "bold" : "normal",
          })
          .setStroke(T.outline, Math.max(3, Math.round(size / 5))),
      );
    this.name = text(15, T.light).setText(CREW[crew].name.toUpperCase());
    this.status = text(11, T.muted);
    this.title = text(26, T.gold, FONT_TITLE).setOrigin(0.5, 0.5);
    this.hullText = text(12, T.light).setOrigin(0.5, 0.5);
    this.scrapIcon = fixed(scene.add.image(0, 0, TEX.gear));
    this.scrapText = text(30, "#e6eaf2", FONT_TITLE).setOrigin(1, 0.5);
    this.bars = fixed(scene.add.graphics(), DEPTH.hud + 0.5);
    this.layout();
  }

  /** Positionen nach der aktuellen Bildschirmbreite. */
  layout(): void {
    const w = VIEWPORT.width;
    const top = SAFE.top + 8;
    const left = SAFE.left + 10;
    this.leftPanel.setPosition(left + LEFT_W / 2, top + 30);
    this.portrait.setPosition(left + 30, top + 26);
    this.name.setPosition(left + 60, top + 9);
    this.status.setPosition(left + 60, top + 40);
    this.centerPanel.setPosition(w / 2, top + 39);
    this.title.setPosition(w / 2, top + 18);
    this.hullText.setPosition(w / 2, top + 41);
    const right = w - SAFE.right - 10 - 54;
    this.scrapPanel.setPosition(right - SCRAP_W / 2, top + 24);
    this.scrapIcon.setPosition(right - SCRAP_W + 24, top + 24);
    this.scrapText.setPosition(right - 14, top + 23);
  }

  /** Bereich oben rechts neben dem Schrott - dort sitzt der Pause-Knopf. */
  pauseSpot(): { x: number; y: number } {
    return { x: VIEWPORT.width - SAFE.right - 10 - 22, y: SAFE.top + 8 + 24 };
  }

  update(state: GameState, self: PlayerState | undefined, deltaMs: number): void {
    const w = VIEWPORT.width;
    const top = SAFE.top + 8;
    const left = SAFE.left + 10;
    const g = this.bars;
    g.clear();

    // Eigener Mech
    if (self) {
      this.status.setText(
        self.alive
          ? self.layer === "deck"
            ? "auf dem Deck"
            : "am Boden"
          : `steht in ${Math.ceil(self.respawn)} s wieder auf`,
      );
      this.bar(g, left + 60, top + 24, 176, 11, self.hp / self.hpMax, 0xd84a3e, 0xff8a7a);
      this.portrait.setAlpha(self.alive ? 1 : 0.4);
    }

    // Etappe, Rumpf, Fortschritt
    const m = state.march;
    const where =
      state.phase === "rest"
        ? `RAST · ${m.station.toUpperCase()}`
        : `ETAPPE ${m.index + 1} / ${m.count} · ZUR ${m.station.toUpperCase()}`;
    this.title.setText(where);
    const hull = state.fort.hull;
    if (this.lastHull >= 0 && hull < this.lastHull) {
      this.hullFlash = 0.25;
    }
    this.lastHull = hull;
    this.hullFlash = Math.max(0, this.hullFlash - deltaMs / 1000);
    const hullColor = this.hullFlash > 0 ? 0xffffff : 0xe8822e;
    this.bar(g, w / 2 - 170, top + 32, 340, 18, hull / state.fort.hullMax, hullColor, 0xffc070);
    this.hullText.setText(`RUMPF ${Math.ceil(hull)} / ${state.fort.hullMax}`);
    const progress = Math.min(1, m.done / m.length);
    g.fillStyle(0x120f1e, 1).fillRect(w / 2 - 170, top + 56, 340, 8);
    g.fillStyle(0x3a3f6e, 1).fillRect(w / 2 - 168, top + 58, 336, 4);
    g.fillStyle(0x5ef2e6, 1).fillRect(w / 2 - 168, top + 58, Math.round(336 * progress), 4);
    const mx = w / 2 - 170 + Math.round(336 * progress);
    g.fillStyle(0xf0b23e, 1).fillRect(mx - 3, top + 54, 8, 12);
    g.fillStyle(0x120f1e, 1).fillRect(mx - 1, top + 57, 4, 6);

    // Schrott
    this.scrapText.setText(`${state.bank}`);
  }

  private bar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    f: number,
    color: number,
    light: number,
  ): void {
    const fill = Math.round((w - 4) * Math.max(0, Math.min(1, f)));
    g.fillStyle(0x120f1e, 1).fillRect(x, y, w, h);
    g.fillStyle(0x2a2636, 1).fillRect(x + 2, y + 2, w - 4, h - 4);
    g.fillStyle(color, 1).fillRect(x + 2, y + 2, fill, h - 4);
    g.fillStyle(light, 1).fillRect(x + 2, y + 2, fill, 2);
  }

  destroy(): void {
    for (const o of this.objects) {
      o.destroy();
    }
    this.leftPanel.destroy();
    this.centerPanel.destroy();
    this.scrapPanel.destroy();
  }
}
