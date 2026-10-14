/**
 * Zeichnet die goldene Armee: jeden Gegner auf seiner Ebene (Boden, Rumpfwand,
 * Deck, Luft), dazu was ihre Aufgaben sichtbar macht:
 *   - Leitern an der Rumpfwand, solange ein Enterer hochklettert,
 *   - die Bruecke eines angedockten Belagerungsturms,
 *   - goldene Schildringe (Sandpriester),
 *   - Ballista-Bolzen im Flug,
 *   - das rote Feld, auf das der Koloss gleich schlaegt,
 *   - Lebensbalken ueber grossen Gegnern.
 */

import type Phaser from "phaser";
import { DECK_H, ELEVATION, TILE_H, TILE_W } from "../../game/constants";
import { ENEMIES } from "../../game/data/enemies";
import { insideRect } from "../../game/fortress";
import type { EnemyState, EnemyType, GameState } from "../../game/types";
import { ARMY_SIZE } from "../pixel/armee";
import { TEX, armyKey } from "../pixel/textures";
import { DEPTH, deckDepth } from "./view";

interface Body {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  /** Umriss, der durch die Festung durchscheint, wenn sie den Koerper verdeckt. */
  ghost: Phaser.GameObjects.Image;
  flash: number;
}

/** Bodenbereich, den Rumpf und Deck von vorn verdecken (relativ zur Festung). */
const HIDDEN = { x0: -6, y0: -ELEVATION - 4, x1: 286, y1: DECK_H - 2 };
/** Grosse Gegner, die kein Wackeln beim Zuschlagen haben und einen Lebensbalken bekommen. */
const HEAVY: ReadonlySet<EnemyType> = new Set(["streitwagen", "ballista", "turm", "koloss"]);
/** Wie gross der Schatten im Verhaeltnis zum Bild ist. */
const SHADOW_SCALE: Record<EnemyType, number> = {
  laeufer: 0.8,
  enterer: 0.8,
  phalanx: 0.9,
  skarabaeus: 0.55,
  priester: 0.8,
  streitwagen: 2.2,
  ballista: 2,
  turm: 2,
  koloss: 3.4,
};

export class EnemyView {
  private readonly bodies = new Map<number, Body>();
  private readonly bolts = new Map<
    number,
    { image: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }
  >();
  /** Leitern und Bruecken: ueber dem Rumpf, hinter den Kletterern. */
  private readonly walls: Phaser.GameObjects.Graphics;
  /** Rote Schlagfelder des Koloss auf dem Deck. */
  private readonly deckMarks: Phaser.GameObjects.Graphics;
  /** Schilde und Lebensbalken. */
  private readonly marks: Phaser.GameObjects.Graphics;
  private time = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.walls = scene.add.graphics().setDepth(DEPTH.body + 0.02);
    this.deckMarks = scene.add.graphics().setDepth(deckDepth(DECK_H) + 0.002);
    this.marks = scene.add.graphics().setDepth(DEPTH.effects - 3);
  }

  /** Kurz weiss aufblitzen lassen (Treffer). */
  flash(id: number): void {
    const b = this.bodies.get(id);
    if (b) {
      b.flash = 70;
    }
  }

  sync(state: GameState, deltaMs: number): void {
    this.time += deltaMs / 1000;
    this.walls.clear();
    this.deckMarks.clear();
    this.marks.clear();
    const seen = new Set<number>();
    for (const e of state.enemies) {
      seen.add(e.id);
      let b = this.bodies.get(e.id);
      if (!b) {
        b = this.create(e.type);
        this.bodies.set(e.id, b);
      }
      this.place(b, e, state);
      this.applyFlash(b, deltaMs);
      this.decorate(e, state);
    }
    for (const [id, b] of this.bodies) {
      if (!seen.has(id)) {
        b.sprite.destroy();
        b.shadow.destroy();
        b.ghost.destroy();
        this.bodies.delete(id);
      }
    }
    this.syncBolts(state);
  }

  private create(type: EnemyType): Body {
    const key = armyKey(type);
    const [, h] = ARMY_SIZE[type];
    // Fuesse unten; der Skarabaeus fliegt und haengt an seiner Mitte.
    const originY = type === "skarabaeus" ? 0.6 : (h - 2) / h;
    const sprite = this.scene.add.image(0, 0, key).setOrigin(0.5, originY);
    // Sanft einblenden - auf breiten Bildschirmen tauchen Trupps im Bild auf.
    sprite.setAlpha(0);
    this.scene.tweens.add({ targets: sprite, alpha: 1, duration: 300 });
    return {
      sprite,
      shadow: this.scene.add
        .image(0, 0, TEX.shadow)
        .setDepth(DEPTH.shadow)
        .setScale(SHADOW_SCALE[type]),
      ghost: this.scene.add
        .image(0, 0, key)
        .setOrigin(0.5, originY)
        .setTintFill(0xff5a3a)
        .setAlpha(0.4)
        .setDepth(DEPTH.effects - 1)
        .setVisible(false),
      flash: 0,
    };
  }

  private place(b: Body, e: EnemyState, state: GameState): void {
    const f = state.fort;
    const heavy = HEAVY.has(e.type);
    const wobble = !heavy && e.attacking;
    const run = heavy ? 0 : Math.abs(Math.sin(state.time * 13 + e.id)) * 2;
    let screenY = e.y - e.z;
    let depth = e.y;
    switch (e.layer) {
      case "ground":
        screenY -= e.attacking ? 0 : run;
        b.shadow.setPosition(e.x, e.y).setDepth(DEPTH.shadow);
        break;
      case "climb":
        // An der Rumpfwand: vor dem Rumpf, damit man ihn hochklettern sieht.
        depth = Math.max(e.y, DEPTH.body + 0.03);
        b.shadow.setPosition(e.x, e.y).setDepth(DEPTH.shadow);
        break;
      case "deck":
        screenY = e.y - ELEVATION - (e.attacking ? 0 : run);
        depth = deckDepth(e.y - f.y);
        b.shadow.setPosition(e.x, e.y - ELEVATION).setDepth(depth - 0.00005);
        break;
      case "air": {
        screenY -= Math.sin(state.time * 18 + e.id) * 2;
        const overDeck = insideRect({ x0: 0, y0: 0, x1: 280, y1: DECK_H }, e.x - f.x, e.y - f.y);
        depth = e.z > 40 ? deckDepth(e.y - f.y) + 0.00008 : e.y;
        b.shadow
          .setPosition(e.x, overDeck && e.z > 40 ? e.y - ELEVATION : e.y)
          .setDepth(overDeck && e.z > 40 ? deckDepth(e.y - f.y) : DEPTH.shadow);
        break;
      }
    }
    b.sprite.setPosition(e.x, screenY).setDepth(depth);
    b.sprite.setFlipX(e.facing < 0);
    // Beim Hacken wippt er vor und zurueck; grosse Brocken ruckeln nur.
    b.sprite.setRotation(wobble ? Math.sin(state.time * 9 + e.id) * 0.18 : 0);
    if (heavy && e.attacking) {
      b.sprite.y += Math.round(Math.sin(state.time * 20) * 1);
    }
    const hidden = e.layer === "ground" && insideRect(HIDDEN, e.x - f.x, e.y - f.y);
    b.ghost.setVisible(hidden && b.sprite.visible);
    if (hidden) {
      b.ghost
        .setPosition(b.sprite.x, b.sprite.y)
        .setFlipX(b.sprite.flipX)
        .setRotation(b.sprite.rotation);
    }
  }

  /** Leitern, Bruecken, Schilde, Lebensbalken, Schlagfelder. */
  private decorate(e: EnemyState, state: GameState): void {
    const f = state.fort;
    const [w, h] = ARMY_SIZE[e.type];
    if (e.layer === "climb") {
      this.ladder(e.x, e.y, e.y - ELEVATION);
    }
    if (e.type === "turm" && e.mode === "dock") {
      // Bruecke vom Turm aufs Deck.
      const deckX = f.x + e.tx;
      const deckY = f.y + e.ty - ELEVATION;
      const fromX = e.x + (e.slotX < 0 ? 18 : -18);
      const fromY = e.y - ELEVATION - 2;
      this.walls.lineStyle(6, 0x120f1e, 1).lineBetween(fromX, fromY, deckX, deckY);
      this.walls.lineStyle(4, 0x86582c, 1).lineBetween(fromX, fromY, deckX, deckY);
      this.walls.lineStyle(1, 0xc08a4a, 1).lineBetween(fromX, fromY - 1, deckX, deckY - 1);
    }
    if (e.shield > 0) {
      const pulse = 0.55 + Math.sin(this.time * 6 + e.id) * 0.2;
      const cy = e.y - e.z - (e.layer === "deck" ? ELEVATION : 0) - h * 0.45;
      this.marks.lineStyle(2, 0xffd040, pulse).strokeEllipse(e.x, cy, w * 0.75, h * 0.85);
    }
    if (e.type === "koloss" && e.mode === "slam") {
      // Das Feld leuchtet immer heller rot, bis der Schlag kommt.
      const x = f.x + e.tx - TILE_W;
      const y = f.y + e.ty - TILE_H - ELEVATION;
      const blink = 0.25 + 0.35 * Math.abs(Math.sin(this.time * (8 + (1.4 - e.timer) * 10)));
      this.deckMarks.fillStyle(0xff3a2a, blink).fillRect(x, y, TILE_W * 2, TILE_H * 2);
      this.deckMarks
        .lineStyle(2, 0xffb0a0, 0.9)
        .strokeRect(x + 1, y + 1, TILE_W * 2 - 2, TILE_H * 2 - 2);
    }
    if (HEAVY.has(e.type) && e.type !== "koloss" && e.hp < e.hpMax) {
      const top = e.y - e.z - h + 4;
      const bw = Math.min(56, w * 0.6);
      const fill = Math.max(0, e.hp / e.hpMax);
      this.marks.fillStyle(0x120f1e, 1).fillRect(e.x - bw / 2 - 1, top - 1, bw + 2, 5);
      this.marks.fillStyle(0xff5a3a, 1).fillRect(e.x - bw / 2, top, Math.round(bw * fill), 3);
    }
    if (e.type === "priester" && e.attacking) {
      // Der Sonnenstab leuchtet beim Segnen.
      const r = 20 + (ENEMIES.priester.attackCooldown - e.attackCd) * 60;
      this.marks.lineStyle(2, 0xffd040, Math.max(0, 1 - r / 110)).strokeCircle(e.x, e.y - 20, r);
    }
  }

  /** Strickleiter des Enterers an der Rumpfwand. */
  private ladder(x: number, bottom: number, top: number): void {
    const g = this.walls;
    g.lineStyle(2, 0x120f1e, 1);
    g.lineBetween(x - 5, bottom, x - 5, top);
    g.lineBetween(x + 5, bottom, x + 5, top);
    g.lineStyle(1, 0xc08a4a, 1);
    g.lineBetween(x - 5, bottom, x - 5, top);
    g.lineBetween(x + 5, bottom, x + 5, top);
    for (let y = bottom - 4; y > top; y -= 8) {
      g.lineStyle(2, 0x86582c, 1).lineBetween(x - 5, y, x + 5, y);
    }
  }

  private applyFlash(b: Body, deltaMs: number): void {
    if (b.flash > 0) {
      b.flash -= deltaMs;
      b.sprite.setTintFill(0xffffff);
      if (b.flash <= 0) {
        b.sprite.clearTint();
      }
    }
  }

  /** Ballista-Bolzen: flacher Bogen von der Ballista zu ihrem Ziel auf dem Deck. */
  private syncBolts(state: GameState): void {
    const f = state.fort;
    const seen = new Set<number>();
    for (const bolt of state.enemyShots) {
      seen.add(bolt.id);
      let view = this.bolts.get(bolt.id);
      if (!view) {
        view = {
          image: this.scene.add.image(0, 0, TEX.ballistaBolt).setDepth(DEPTH.effects - 1),
          shadow: this.scene.add.image(0, 0, TEX.shadow).setDepth(DEPTH.shadow).setScale(0.3),
        };
        this.bolts.set(bolt.id, view);
      }
      const u = Math.min(1, bolt.t / bolt.duration);
      const x1 = f.x + bolt.x1;
      const y1 = f.y + bolt.y1;
      const x = bolt.x0 + (x1 - bolt.x0) * u;
      const y = bolt.y0 + (y1 - bolt.y0) * u;
      const z = bolt.z0 + (ELEVATION + 10 - bolt.z0) * u + Math.sin(u * Math.PI) * 30;
      const ahead = Math.min(1, u + 0.05);
      const nx = bolt.x0 + (x1 - bolt.x0) * ahead;
      const ny = bolt.y0 + (y1 - bolt.y0) * ahead;
      const nz = bolt.z0 + (ELEVATION + 10 - bolt.z0) * ahead + Math.sin(ahead * Math.PI) * 30;
      view.image.setPosition(x, y - z).setRotation(Math.atan2(ny - nz - (y - z), nx - x));
      view.shadow.setPosition(x, y);
    }
    for (const [id, view] of this.bolts) {
      if (!seen.has(id)) {
        view.image.destroy();
        view.shadow.destroy();
        this.bolts.delete(id);
      }
    }
  }
}
