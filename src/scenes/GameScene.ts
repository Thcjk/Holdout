/**
 * Das Spiel: Die Festung marschiert, die goldene Armee holt auf.
 *
 * Die Szene rechnet nichts selbst. Jedes Bild gibt sie Bewegung und Faehigkeit
 * an die Sitzung, bekommt Zustand und Ereignisse zurueck und zeichnet:
 *   - Boden und Festung (`GroundView`, `FortressView`),
 *   - Mechs, Gegner, Geschosse, Schrott (je ein Bild pro Ding im Zustand),
 *   - Effekte zu den Ereignissen (Staub, Funken, Knochen, Texte),
 *   - Module auf dem Deck, Granaten, Blitze, Warnungen am Bildrand,
 *   - Anzeigen, Faehigkeitsknopf, Stick, Rast-Tafel, Pause.
 * In der Rast oeffnet "Ausbauen" die Bau-Ansicht (`BuildScene`) darueber.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { SAFE, VIEWPORT } from "../config/constants";
import { playerName } from "../app";
import { DECK_H, ELEVATION, LADDER, STATION_BONUS, WINCH_LANDING } from "../game/constants";
import { BLIND_SPOT, insideRect } from "../game/fortress";
import type {
  Command,
  EnemyType,
  GameEvent,
  GameState,
  PlayerState,
  ScrapState,
  ShotState,
} from "../game/types";
import type { GameSession } from "../net/GameSession";
import { SoloSession } from "../net/SoloSession";
import { FORCED_SEED, RICH_START, SHORT_ROUTE, SHOW_VALUES } from "../platform/debugFlags";
import { AbilityButton } from "../ui/AbilityButton";
import { Button } from "../ui/Button";
import { EventPanel } from "../ui/EventPanel";
import { BOX, ComicBox } from "../ui/ComicBox";
import { FloatingStick } from "../ui/FloatingStick";
import { Hud } from "../ui/Hud";
import { RestPanel } from "../ui/RestPanel";
import { TEX, crewKey, scrapKey } from "../ui/pixel/textures";
import { FONT_BODY, FONT_TITLE, T } from "../ui/theme";
import { EnemyView } from "../ui/world/EnemyView";
import { FortressView } from "../ui/world/FortressView";
import { GroundView } from "../ui/world/GroundView";
import { LootView } from "../ui/world/LootView";
import { ModuleView } from "../ui/world/ModuleView";
import { WarningView } from "../ui/world/WarningView";
import { DEPTH, deckDepth, depthFor, followFort } from "../ui/world/view";

const SELF = "ich";

interface Body {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  /** Umriss, der durch die Festung durchscheint, wenn sie den Koerper verdeckt. */
  ghost: Phaser.GameObjects.Image;
  flash: number;
}

/** Bodenbereich, den Rumpf und Deck von vorn verdecken (relativ zur Festung). */
const HIDDEN = { x0: -6, y0: -ELEVATION - 4, x1: 286, y1: DECK_H - 2 };

/** Kurze Vorstellung jeder Gegnerart, wenn sie zum ersten Mal auftaucht. */
const ENEMY_INTRO: Partial<Record<EnemyType, string>> = {
  enterer:
    "Enterer klettern die Rumpfwand hoch und zerlegen oben Module. Panzerplatten am Rand halten sie ab, Öl verbrennt sie an der Wand.",
  phalanx:
    "Phalanx: Von vorn hält der Turmschild fast alles ab. Von hinten, mit Mörser, Blitz oder Fuß geht es.",
  skarabaeus: "Skarabäen fliegen aufs Deck. Von oben erwischt ihr sie am besten.",
  priester:
    "Sandpriester geben anderen einen goldenen Schild. Er flieht vor Mechs – spring ab und jag ihn.",
  streitwagen:
    "Streitwagen rammen die Beine, dann läuft die Festung kurz langsamer. Danach steckt er fest – jetzt kann ihn ein Fuß zertreten.",
  ballista:
    "Die Ballista schießt Module kaputt und hält Abstand. Harpune, Mörser oder ein Mech am Boden holen sie.",
  turm: "Ein Belagerungsturm dockt seitlich an und lässt Enterer über eine Brücke aufs Deck. Schnell zerstören!",
};

export interface GameResult {
  won: boolean;
  marches: number;
  count: number;
  kills: number;
  scrap: number;
  seconds: number;
  hull: number;
}

export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private ground!: GroundView;
  private fortress!: FortressView;
  private hud!: Hud;
  private ability!: AbilityButton;
  private stick!: FloatingStick;
  private stickRegion!: Phaser.Geom.Rectangle;
  private rest!: RestPanel;
  private pauseButton!: Button;
  /** Raeumt die Pause-Tafel wieder weg. */
  private pauseCleanup: (() => void)[] = [];
  private paused = false;
  private players = new Map<string, Body>();
  private enemies!: EnemyView;
  private shots = new Map<number, Phaser.GameObjects.Image>();
  private scrap = new Map<number, Phaser.GameObjects.Image>();
  private ladderArrow!: Phaser.GameObjects.Image;
  private rope!: Phaser.GameObjects.Graphics;
  private hint!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private shown = new Set<string>();
  private hintQueue: string[] = [];
  private hintUntil = 0;
  private ending = false;
  private lastShotSound = 0;
  private values: Phaser.GameObjects.Text | null = null;
  private modules!: ModuleView;
  private warnings!: WarningView;
  private shells = new Map<
    number,
    { shell: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }
  >();
  private zaps!: Phaser.GameObjects.Graphics;
  private zapTime = 0;
  /** Die Bau-Ansicht oder die Karte liegt gerade darueber. */
  private building = false;
  private loot!: LootView;
  private eventPanel!: EventPanel;

  constructor() {
    super("Game");
  }

  create(): void {
    this.players = new Map();
    this.shots = new Map();
    this.scrap = new Map();
    this.pauseCleanup = [];
    this.shown = new Set();
    this.shells = new Map();
    this.paused = false;
    this.ending = false;
    this.building = false;

    const seed = FORCED_SEED ?? Math.floor(Math.random() * 1e9);
    this.session = new SoloSession({ id: SELF, name: playerName(), crew: "schrauber" }, seed, {
      lengthFactor: SHORT_ROUTE ? 0.1 : 1,
      startScrap: RICH_START ? 999 : undefined,
    });

    this.ground = new GroundView(this);
    this.fortress = new FortressView(this);
    this.rope = this.add.graphics().setDepth(DEPTH.effects);
    this.zaps = this.add.graphics().setDepth(DEPTH.effects + 1);
    this.modules = new ModuleView(this);
    this.enemies = new EnemyView(this);
    this.loot = new LootView(this);
    this.eventPanel = new EventPanel(this, (option) => {
      this.session.send({ kind: "choose", option });
    });
    this.hintQueue = [];
    this.hintUntil = 0;
    this.warnings = new WarningView(this);
    this.ladderArrow = this.add.image(0, 0, TEX.arrow).setDepth(DEPTH.effects).setVisible(false);

    this.hud = new Hud(this, "schrauber");
    this.ability = new AbilityButton(this, "schrauber");
    this.rest = new RestPanel(
      this,
      () => this.openBuild(),
      () => {
        this.session.send({ kind: "repair" });
      },
      () => this.openMap(),
    );
    this.stickRegion = new Phaser.Geom.Rectangle(
      0,
      84,
      VIEWPORT.width * 0.62,
      VIEWPORT.height - 84,
    );
    this.stick = new FloatingStick(this, this.stickRegion);
    this.pauseButton = new Button(this, 0, 0, "II", () => this.setPaused(true), {
      width: 44,
      height: 44,
      fontSize: 18,
      variant: "secondary",
    });
    this.pauseButton.setScrollFactor(0);
    this.pauseButton.setDepth(DEPTH.hud + 5);

    this.hint = this.add
      .text(0, 0, "", {
        fontFamily: FONT_BODY,
        fontSize: "16px",
        color: T.light,
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5, 1)
      .setStroke(T.outline, 4)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 2)
      .setAlpha(0);
    this.banner = this.add
      .text(0, 0, "", { fontFamily: FONT_TITLE, fontSize: "54px", color: T.gold, align: "center" })
      .setOrigin(0.5)
      .setStroke(T.outline, 8)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 3)
      .setAlpha(0);

    if (SHOW_VALUES) {
      // Fuer automatische Tests im Browser: Zustand von aussen lesbar.
      (window as unknown as { __holdout?: unknown }).__holdout = {
        state: () => this.session.state,
        send: (command: Command) => this.session.send(command),
        spawn: (type: EnemyType, x: number, y: number) => {
          if (this.session instanceof SoloSession) {
            this.session.spawnForTest(type, x, y);
          }
        },
      };
    }
    this.values = SHOW_VALUES
      ? this.add
          .text(SAFE.left + 8, VIEWPORT.height - 18, "", {
            fontFamily: FONT_BODY,
            fontSize: "12px",
            color: T.light,
          })
          .setScrollFactor(0)
          .setDepth(DEPTH.hud + 9)
          .setStroke(T.outline, 3)
      : null;

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.stick.destroy();
      this.session.destroy();
    });

    // Der Lauf beginnt mit einer Rast am Grab: gleich die Bau-Ansicht zeigen.
    audio.setMusic("menu", 0.7);
    this.time.delayedCall(350, () => this.openBuild());
  }

  /** Bau-Ansicht ueber das Spiel legen. Solange sie offen ist, ruhen Stick und Knoepfe. */
  private openBuild(): void {
    if (this.building || this.session.state.phase !== "rest") {
      return;
    }
    this.building = true;
    this.stick.release();
    this.stick.enabled = false;
    this.scene.launch("Build", {
      session: this.session,
      onClose: () => {
        this.building = false;
        this.stick.enabled = !this.paused;
      },
      onDepart: () => this.time.delayedCall(10, () => this.openMap()),
    });
  }

  /** Routenkarte ueber das Spiel legen: naechste Station waehlen und losziehen. */
  private openMap(): void {
    if (this.building || this.session.state.phase !== "rest" || this.session.state.event) {
      return;
    }
    this.building = true;
    this.stick.release();
    this.stick.enabled = false;
    this.scene.launch("Map", {
      session: this.session,
      onClose: () => {
        this.building = false;
        this.stick.enabled = !this.paused;
      },
    });
  }

  private layout(): void {
    this.hud.layout();
    this.ability.layout();
    this.rest.layout();
    const spot = this.hud.pauseSpot();
    this.pauseButton.setPosition(spot.x, spot.y);
    this.stickRegion.setSize(VIEWPORT.width * 0.62, VIEWPORT.height - 84);
    this.hint.setPosition(VIEWPORT.width / 2, VIEWPORT.height - SAFE.bottom - 28);
    this.banner.setPosition(VIEWPORT.width / 2, VIEWPORT.height * 0.42);
  }

  update(_time: number, delta: number): void {
    if (!this.paused && !this.ending) {
      const move = this.stick.value;
      this.session.update(delta, { mx: move.mx, my: move.my, ability: this.ability.presses });
    }
    const state = this.session.state;
    const self = state.players.find((p) => p.id === this.session.selfId);
    const frameDelta = this.paused ? 0 : delta;

    followFort(this.cameras.main, state.fort.x);
    this.ground.update(this.cameras.main);
    this.fortress.update(state.fort, frameDelta);
    this.syncPlayers(state, frameDelta);
    this.enemies.sync(state, frameDelta);
    this.syncShots(state);
    this.syncScrap(state);
    this.syncShells(state);
    this.modules.sync(state, frameDelta);
    this.loot.sync(state, this.cameras.main, frameDelta);
    this.warnings.sync(state, this.cameras.main, frameDelta);
    this.eventPanel.update(state, this.building || this.ending);
    this.drawHelpers(state, self);
    this.zapTime -= frameDelta;
    if (this.zapTime <= 0) {
      this.zaps.clear();
    }
    if (!this.paused) {
      for (const event of this.session.events) {
        this.onEvent(event, state);
      }
    }
    this.watchForHints(state, self);
    this.nextHint();
    this.hud.update(state, self, frameDelta);
    this.ability.update(self, frameDelta);
    this.rest.update(state, this.building || state.event !== null);
    this.pauseButton.setVisible(!this.ending && !this.building);
    this.values?.setText(
      `${Math.round(this.game.loop.actualFps)} fps · ${state.enemies.length} Gegner · ${state.shots.length} Schüsse`,
    );

    if ((state.phase === "won" || state.phase === "lost") && !this.ending) {
      this.finish(state);
    }
  }

  // --- Dinge im Zustand zeichnen -------------------------------------------------------------

  private body(texture: string, originY: number, ghostColor: number): Body {
    return {
      sprite: this.add.image(0, 0, texture).setOrigin(0.5, originY),
      shadow: this.add.image(0, 0, TEX.shadow).setDepth(DEPTH.shadow),
      ghost: this.add
        .image(0, 0, texture)
        .setOrigin(0.5, originY)
        .setTintFill(ghostColor)
        .setAlpha(0.4)
        .setDepth(DEPTH.effects - 1)
        .setVisible(false),
      flash: 0,
    };
  }

  /** Verdeckt die Festung diesen Punkt am Boden? Dann scheint ein Umriss durch. */
  private updateGhost(b: Body, x: number, y: number, z: number, state: GameState): void {
    const hidden = z < ELEVATION * 0.5 && insideRect(HIDDEN, x - state.fort.x, y - state.fort.y);
    b.ghost.setVisible(hidden && b.sprite.visible);
    if (hidden) {
      b.ghost
        .setPosition(b.sprite.x, b.sprite.y)
        .setFlipX(b.sprite.flipX)
        .setRotation(b.sprite.rotation);
    }
  }

  private destroyBody(b: Body): void {
    b.sprite.destroy();
    b.shadow.destroy();
    b.ghost.destroy();
  }

  private syncPlayers(state: GameState, delta: number): void {
    const seen = new Set<string>();
    for (const p of state.players) {
      seen.add(p.id);
      let b = this.players.get(p.id);
      if (!b) {
        b = this.body(crewKey(p.crew), 62 / 64, 0x5ef2e6);
        this.players.set(p.id, b);
      }
      b.sprite.setVisible(p.alive);
      b.shadow.setVisible(p.alive);
      if (!p.alive) {
        b.ghost.setVisible(false);
        continue;
      }
      const bob = p.moving && !p.transition ? Math.round(Math.abs(Math.sin(state.time * 12))) : 0;
      b.sprite.setPosition(p.x, p.y - p.z - bob);
      b.sprite.setFlipX(p.facing < 0);
      b.sprite.setDepth(depthFor(p.y, p.z, state.fort.y));
      // Schatten: auf dem Deck, wenn der Mech darueber ist, sonst am Boden.
      const overDeck =
        p.z > ELEVATION * 0.5 &&
        insideRect({ x0: 0, y0: 0, x1: 280, y1: DECK_H }, p.x - state.fort.x, p.y - state.fort.y);
      if (overDeck) {
        b.shadow
          .setPosition(p.x, p.y - ELEVATION)
          .setDepth(deckDepth(p.y - state.fort.y) - 0.00005);
      } else {
        b.shadow.setPosition(p.x, p.y).setDepth(DEPTH.shadow);
      }
      b.shadow.setScale(1 - Math.min(0.4, Math.abs(p.z - (overDeck ? ELEVATION : 0)) / 120));
      this.applyFlash(b, delta);
      this.updateGhost(b, p.x, p.y, p.z, state);
    }
    for (const [id, b] of this.players) {
      if (!seen.has(id)) {
        this.destroyBody(b);
        this.players.delete(id);
      }
    }
  }

  private applyFlash(b: Body, delta: number): void {
    if (b.flash > 0) {
      b.flash -= delta;
      b.sprite.setTintFill(0xffffff);
      if (b.flash <= 0) {
        b.sprite.clearTint();
      }
    }
  }

  private syncShots(state: GameState): void {
    const seen = new Set<number>();
    for (const shot of state.shots) {
      seen.add(shot.id);
      let image = this.shots.get(shot.id);
      if (!image) {
        image = this.add.image(
          0,
          0,
          shot.look === "bolt" ? TEX.bolt : shot.look === "harpoon" ? TEX.harpoon : TEX.rivet,
        );
        this.shots.set(shot.id, image);
      }
      this.placeShot(image, shot);
    }
    for (const [id, image] of this.shots) {
      if (!seen.has(id)) {
        image.destroy();
        this.shots.delete(id);
      }
    }
  }

  private placeShot(image: Phaser.GameObjects.Image, shot: ShotState): void {
    image.setPosition(shot.x, shot.y - shot.z);
    image.setRotation(Math.atan2(shot.vy - shot.vz, shot.vx));
    // Hoch oben (vom Deck aus) ueber allem am Boden, sonst nach Bodenlage.
    image.setDepth(shot.z > 40 ? deckDepth(DECK_H) + 0.01 : shot.y + 0.1);
  }

  private syncScrap(state: GameState): void {
    const seen = new Set<number>();
    for (const piece of state.scrap) {
      seen.add(piece.id);
      let image = this.scrap.get(piece.id);
      if (!image) {
        image = this.add.image(0, 0, scrapKey(piece.id % 3));
        this.scrap.set(piece.id, image);
      }
      this.placeScrap(image, piece, state.time);
    }
    for (const [id, image] of this.scrap) {
      if (!seen.has(id)) {
        image.destroy();
        this.scrap.delete(id);
      }
    }
  }

  private placeScrap(image: Phaser.GameObjects.Image, piece: ScrapState, time: number): void {
    image.setPosition(
      piece.x,
      piece.y - 4 - Math.round(Math.abs(Math.sin(time * 3 + piece.id))) * 2,
    );
    image.setDepth(piece.y);
    // Ab und zu blitzt ein Stueck auf - so faellt Schrott auf dem Sand auf.
    if (Math.random() < 0.012) {
      const glint = this.add
        .image(image.x + 3, image.y - 4, TEX.spark)
        .setDepth(piece.y + 0.2)
        .setScale(0.5);
      this.tweens.add({
        targets: glint,
        scale: 1.3,
        alpha: 0,
        duration: 260,
        onComplete: () => glint.destroy(),
      });
    }
  }

  /** Moerser-Granaten im hohen Bogen, mit Schatten am Zielort. */
  private syncShells(state: GameState): void {
    const seen = new Set<number>();
    for (const shell of state.shells) {
      seen.add(shell.id);
      let view = this.shells.get(shell.id);
      if (!view) {
        view = {
          shell: this.add.image(0, 0, TEX.shell).setDepth(DEPTH.effects),
          shadow: this.add.image(0, 0, TEX.shadow).setDepth(DEPTH.shadow).setScale(0.4),
        };
        this.shells.set(shell.id, view);
      }
      const u = Math.min(1, shell.t / shell.duration);
      const x = shell.x0 + (shell.x1 - shell.x0) * u;
      const y = shell.y0 + (shell.y1 - shell.y0) * u;
      const z = shell.z0 * (1 - u) + Math.sin(u * Math.PI) * 110;
      view.shell.setPosition(x, y - z);
      view.shadow.setPosition(x, y).setScale(0.3 + u * 0.5);
    }
    for (const [id, view] of this.shells) {
      if (!seen.has(id)) {
        view.shell.destroy();
        view.shadow.destroy();
        this.shells.delete(id);
      }
    }
  }

  /** Pfeil zur Strickleiter (wenn man unten ist) und das Seil der Seilwinde. */
  private drawHelpers(state: GameState, self: PlayerState | undefined): void {
    const f = state.fort;
    const below = !!self && self.alive && self.layer === "ground" && !self.transition;
    this.ladderArrow.setVisible(below && state.phase !== "won" && state.phase !== "lost");
    if (below) {
      const bounce = Math.abs(Math.sin(state.time * 5)) * 5;
      this.ladderArrow.setPosition(
        f.x + (LADDER.x0 + LADDER.x1) / 2,
        f.y + LADDER.y1 + 14 + bounce,
      );
    }
    this.rope.clear();
    for (const p of state.players) {
      if (p.transition?.kind === "winch") {
        const ax = f.x + WINCH_LANDING.x;
        const ay = f.y + WINCH_LANDING.y - ELEVATION - 18;
        this.rope.lineStyle(3, 0x120f1e, 1).lineBetween(ax, ay, p.x, p.y - p.z - 30);
        this.rope.lineStyle(1, 0xd8b878, 1).lineBetween(ax, ay, p.x, p.y - p.z - 30);
      }
    }
  }

  // --- Ereignisse ------------------------------------------------------------------------------

  private onEvent(event: GameEvent, state: GameState): void {
    switch (event.kind) {
      case "shot": {
        const flash = this.add
          .image(event.x, event.y - event.z, TEX.spark)
          .setDepth(DEPTH.effects)
          .setScale(1.5);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          scale: 0.5,
          duration: 90,
          onComplete: () => flash.destroy(),
        });
        if (this.time.now - this.lastShotSound > 110) {
          this.lastShotSound = this.time.now;
          audio.play("shoot");
        }
        break;
      }
      case "hit":
        this.enemies.flash(event.id);
        audio.play("hit");
        break;
      case "kill":
        this.bones(event.x, event.y);
        audio.play("enemyDied");
        break;
      case "stomp":
        this.ground.addPrint(event.x, event.y);
        this.dust(event.x, event.y, 3);
        break;
      case "pickup":
        this.floatText(`+${event.value}`, event.x, event.y - 20, "#e6eaf2", 14);
        audio.play("pickup");
        break;
      case "hullHit": {
        const spark = this.add
          .image(event.x, event.y - 16, TEX.spark)
          .setDepth(DEPTH.effects)
          .setTint(0xff8a2a);
        this.tweens.add({
          targets: spark,
          y: spark.y - 12,
          alpha: 0,
          duration: 260,
          onComplete: () => spark.destroy(),
        });
        break;
      }
      case "playerHit": {
        const b = this.players.get(event.id);
        if (b) {
          b.flash = 90;
        }
        if (event.id === this.session.selfId) {
          this.cameras.main.shake(90, 0.004);
        }
        audio.play("playerHit");
        break;
      }
      case "playerDown":
        if (event.id === this.session.selfId) {
          this.showBanner("MECH AUSGEFALLEN", T.bad);
          this.showHint(
            "down",
            "Kein Grund zur Panik: Nach ein paar Sekunden stehst du auf dem Deck wieder auf.",
          );
        }
        audio.play("playerDown");
        break;
      case "respawn":
        audio.play("revive");
        break;
      case "jump":
      case "climb":
        audio.play("swing");
        break;
      case "winch":
        audio.play("swing");
        if (event.id === this.session.selfId) {
          this.showHint(
            "winch",
            "Zu weit zurückgefallen: Die Seilwinde holt dich hoch. Das kostet Rumpf.",
          );
        }
        break;
      case "ability": {
        const p = state.players.find((x) => x.id === event.id);
        if (p) {
          const ring = this.add
            .circle(p.x, p.y - p.z - 26, 10, 0x6cf27a, 0)
            .setStrokeStyle(3, 0x6cf27a)
            .setDepth(DEPTH.effects);
          this.tweens.add({
            targets: ring,
            radius: 70,
            alpha: 0,
            duration: 420,
            onComplete: () => ring.destroy(),
          });
        }
        audio.play("superUsed");
        break;
      }
      case "repair":
        if (event.amount > 0) {
          this.floatText(
            `+${Math.round(event.amount)} Rumpf`,
            state.fort.x + 140,
            state.fort.y - ELEVATION - 10,
            T.good,
            18,
          );
          audio.play("healed");
        }
        break;
      case "arrived":
        if (state.phase === "rest") {
          this.showBanner(`${state.restAt.toUpperCase()} ERREICHT`, T.gold);
          this.floatText(
            `+${STATION_BONUS} Schrott: Fundstücke`,
            state.fort.x + 140,
            state.fort.y - ELEVATION - 30,
            "#e6eaf2",
            16,
          );
          audio.play("zoneReached");
          audio.setMusic("menu", 0.7);
        }
        break;
      case "depart":
        if (!state.march.horde) {
          this.showBanner(`WEITER: ${state.march.station.toUpperCase()}`, T.light);
        }
        if (state.march.storm) {
          this.queueHint(
            "storm",
            "Sandsturm: Ihr seht nur, was nah an der Festung ist – und die Warnpfeile fehlen.",
          );
        }
        audio.setMusic("wave");
        if (event.index === 0) {
          this.time.delayedCall(2200, () =>
            this.showHint(
              "start",
              "Über die Deckkante laufen: abspringen. Unter dem Bug hängt die Strickleiter zum Hochklettern.",
            ),
          );
        }
        break;
      case "zap":
        this.drawZap(event.points);
        break;
      case "boom":
        this.explosion(event.x, event.y, event.radius);
        break;
      case "mortar": {
        const m = state.modules.find((x) => x.uid === event.uid);
        if (m) {
          const top = ModuleView.top(state, m);
          this.dust(top.x, top.y + 10, 2);
        }
        audio.play("blast");
        break;
      }
      case "built":
      case "upgraded":
        audio.play("superReady");
        break;
      case "sold":
        audio.play("swing");
        break;
      case "trupp":
        this.showHint(
          "trupp",
          "Die Armee greift von allen Seiten an – rote Pfeile am Rand zeigen, woher der nächste Trupp kommt.",
        );
        break;
      case "enemyClimb":
        audio.play("swing");
        break;
      case "land":
        this.dust(event.x, event.y - ELEVATION, 2);
        break;
      case "ram":
        this.dust(event.x, event.y, 5);
        this.cameras.main.shake(160, 0.006);
        this.floatText("RAMMSTOSS!", event.x, event.y - 40, "#ff8a6a", 16);
        audio.play("blast");
        break;
      case "bridge":
        this.floatText("BRÜCKE!", event.x, event.y - ELEVATION - 30, "#ff8a6a", 16);
        audio.play("swing");
        break;
      case "shield":
        audio.play("superReady");
        break;
      case "ballista":
        audio.play("shoot");
        break;
      case "slamWarn":
        this.queueHint(
          "slam",
          "Rotes Feld auf dem Deck: Dort schlägt der Koloss gleich zu – weg da!",
        );
        break;
      case "slam":
        this.explosion(event.x, event.y - ELEVATION, 50);
        this.cameras.main.shake(260, 0.012);
        audio.play("blast");
        break;
      case "moduleHit": {
        const m = state.modules.find((x) => x.uid === event.uid);
        if (m) {
          const top = ModuleView.top(state, m);
          const spark = this.add
            .image(top.x + (Math.random() - 0.5) * 20, top.y + 14, TEX.spark)
            .setDepth(DEPTH.effects)
            .setTint(0xff8a2a);
          this.tweens.add({
            targets: spark,
            y: spark.y - 10,
            alpha: 0,
            duration: 240,
            onComplete: () => spark.destroy(),
          });
        }
        break;
      }
      case "moduleBroken": {
        const m = state.modules.find((x) => x.uid === event.uid);
        if (m) {
          const top = ModuleView.top(state, m);
          this.floatText("KAPUTT", top.x, top.y, T.bad, 15);
          this.dust(top.x, top.y + 20, 3);
        }
        this.queueHint(
          "broken",
          "Ein Modul ist kaputt. Der Schrauber flickt Module, neben denen er steht – an der Station wird alles wieder heil.",
        );
        audio.play("playerDown");
        break;
      }
      case "boss":
        this.showBanner("DER GOLDENE KOLOSS", T.bad);
        this.queueHint(
          "boss",
          "Der Endgegner läuft vor der Festung mit. Erst wenn er fällt, erreicht ihr das Ziel.",
        );
        audio.play("gameOver");
        break;
      case "bossDown":
        this.showBanner("KOLOSS GESTÜRZT!", T.gold);
        this.cameras.main.shake(400, 0.01);
        audio.play("zoneReached");
        break;
      case "horde":
        this.showBanner("HEERSCHAR!", T.bad);
        this.queueHint(
          "horde",
          "Die Armee hat euch eingeholt: Dieser Marsch wird hart. Danach habt ihr wieder etwas Vorsprung.",
        );
        audio.play("gameOver");
        break;
      case "lead":
        this.floatText(
          `Vorsprung ${event.amount > 0 ? "+" : ""}${event.amount}`,
          state.fort.x + 140,
          state.fort.y - ELEVATION - 50,
          event.amount > 0 ? T.good : T.gold,
          16,
        );
        break;
      case "loot":
        this.showBanner("PLÜNDERN!", T.gold);
        this.queueHint(
          "loot",
          "Ruine: Truhen am Boden – daneben stehen öffnet sie. Die Festung wartet, bis die Zeit um ist.",
        );
        break;
      case "chest":
        this.floatText(`Truhe: ${event.value}`, event.x, event.y - 34, T.gold, 16);
        this.dust(event.x, event.y, 3);
        audio.play("zoneReached");
        break;
      case "bonus":
      case "choice":
        this.floatText(event.text, state.fort.x + 140, state.fort.y - ELEVATION - 40, T.cyan, 16);
        audio.play("healed");
        break;
      case "won":
        this.showBanner("GESCHAFFT!", T.gold);
        audio.play("zoneReached");
        break;
      case "lost":
        this.showBanner("RUMPF ZERSTÖRT", T.bad);
        audio.play("gameOver");
        break;
    }
  }

  /** Blitz der Funkenspule: Zickzack-Linie von Ziel zu Ziel. */
  private drawZap(points: [number, number, number][]): void {
    const g = this.zaps;
    const path = points.map(([x, y, z]) => ({ x, y: y - z }));
    for (const [width, color] of [
      [5, 0x120f1e],
      [3, 0x5ef2e6],
      [1, 0xffffff],
    ] as const) {
      g.lineStyle(width, color, 1);
      g.beginPath();
      g.moveTo(path[0]!.x, path[0]!.y);
      for (let i = 1; i < path.length; i += 1) {
        const a = path[i - 1]!;
        const b = path[i]!;
        // Ein Knick in der Mitte macht aus der Linie einen Blitz.
        g.lineTo((a.x + b.x) / 2 + (i % 2 ? 6 : -6), (a.y + b.y) / 2 + (i % 2 ? -5 : 5));
        g.lineTo(b.x, b.y);
      }
      g.strokePath();
    }
    this.zapTime = 110;
    audio.play("hit");
  }

  private explosion(x: number, y: number, radius: number): void {
    const ring = this.add.circle(x, y - 6, radius * 0.4, 0xffd27a, 0.9).setDepth(y + 0.6);
    const core = this.add.circle(x, y - 8, radius * 0.3, 0xfffbe0, 1).setDepth(y + 0.7);
    this.tweens.add({
      targets: ring,
      radius,
      alpha: 0,
      duration: 320,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: core,
      alpha: 0,
      scale: 1.6,
      duration: 200,
      onComplete: () => core.destroy(),
    });
    this.dust(x, y, 4);
    this.cameras.main.shake(80, 0.002);
  }

  private bones(x: number, y: number): void {
    for (let i = 0; i < 5; i += 1) {
      const shard = this.add
        .image(x, y - 20, TEX.bone)
        .setDepth(y + 1)
        .setRotation(Math.random() * 3);
      const angle = Math.random() * Math.PI * 2;
      const distance = 14 + Math.random() * 20;
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance * 0.4,
        rotation: shard.rotation + 4,
        duration: 360,
        ease: "Quad.Out",
        onComplete: () =>
          this.tweens.add({
            targets: shard,
            alpha: 0,
            delay: 600,
            duration: 400,
            onComplete: () => shard.destroy(),
          }),
      });
    }
    this.dust(x, y, 2);
  }

  private dust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const puff = this.add
        .image(x + (Math.random() - 0.5) * 16, y - 2, TEX.dust)
        .setDepth(y + 0.5)
        .setScale(0.6);
      this.tweens.add({
        targets: puff,
        x: puff.x + (Math.random() - 0.5) * 24,
        y: puff.y - 8 - Math.random() * 8,
        scale: 1.4,
        alpha: 0,
        duration: 520,
        onComplete: () => puff.destroy(),
      });
    }
  }

  private floatText(text: string, x: number, y: number, color: string, size: number): void {
    const label = this.add
      .text(x, y, text, { fontFamily: FONT_BODY, fontSize: `${size}px`, color, fontStyle: "bold" })
      .setOrigin(0.5)
      .setStroke(T.outline, 4)
      .setDepth(DEPTH.effects + 1);
    this.tweens.add({
      targets: label,
      y: y - 26,
      alpha: 0,
      duration: 900,
      ease: "Quad.Out",
      onComplete: () => label.destroy(),
    });
  }

  private showBanner(text: string, color: string): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setColor(color).setAlpha(0).setScale(0.8);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 220, ease: "Back.Out" });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1800, duration: 400 });
  }

  // --- Hinweise fuer Neulinge (je einmal pro Lauf) --------------------------------------------------

  private showHint(key: string, text: string): void {
    this.queueHint(key, text);
  }

  /** Hinweise der Reihe nach zeigen, jeden nur einmal pro Lauf. */
  private queueHint(key: string, text: string): void {
    if (this.shown.has(key)) {
      return;
    }
    this.shown.add(key);
    this.hintQueue.push(text);
  }

  private nextHint(): void {
    if (this.hintQueue.length === 0 || this.time.now < this.hintUntil) {
      return;
    }
    const text = this.hintQueue.shift()!;
    this.hintUntil = this.time.now + 5200;
    this.tweens.killTweensOf(this.hint);
    this.hint.setText(text).setAlpha(0);
    this.tweens.add({ targets: this.hint, alpha: 1, duration: 250 });
    this.tweens.add({ targets: this.hint, alpha: 0, delay: 4600, duration: 500 });
  }

  private watchForHints(state: GameState, self: PlayerState | undefined): void {
    if (state.phase !== "march" || !self) {
      return;
    }
    const f = state.fort;
    // Jede Gegnerart stellt sich beim ersten Auftauchen kurz vor.
    for (const e of state.enemies) {
      const intro = ENEMY_INTRO[e.type];
      if (intro && !this.shown.has(`enemy-${e.type}`)) {
        this.queueHint(`enemy-${e.type}`, intro);
      }
    }
    if (
      self.layer === "deck" &&
      state.enemies.some((e) => e.attacking && insideRect(BLIND_SPOT, e.x - f.x, e.y - f.y))
    ) {
      this.showHint(
        "belly",
        "Gegner hacken unter dem Deck! Von oben trefft ihr sie nicht – spring ab und räum auf.",
      );
    } else if (state.scrap.length >= 3 && self.layer === "deck") {
      this.showHint(
        "scrap",
        "Schrott gibt es nur am Boden – und er bleibt zurück, während die Festung weiterläuft.",
      );
    }
  }

  // --- Pause und Ende ----------------------------------------------------------------------------

  private setPaused(paused: boolean): void {
    if (paused === this.paused || !this.session.canPause || this.ending) {
      return;
    }
    this.paused = paused;
    this.stick.release();
    this.stick.enabled = !paused;
    for (const cleanup of this.pauseCleanup) {
      cleanup();
    }
    this.pauseCleanup = [];
    if (!paused) {
      return;
    }
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    const shade = this.add
      .rectangle(0, 0, w, h, 0x0e0a12, 0.6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 20)
      .setInteractive();
    const panel = new ComicBox(this, BOX.panel, w / 2, h / 2, 320, 220);
    panel.container.setScrollFactor(0);
    panel.setDepth(DEPTH.hud + 21);
    const title = this.add
      .text(w / 2, h / 2 - 70, "PAUSE", { fontFamily: FONT_TITLE, fontSize: "48px", color: T.gold })
      .setOrigin(0.5)
      .setStroke(T.outline, 7)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 22);
    const resume = new Button(this, w / 2, h / 2 + 6, "WEITER", () => this.setPaused(false), {
      width: 220,
      height: 52,
      fontSize: 22,
    });
    const quit = new Button(this, w / 2, h / 2 + 68, "AUFGEBEN", () => this.scene.start("Title"), {
      width: 220,
      height: 44,
      fontSize: 18,
      variant: "secondary",
    });
    for (const button of [resume, quit]) {
      button.setScrollFactor(0);
      button.setDepth(DEPTH.hud + 22);
    }
    this.pauseCleanup = [
      () => shade.destroy(),
      () => panel.destroy(),
      () => title.destroy(),
      () => resume.destroy(),
      () => quit.destroy(),
    ];
  }

  private finish(state: GameState): void {
    this.ending = true;
    this.stick.release();
    this.stick.enabled = false;
    const self = state.players.find((p) => p.id === this.session.selfId);
    const result: GameResult = {
      won: state.phase === "won",
      marches: state.path.length - 1,
      count: state.map.layers - 1,
      kills: state.kills,
      scrap: self?.scrap ?? 0,
      seconds: Math.round(state.time),
      hull: Math.round(state.fort.hull),
    };
    this.time.delayedCall(2600, () => this.scene.start("Result", result));
  }
}
