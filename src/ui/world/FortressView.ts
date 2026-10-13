/**
 * Zeichnet die laufende Festung: Rumpf mit Deck, sechs Beine im Gang, die festen
 * Aufbauten (Motor, Sonnenherz, Bruecke), das Leuchten des Herzens und den Rauch.
 *
 * Wird im Titel und im Spiel benutzt. Bekommt nur die Lage der Festung, rechnet
 * nichts selbst aus - der Gang kommt aus `game/fortress.ts`.
 */

import Phaser from "phaser";
import { ELEVATION, TILE_H, TILE_W } from "../../game/constants";
import { FIXED_MODULES, LEGS, legPhase } from "../../game/fortress";
import type { FortState } from "../../game/types";
import {
  DECK_X as BODY_DECK_X,
  DECK_Y as BODY_DECK_Y,
  LEG_H,
  LEG_HIP,
  LEG_W,
} from "../pixel/festung";
import { LEG_FRAMES, TEX, legKey, moduleKey } from "../pixel/textures";
import { DEPTH, deckDepth } from "./view";

type FortPose = Pick<FortState, "x" | "y" | "gait" | "moving">;

export class FortressView {
  private readonly body: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly legs: { spec: (typeof LEGS)[number]; image: Phaser.GameObjects.Image }[];
  private readonly modules: {
    spec: (typeof FIXED_MODULES)[number];
    image: Phaser.GameObjects.Image;
  }[];
  private readonly glow: Phaser.GameObjects.Image;
  private smokeTimer = 0;
  private time = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.shadow = scene.add.ellipse(0, 0, 430, 112, 0x180810, 0.38).setDepth(DEPTH.fortShadow);
    this.body = scene.add.image(0, 0, TEX.fortress).setOrigin(0, 0).setDepth(DEPTH.body);
    this.legs = LEGS.map((spec) => {
      const left = spec.side < 0;
      const image = scene.add
        .image(0, 0, legKey(left ? "l" : "r", 0))
        .setOrigin((left ? LEG_HIP[0] : LEG_W - LEG_HIP[0]) / LEG_W, LEG_HIP[1] / LEG_H);
      return { spec, image };
    });
    this.modules = FIXED_MODULES.map((spec) => ({
      spec,
      image: scene.add.image(0, 0, moduleKey(spec.id)).setOrigin(0.5, 1),
    }));
    this.glow = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Oberkante links des Decks in Weltkoordinaten (dort beginnt das Feldraster). */
  static deckTop(fort: FortPose): { x: number; y: number } {
    return { x: fort.x, y: fort.y - ELEVATION };
  }

  update(fort: FortPose, deltaMs: number): void {
    this.time += deltaMs / 1000;
    const top = FortressView.deckTop(fort);
    this.body.setPosition(top.x - BODY_DECK_X, top.y - BODY_DECK_Y);
    this.shadow.setPosition(fort.x + 140, fort.y + 70);
    for (const { spec, image } of this.legs) {
      const frame = Math.floor(legPhase(fort.gait, spec) * LEG_FRAMES) % LEG_FRAMES;
      image.setTexture(legKey(spec.side < 0 ? "l" : "r", frame));
      image.setPosition(top.x + spec.hipX, top.y + spec.hipY);
      image.setDepth(fort.y + spec.footY);
    }
    for (const { spec, image } of this.modules) {
      const bottom = (spec.row + spec.rows) * TILE_H;
      image.setPosition(top.x + (spec.col + spec.cols / 2) * TILE_W, top.y + bottom);
      image.setDepth(deckDepth(bottom - 4));
    }
    // Das Sonnenherz pulsiert.
    const heart = FIXED_MODULES.find((m) => m.id === "herz");
    if (heart) {
      const bottom = (heart.row + heart.rows) * TILE_H;
      this.glow.setPosition(top.x + (heart.col + heart.cols / 2) * TILE_W, top.y + bottom - 46);
      this.glow.setDepth(deckDepth(bottom) + 0.001);
      this.glow.setAlpha(0.55 + Math.sin(this.time * 3) * 0.25);
      this.glow.setScale(1 + Math.sin(this.time * 3) * 0.08);
    }
    // Rauch aus den Schornsteinen des Motors, der Wind weht ihn nach hinten.
    this.smokeTimer -= deltaMs / 1000;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = fort.moving ? 0.22 : 0.6;
      const motor = FIXED_MODULES.find((m) => m.id === "motor");
      if (motor) {
        const chimney = this.scene.add.image(
          top.x + motor.col * TILE_W + (Math.random() < 0.5 ? 12 : 22),
          top.y + TILE_H * motor.row + 2,
          TEX.smoke,
        );
        chimney.setDepth(DEPTH.smoke).setScale(0.5).setAlpha(0.85);
        this.scene.tweens.add({
          targets: chimney,
          x: chimney.x - (fort.moving ? 60 : 12),
          y: chimney.y - 46,
          scale: 1.8,
          alpha: 0,
          duration: 2200,
          onComplete: () => chimney.destroy(),
        });
      }
    }
  }

  destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
    this.glow.destroy();
    for (const { image } of this.legs) {
      image.destroy();
    }
    for (const { image } of this.modules) {
      image.destroy();
    }
  }
}
