/**
 * Die Arena: zeichnet den Zustand einer Spielsitzung und gibt Bewegung zurueck.
 *
 * Die Szene weiss nicht, ob solo, als Host oder als Client gespielt wird - sie
 * fragt die Sitzung (siehe `net/GameSession.ts`). Gerechnet wird hier nichts:
 * Positionen, Leben und Schaden kommen aus dem Zustand, Toene und Effekte aus
 * den Ereignissen.
 *
 * Zwischen den Wellen liegt der Shop als undurchsichtige Ebene darueber.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import type { SoundName } from "../audio/AudioEngine";
import { arenaKey, characterKey, enemyKey, weaponIconKey } from "../config/assets";
import { COLORS, PALETTE, SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { ARENA } from "../game/constants";
import { ENEMIES } from "../game/data/enemies";
import type { Enemy, GameEvent, PlayerState, Pickup, Projectile, SpawnMarker } from "../game/types";
import type { GameSession } from "../net/GameSession";
import { setReloadSafe } from "../platform/update";
import { Button } from "../ui/Button";
import { FloatingStick } from "../ui/FloatingStick";
import { Hud } from "../ui/Hud";
import { ARENA_WALL } from "../ui/comic";
import { menuText, woodPanel } from "../ui/menuStyle";
import { ShopPanel } from "../ui/ShopPanel";
import type { PlayMode } from "../app";

const ARENA_TOP = 64;
const OVERLAY_DEPTH = 9800;

interface Destroyable {
  destroy(): void;
}

interface EnemyView extends Destroyable {
  sprite: Phaser.GameObjects.Sprite;
  base: number;
  born: number;
  x: number;
  y: number;
}

interface PlayerView extends Destroyable {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  weapons: Phaser.GameObjects.Image[];
  weaponSignature: string;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
}

interface ShotView extends Destroyable {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

interface GameData {
  session: GameSession;
  mode: PlayMode;
}

export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private mode: PlayMode = "solo";
  private originX = 0;
  private originY = ARENA_TOP;

  private stick!: FloatingStick;
  private hud!: Hud;
  private shop!: ShopPanel;
  private bars!: Phaser.GameObjects.Graphics;
  private waitText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private pauseButton!: Button;
  private pauseObjects: { setVisible(visible: boolean): unknown }[] = [];
  private lostObjects: { setVisible(visible: boolean): unknown }[] = [];

  private enemies = new Map<number, EnemyView>();
  private players = new Map<string, PlayerView>();
  private shots = new Map<number, ShotView>();
  private pickups = new Map<number, Phaser.GameObjects.Image>();
  private markers: Phaser.GameObjects.Image[] = [];
  private selfRing!: Phaser.GameObjects.Ellipse;

  private paused = false;
  private pauseOpen = false;
  private ending = false;
  private lastPhase: string | null = null;
  private lastSound = new Map<string, number>();
  private floaters = 0;
  private lastWord = 0;
  private onVisibility = (): void => {};

  constructor() {
    super("Game");
  }

  init(data: GameData): void {
    this.session = data.session;
    this.mode = data.mode;
    this.enemies = new Map();
    this.players = new Map();
    this.shots = new Map();
    this.pickups = new Map();
    this.markers = [];
    this.paused = false;
    this.pauseOpen = false;
    this.ending = false;
    this.lastPhase = null;
    this.lastSound = new Map();
    this.floaters = 0;
    this.lastWord = 0;
    this.pauseObjects = [];
    this.lostObjects = [];
  }

  create(): void {
    setReloadSafe(false);
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.originX = Math.round((VIEWPORT.width - ARENA.width) / 2);
    this.originY = ARENA_TOP;

    this.buildArena();
    this.bars = this.add.graphics().setDepth(8000);
    this.selfRing = this.add.ellipse(0, 0, 34, 16).setStrokeStyle(2, 0xffd166, 0.9).setDepth(2);
    this.hud = new Hud(this);
    this.shop = new ShopPanel(this, (command) => this.session.send(command));

    const stickRegion = new Phaser.Geom.Rectangle(0, 56, VIEWPORT.width * 0.62, VIEWPORT.height - 56);
    this.stick = new FloatingStick(this, stickRegion);

    this.banner = this.add
      .text(VIEWPORT.width / 2, 200, "", {
        fontFamily: UI.font,
        fontSize: "56px",
        color: PALETTE.gold,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(9300)
      .setAlpha(0);

    this.waitText = this.add
      .text(VIEWPORT.width / 2, VIEWPORT.height / 2, "Warte auf den Host …", {
        fontFamily: UI.font,
        fontSize: "28px",
        color: UI.text.body,
        fontStyle: "bold",
        backgroundColor: "#000000aa",
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(9900)
      .setVisible(false);

    this.pauseButton = new Button(this, VIEWPORT.width - SAFE.right - 38, 28, "II", () => this.openPause(), {
      width: 52,
      height: 44,
      fontSize: 20,
      variant: "secondary",
    });
    this.pauseButton.setDepth(9500);

    this.buildPauseOverlay();
    this.buildLostOverlay();

    this.onVisibility = (): void => {
      if (document.hidden && this.session.canPause && this.session.view.state.phase === "wave") {
        this.openPause();
      }
    };
    document.addEventListener("visibilitychange", this.onVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener("visibilitychange", this.onVisibility);
      this.stick.destroy();
      this.session.destroy();
    });
  }

  // --- Aufbau -------------------------------------------------------------

  private buildArena(): void {
    this.add.image(VIEWPORT.width / 2, VIEWPORT.height / 2, "bg-game").setDepth(-100);
    this.add
      .image(this.originX - ARENA_WALL, this.originY - ARENA_WALL, arenaKey)
      .setOrigin(0)
      .setDisplaySize(ARENA.width + ARENA_WALL * 2, ARENA.height + ARENA_WALL * 2)
      .setDepth(0);
  }

  private overlayBox(
    title: string,
    hint: string,
    buttons: { label: string; onClick: () => void; primary: boolean }[],
  ): { setVisible(visible: boolean): unknown }[] {
    const cx = VIEWPORT.width / 2;
    const objects: { setVisible(visible: boolean): unknown }[] = [];
    const dim = this.add.rectangle(0, 0, 2000, 1200, 0x000000, 0.65).setOrigin(0).setDepth(OVERLAY_DEPTH).setInteractive();
    objects.push(dim);
    objects.push(woodPanel(this, cx, 270, 440, 300).setDepth(OVERLAY_DEPTH + 1));
    objects.push(menuText(this, cx, 156, title, 36, UI.text.title, true).setDepth(OVERLAY_DEPTH + 2));
    const hintText = menuText(this, cx, 205, hint, 17, UI.text.muted).setDepth(OVERLAY_DEPTH + 2);
    hintText.setWordWrapWidth(380);
    objects.push(hintText);
    buttons.forEach((entry, index) => {
      const button = new Button(this, cx, 262 + index * 70, entry.label, entry.onClick, {
        width: 320,
        height: 56,
        fontSize: 22,
        variant: entry.primary ? "primary" : "secondary",
      });
      button.setDepth(OVERLAY_DEPTH + 3);
      objects.push(button);
    });
    for (const object of objects) {
      object.setVisible(false);
    }
    return objects;
  }

  private buildPauseOverlay(): void {
    const solo = this.session.canPause;
    this.pauseObjects = this.overlayBox(
      solo ? "Pause" : "Menü",
      solo ? "Die Runde wartet auf dich." : "Achtung: Die Runde läuft weiter – der Host rechnet für alle.",
      [
        { label: solo ? "Weiter" : "Weiter spielen", onClick: () => this.closePause(), primary: true },
        { label: solo ? "Runde aufgeben" : "Runde verlassen", onClick: () => this.leave(), primary: false },
      ],
    );
  }

  private buildLostOverlay(): void {
    this.lostObjects = this.overlayBox("Verbindung weg", "", [
      { label: "Zurück zum Menü", onClick: () => this.leave(), primary: true },
    ]);
  }

  private openPause(): void {
    if (this.paused || this.ending || this.session.view.state.phase !== "wave") {
      return;
    }
    this.paused = this.session.canPause;
    this.stick.release();
    this.stick.enabled = false;
    for (const object of this.pauseObjects) {
      object.setVisible(true);
    }
    this.pauseOpen = true;
    if (this.paused) {
      audio.setMusic(null);
    }
  }

  private closePause(): void {
    this.paused = false;
    this.pauseOpen = false;
    this.stick.enabled = this.session.view.state.phase === "wave";
    for (const object of this.pauseObjects) {
      object.setVisible(false);
    }
    audio.setMusic("wave");
  }

  private leave(): void {
    this.scene.start("Title");
  }

  // --- Takt ---------------------------------------------------------------

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    const session = this.session;

    if (session.connectionLost && !this.ending) {
      this.showConnectionLost(session.connectionLost);
      return;
    }

    if (!this.paused) {
      session.update(dt, this.stick.value);
    }
    const view = session.view;
    const state = view.state;
    this.waitText.setVisible(!session.isReady);

    if (!this.paused) {
      for (const event of view.events) {
        this.handleEvent(event, time);
      }
    }

    this.handlePhase(state.phase);

    const self = state.players.find((player) => player.id === session.selfId);
    this.hud.update(state, self, session.selfId);
    this.shop.update(state, self);

    if (state.phase !== "shop") {
      this.draw(dt, time, self);
    }
  }

  private handlePhase(phase: string): void {
    if (phase === this.lastPhase) {
      return;
    }
    this.lastPhase = phase;
    if (phase === "shop") {
      this.stick.release();
      this.stick.enabled = false;
      this.shop.setVisible(true);
      this.hud.setVisible(false);
      this.pauseButton.setVisible(false);
      audio.setMusic("menu", 0.35);
    } else if (phase === "wave") {
      this.shop.setVisible(false);
      this.hud.setVisible(true);
      this.pauseButton.setVisible(true);
      this.stick.enabled = !this.pauseOpen;
      audio.setMusic("wave");
    } else if (!this.ending) {
      this.ending = true;
      this.stick.release();
      this.stick.enabled = false;
      audio.setMusic("menu", 0.5);
      if (phase === "lost") {
        this.playSound("gameOver", 0);
      }
      this.time.delayedCall(1600, () => this.finish(phase === "won"));
    }
  }

  private finish(won: boolean): void {
    const state = this.session.view.state;
    const self = state.players.find((player) => player.id === this.session.selfId);
    this.scene.start("Result", {
      won,
      wave: state.wave,
      kills: self?.kills ?? 0,
      level: self?.level ?? 0,
      items: self ? self.items.reduce((sum, count) => sum + count, 0) : 0,
      name: self?.name ?? "",
      mode: this.mode,
    });
  }

  private showConnectionLost(message: string): void {
    if (this.ending) {
      return;
    }
    this.ending = true;
    this.stick.enabled = false;
    this.stick.release();
    for (const object of this.lostObjects) {
      object.setVisible(true);
    }
    this.add
      .text(VIEWPORT.width / 2, 205, message, {
        fontFamily: UI.font,
        fontSize: "17px",
        color: UI.text.muted,
        align: "center",
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH + 3);
  }

  // --- Zeichnen -----------------------------------------------------------

  private draw(dt: number, time: number, self: PlayerState | undefined): void {
    const state = this.session.view.state;
    // Im Koop kommen Zustaende nur 15-mal pro Sekunde: dazwischen gleitet alles
    // sanft zum neuen Ziel, statt zu springen. Solo wird direkt gesetzt.
    const k = this.session.isMultiplayer ? 1 - Math.exp(-dt * 0.022) : 1;

    this.bars.clear();

    this.sync(
      this.enemies,
      state.enemies,
      (enemy) => enemy.id,
      (enemy) => this.makeEnemy(enemy),
      (enemyView, enemy) => this.applyEnemy(enemyView, enemy, k),
    );
    this.sync(
      this.players,
      state.players,
      (player) => player.id,
      (player) => this.makePlayer(player),
      (playerView, player) => this.applyPlayer(playerView, player, k, time),
    );
    this.sync(
      this.shots,
      state.shots,
      (shot) => shot.id,
      (shot) => this.makeShot(shot),
      (shotView, shot) => this.applyShot(shotView, shot, Math.min(1, k * 1.6)),
    );
    this.sync(
      this.pickups,
      state.pickups,
      (pickup) => pickup.id,
      (pickup) => this.makePickup(pickup),
      (image, pickup) => image.setPosition(this.originX + pickup.x, this.originY + pickup.y + Math.sin(time / 180 + pickup.id) * 2),
    );
    this.syncMarkers(state.markers, time);

    const selfView = self ? this.players.get(self.id) : undefined;
    if (selfView) {
      this.selfRing.setVisible(true).setPosition(selfView.x, selfView.y + 11).setDepth(2);
    } else {
      this.selfRing.setVisible(false);
    }
  }

  private sync<K, S, V extends Destroyable>(
    map: Map<K, V>,
    items: readonly S[],
    key: (item: S) => K,
    make: (item: S) => V,
    apply: (view: V, item: S) => void,
  ): void {
    const seen = new Set<K>();
    for (const item of items) {
      const id = key(item);
      seen.add(id);
      let view = map.get(id);
      if (!view) {
        view = make(item);
        map.set(id, view);
      }
      apply(view, item);
    }
    for (const [id, view] of map) {
      if (!seen.has(id)) {
        view.destroy();
        map.delete(id);
      }
    }
  }

  private makeEnemy(enemy: Enemy): EnemyView {
    const def = ENEMIES[enemy.type];
    const base = def.radius / 24;
    const sprite = this.add.sprite(0, 0, enemyKey(enemy.type)).setScale(0);
    const view: EnemyView = {
      sprite,
      base,
      born: this.time.now,
      x: this.originX + enemy.x,
      y: this.originY + enemy.y,
      destroy: () => sprite.destroy(),
    };
    sprite.setPosition(view.x, view.y);
    return view;
  }

  private applyEnemy(view: EnemyView, enemy: Enemy, k: number): void {
    const targetX = this.originX + enemy.x;
    const targetY = this.originY + enemy.y;
    view.x += (targetX - view.x) * k;
    view.y += (targetY - view.y) * k;
    const now = this.time.now;
    // Aufploppen beim Erscheinen, danach wackelt der Gegner im Takt seiner Schritte.
    const pop = Phaser.Math.Easing.Back.Out(Math.min(1, (now - view.born) / 220));
    const phase = now / 105 + enemy.id * 1.7;
    const windup = enemy.mode === "windup";
    const squash = Math.sin(phase) * (windup ? 0.14 : 0.07);
    view.sprite
      .setPosition(view.x, view.y - Math.abs(Math.sin(phase)) * 2)
      .setDepth(100 + view.y)
      .setScale(view.base * pop * (1 - squash), view.base * pop * (1 + squash))
      .setAngle(Math.sin(phase) * (windup ? 14 : 6));
    if (Math.abs(enemy.dirX) > 0.05) {
      view.sprite.setFlipX(enemy.dirX < 0);
    }
    if (enemy.flash > 0) {
      view.sprite.setTintFill(0xffffff);
    } else if (windup) {
      view.sprite.setTint(0xff9a9a);
    } else {
      view.sprite.clearTint();
    }

    if (enemy.hp < enemy.maxHp) {
      const r = ENEMIES[enemy.type].radius;
      const width = Math.max(20, r * 2);
      const fraction = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
      const bx = view.x - width / 2;
      const by = view.y - r - 12;
      this.bars.fillStyle(0x14101c, 1).fillRoundedRect(bx - 2, by - 2, width + 4, 8, 3);
      this.bars.fillStyle(COLORS.hpEnemy, 1).fillRoundedRect(bx, by, width * fraction, 4, 2);
    }
  }

  private makePlayer(player: PlayerState): PlayerView {
    const sprite = this.add.sprite(0, 0, characterKey(player.character)).setScale(0.5);
    const shadow = this.add.image(0, 0, "shadow").setDisplaySize(34, 16).setAlpha(0.9);
    const name = this.add
      .text(0, 0, this.session.isMultiplayer ? player.name : "", {
        fontFamily: UI.font,
        fontSize: "12px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 1)
      .setShadow(1, 1, "#000000", 2)
      .setDepth(8100);
    const view: PlayerView = {
      sprite,
      shadow,
      name,
      weapons: [],
      weaponSignature: "",
      x: this.originX + player.x,
      y: this.originY + player.y,
      lastX: this.originX + player.x,
      lastY: this.originY + player.y,
      destroy: () => {
        sprite.destroy();
        shadow.destroy();
        name.destroy();
        for (const image of view.weapons) {
          image.destroy();
        }
      },
    };
    return view;
  }

  private applyPlayer(view: PlayerView, player: PlayerState, k: number, time: number): void {
    const isSelf = player.id === this.session.selfId;
    const own = isSelf ? this.session.selfPosition() : null;
    const targetX = this.originX + (own ? own.x : player.x);
    const targetY = this.originY + (own ? own.y : player.y);
    if (isSelf) {
      view.x = targetX;
      view.y = targetY;
    } else {
      view.x += (targetX - view.x) * k;
      view.y += (targetY - view.y) * k;
    }

    const depth = 100 + view.y;
    // Laeuft die Figur, huepft sie leicht und wippt - wie in einem Zeichentrickfilm.
    const moving = Math.abs(view.x - view.lastX) + Math.abs(view.y - view.lastY) > 0.25;
    view.lastX = view.x;
    view.lastY = view.y;
    const bob = moving && player.alive ? Math.abs(Math.sin(time / 75)) * 3.5 : 0;
    view.sprite.setPosition(view.x, view.y - bob).setDepth(depth);
    view.shadow.setPosition(view.x, view.y + 11).setDepth(depth - 1);
    view.sprite.setFlipX(Math.cos(player.facing) < 0);
    view.sprite.setAngle(!player.alive ? 90 : moving ? Math.sin(time / 75) * 7 : 0);
    const blink = player.iframes > 0 && Math.floor(time / 70) % 2 === 0;
    view.sprite.setAlpha(!player.alive ? 0.45 : blink ? 0.5 : 1);
    view.name.setPosition(view.x, view.y - 32).setVisible(player.alive);

    // Waffen kreisen um die Figur.
    const signature = player.weapons.map((weapon) => weapon.id).join(",");
    if (signature !== view.weaponSignature) {
      view.weaponSignature = signature;
      for (const image of view.weapons) {
        image.destroy();
      }
      view.weapons = player.weapons.map((weapon) => this.add.image(0, 0, weaponIconKey(weapon.id)).setDisplaySize(22, 22));
    }
    const count = view.weapons.length;
    view.weapons.forEach((image, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(1, count)) * Math.PI * 2;
      image
        .setPosition(view.x + Math.cos(angle) * 21, view.y + Math.sin(angle) * 17)
        .setDepth(depth + 1)
        .setVisible(player.alive);
    });

    if (player.alive) {
      const fraction = Phaser.Math.Clamp(player.hp / player.stats.maxHp, 0, 1);
      this.bars.fillStyle(0x14101c, 1).fillRoundedRect(view.x - 19, view.y - 29, 38, 9, 3);
      this.bars.fillStyle(COLORS.hpPlayer, 1).fillRoundedRect(view.x - 17, view.y - 27, 34 * fraction, 5, 2);
    }
  }

  private makeShot(shot: Projectile): ShotView {
    const size = Math.max(11, shot.radius * 2.8);
    const image = this.add
      .image(0, 0, "bullet")
      .setDisplaySize(size, size)
      .setTint(shot.friendly ? COLORS.playerBullet : COLORS.enemyBullet)
      .setDepth(5000);
    return { image, x: this.originX + shot.x, y: this.originY + shot.y, destroy: () => image.destroy() };
  }

  private applyShot(view: ShotView, shot: Projectile, k: number): void {
    const targetX = this.originX + shot.x;
    const targetY = this.originY + shot.y;
    view.x += (targetX - view.x) * k;
    view.y += (targetY - view.y) * k;
    view.image.setPosition(view.x, view.y);
  }

  private makePickup(pickup: Pickup): Phaser.GameObjects.Image {
    return this.add
      .image(this.originX + pickup.x, this.originY + pickup.y, "gem")
      .setDisplaySize(17, 17)
      .setDepth(3);
  }

  private syncMarkers(markers: readonly SpawnMarker[], time: number): void {
    while (this.markers.length < markers.length) {
      this.markers.push(this.add.image(0, 0, "marker").setDisplaySize(26, 26).setDepth(4));
    }
    this.markers.forEach((image, index) => {
      const marker = markers[index];
      if (!marker) {
        image.setVisible(false);
        return;
      }
      image
        .setVisible(true)
        .setPosition(this.originX + marker.x, this.originY + marker.y)
        .setAlpha(0.45 + 0.4 * Math.abs(Math.sin(time / 90)));
    });
  }

  // --- Ereignisse: Toene und Effekte ----------------------------------------

  /** Spielt einen Ton, aber nicht oefter als alle `gapMs` - bei 50 Treffern pro Sekunde waere das Krach. */
  private playSound(name: SoundName, gapMs: number): void {
    const now = this.time.now;
    const last = this.lastSound.get(name) ?? -1e9;
    if (now - last < gapMs) {
      return;
    }
    this.lastSound.set(name, now);
    audio.play(name);
  }

  private handleEvent(event: GameEvent, _time: number): void {
    const selfId = this.session.selfId;
    switch (event.t) {
      case "hit":
        if (event.enemy) {
          this.floater(event.x, event.y - 10, String(Math.round(event.dmg)), event.crit ? PALETTE.gold : "#ffffff", event.crit ? 22 : 15);
          if (event.crit && this.time.now - this.lastWord > 140) {
            this.lastWord = this.time.now;
            this.comic(event.x, event.y - 8, "KRIT!", PALETTE.gold);
          }
          this.playSound("hit", 55);
        } else {
          this.floater(event.x, event.y - 18, `-${Math.round(event.dmg)}`, PALETTE.danger, 20);
          this.playSound("playerHit", 120);
          this.cameras.main.shake(90, 0.003);
        }
        break;
      case "kill":
        this.burst(event.x, event.y, event.big ? 12 : 5, event.big ? 0xffd166 : 0xcfe8a0);
        if (event.big) {
          this.comic(event.x, event.y, ["BAM!", "POW!", "ZACK!", "WUMM!"][Math.floor(Math.random() * 4)] ?? "BAM!", "#ff7a5c");
        }
        this.playSound("enemyDied", 45);
        break;
      case "shot":
        if (event.kind === "melee") {
          this.swing(event.x, event.y, event.angle);
          this.playSound("swing", 70);
        } else {
          this.playSound("shoot", 70);
        }
        break;
      case "pickup":
        if (event.pid === selfId) {
          this.playSound("pickup", 40);
        }
        break;
      case "heal":
        if (event.pid === selfId && event.amount >= 1) {
          this.floater(event.x, event.y - 18, `+${Math.round(event.amount)}`, PALETTE.success, 18);
          this.playSound("healed", 250);
        }
        break;
      case "dodge":
        this.floater(event.x, event.y - 18, "Ausgewichen", "#cfe8ff", 14);
        break;
      case "down":
        this.playSound("playerDown", 200);
        break;
      case "revive":
        this.playSound("revive", 200);
        break;
      case "waveStart":
        this.announce(`Welle ${event.wave}`);
        this.playSound("zoneReached", 0);
        break;
      case "waveEnd":
        this.announce("Geschafft!");
        this.playSound("superReady", 0);
        break;
      case "levelUp":
        if (event.pid === selfId) {
          this.playSound("superReady", 100);
        }
        break;
      case "bought":
        if (event.pid === selfId) {
          this.playSound("pickup", 40);
        }
        break;
      case "enemyShot":
        this.playSound("enemyShoot", 80);
        break;
    }
  }

  private announce(text: string): void {
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 180, ease: "Back.Out" });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 900, duration: 400 });
  }

  private floater(x: number, y: number, value: string, color: string, size: number): void {
    if (this.floaters > 36) {
      return;
    }
    this.floaters += 1;
    const text = this.add
      .text(this.originX + x, this.originY + y, value, {
        fontFamily: UI.font,
        fontSize: `${size}px`,
        color,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(9000);
    this.tweens.add({
      targets: text,
      y: text.y - 26,
      alpha: 0,
      duration: 650,
      ease: "Quad.Out",
      onComplete: () => {
        text.destroy();
        this.floaters -= 1;
      },
    });
  }

  /** Ein Comic-Wort ("BAM!") springt auf, wackelt und verschwindet. */
  private comic(x: number, y: number, word: string, color: string): void {
    if (this.floaters > 30) {
      return;
    }
    this.floaters += 1;
    const text = this.add
      .text(this.originX + x, this.originY + y - 16, word, {
        fontFamily: UI.font,
        fontSize: "30px",
        color,
        fontStyle: "italic 900",
        stroke: "#14101c",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(9100)
      .setAngle(Phaser.Math.Between(-14, 14))
      .setScale(0.3);
    this.tweens.add({ targets: text, scale: 1.15, duration: 120, ease: "Back.Out" });
    this.tweens.add({
      targets: text,
      y: text.y - 22,
      alpha: 0,
      delay: 300,
      duration: 380,
      onComplete: () => {
        text.destroy();
        this.floaters -= 1;
      },
    });
  }

  private burst(x: number, y: number, count: number, color: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random();
      const distance = 16 + Math.random() * 20;
      const piece = this.add.star(this.originX + x, this.originY + y, 5, 2, 5, color).setStrokeStyle(1.5, 0x14101c).setDepth(8500);
      this.tweens.add({
        targets: piece,
        x: piece.x + Math.cos(angle) * distance,
        y: piece.y + Math.sin(angle) * distance,
        alpha: 0,
        angle: 180,
        duration: 380,
        onComplete: () => piece.destroy(),
      });
    }
  }

  private swing(x: number, y: number, angle: number): void {
    const arc = this.add.graphics().setDepth(8600);
    arc.lineStyle(5, 0xffffff, 0.85);
    arc.beginPath();
    arc.arc(this.originX + x, this.originY + y, 30, angle - 0.8, angle + 0.8);
    arc.strokePath();
    this.tweens.add({ targets: arc, alpha: 0, duration: 160, onComplete: () => arc.destroy() });
  }
}
