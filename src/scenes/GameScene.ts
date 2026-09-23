/**
 * Die Spielszene. Ihre einzige Aufgabe ist Darstellung und Eingabe:
 *
 *   Eingabe einsammeln -> Runde weiterlaufen lassen -> Zustand zeichnen
 *
 * Bewusst keine Spiellogik hier. Und bewusst kein Wissen darueber, ob die Runde
 * allein, als Host oder als Client laeuft: Das steckt hinter `GameSession`.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { playEventSounds } from "../audio/eventSounds";
import { ABILITIES, CHARACTERS, PLAYER, SUPERS, WORLD } from "../config/balance";
import { COLORS, DEPTH } from "../config/constants";
import type { GameSession } from "../net/GameSession";
import { SoloSession } from "../net/SoloSession";
import { ArenaRenderer } from "../render/ArenaRenderer";
import { CameraController } from "../render/CameraController";
import { EntityRenderer } from "../render/EntityRenderer";
import { Juice } from "../render/Juice";
import { setReloadSafe } from "../platform/update";
import { hideValuesOverlay, updateValuesOverlay } from "../platform/valuesOverlay";
import { loadHighscore } from "../storage/highscore";
import { distanceFromStart } from "../systems/spawning";
import { nearestEnemy } from "../systems/targeting";
import { emptyInput } from "../systems/types";
import type { CharacterId, InputState, PlayerState, Vec2 } from "../systems/types";
import { createHudModel } from "../ui/HudModel";
import type { HudModel } from "../ui/HudModel";
import { HudScene } from "./HudScene";

/**
 * ================================================================
 * MUSIK: DER WECHSEL IST DAS SIGNAL - NUR HAENGT ER JETZT WORANDERS
 * ================================================================
 *
 * Frueher war die Regel an die Rundenphase geknuepft: leise in der Pause,
 * treibend waehrend der Welle. Seit Phase 8 gibt es keine Wellen und keine
 * Pause mehr - die Regel haette gar keinen Ausloeser mehr.
 *
 * Jetzt entscheidet die Lage: Ist ein Gegner nah, laeuft das treibende Stueck
 * in voller Lautstaerke; ist laengere Zeit keiner in der Naehe, wird es leise
 * und ruhig. Der Gedanke bleibt derselbe, und er passt sogar besser zur
 * offenen Welt: Die Musik sagt einem, dass etwas kommt, bevor man es sieht.
 *
 * ZWEI SCHWELLEN STATT EINER, und das ist der ganze Trick: Mit nur einer
 * Grenze wuerde ein Gegner, der genau auf ihr herumlaeuft, die Musik im
 * Sekundentakt umschalten lassen. Einschalten passiert nah und sofort,
 * ausschalten erst weiter weg und erst nach ein paar ruhigen Sekunden.
 */
const COMBAT_ENTER_RANGE = 900;
const COMBAT_LEAVE_RANGE = 1300;
const COMBAT_LEAVE_SECONDS = 4;
/** Lautstaerke des ruhigen Stuecks, als Anteil der vollen. */
const CALM_MUSIC_VOLUME = 0.35;

export interface GameSceneData {
  character?: CharacterId;
  /** Gesetzt, wenn die Runde aus der Lobby kommt. Sonst wird solo gespielt. */
  session?: GameSession;
}

export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private cameraController!: CameraController;
  private arena!: ArenaRenderer;
  private entities!: EntityRenderer;
  private juice!: Juice;

  private aimLine!: Phaser.GameObjects.Graphics;
  private hudModel: HudModel = createHudModel();
  /** Wie lange schon kein Gegner mehr in der Naehe war - steuert die Musik. */
  private calmSeconds = COMBAT_LEAVE_SECONDS;
  private hud?: HudScene;
  private character: CharacterId = "scout";
  private finished = false;

  /**
   * Zwei verschiedene Dinge, die man leicht verwechselt:
   *
   *   overlayOpen  Der Zwischenbildschirm ist zu sehen. Das geht IMMER, auch
   *                im Koop - es ist nur eine Anzeige.
   *   paused       Die Simulation bekommt keine Zeit mehr. Das geht NUR solo.
   *                Im Koop rechnet der Host die Runde fuer alle; ein Geraet,
   *                das fuer sich anhaelt, muesste beim Weitermachen entweder
   *                minutenlang nachrechnen oder springen.
   *
   * Frueher gab es nur `paused`, und weil das im Koop nicht geht, gab es dort
   * auch keinen Zwischenbildschirm - der Knopf warf einen ohne Rueckfrage aus
   * der Runde. Genau das war die Beschwerde. Die Rueckfrage braucht aber gar
   * kein Anhalten, sie braucht nur eine Anzeige.
   */
  private overlayOpen = false;
  private paused = false;

  constructor() {
    super("Game");
  }

  init(data: GameSceneData): void {
    this.character = data.character ?? "scout";
    this.finished = false;
    this.hudModel = createHudModel();
    this.hudModel.highscore = loadHighscore()?.score ?? 0;

    this.session =
      data.session ?? new SoloSession({ id: "local", name: "Du", character: this.character });
  }

  create(): void {
    this.arena = new ArenaRenderer(this, this.session.view.state);
    this.juice = new Juice(this);
    this.entities = new EntityRenderer(this, this.session.view, this.session.selfId);
    // Grenzen aus der GENERIERTEN Welt, nicht aus der alten Konstanten: Jeder
    // Run hat seine eigene Karte, und die Kamera darf genau bis an deren Rand.
    const bounds = this.session.view.state.bounds;
    this.cameraController = new CameraController(this, bounds.width, bounds.height);
    this.aimLine = this.add.graphics().setDepth(DEPTH.projectiles);

    this.scene.launch("Hud", {
      model: this.hudModel,
      canPause: this.session.canPause,
      onPause: () => this.setPaused(true),
      onResume: () => this.setPaused(false),
      onQuit: () => {
        this.scene.stop("Hud");
        this.scene.start("Menu");
      },
    });
    this.hud = this.scene.get("Hud") as HudScene;

    /*
     * Von selbst anhalten, wenn die App in den Hintergrund geht.
     *
     * DER FALL, UM DEN ES GEHT: Ein Anruf, eine Nachricht, kurz etwas
     * nachschauen. Vorher lief die Runde dabei weiter, und man kam mit deutlich
     * weniger Leben zurueck - oder gar nicht. Die Simulation verwirft nach
     * einem langen Haenger zwar die aufgelaufene Zeit (`MAX_TICKS_PER_FRAME`),
     * aber die Gegner haben in den Sekunden davor weiter zugeschlagen.
     *
     * Im Koop wird nicht angehalten: Dort rechnet der Host weiter, und ein
     * Client, der fuer sich stehenbleibt, geriete nur aus dem Takt.
     */
    if (this.session.canPause) {
      document.addEventListener("visibilitychange", this.onVisibilityChange);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        document.removeEventListener("visibilitychange", this.onVisibilityChange);
      });
    }

    // Ab jetzt laeuft eine Runde: Eine neue Version darf erst im Menue greifen,
    // sonst reisst ein Neustart die Runde mitten im Gefecht ab.
    setReloadSafe(false);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      hideValuesOverlay();
      this.scene.stop("Hud");
      this.session.destroy();
      this.cameraController.destroy();
      this.entities.destroy();
      this.juice.destroy();
      this.arena.destroy();
    });
  }

  update(_time: number, delta: number): void {
    const player = this.selfPlayer();
    // Die HudScene startet ein Bild spaeter als diese Szene. Solange sie nicht
    // bereit ist, gibt es noch keine Eingabe - ein Bild ohne Steuerung faellt
    // niemandem auf, ein Absturz schon.
    if (!player || !this.hud?.ready) {
      return;
    }

    if (this.paused) {
      /*
       * Angehalten: Die Simulation bekommt keine Zeit. Einmalige Wuensche
       * werden trotzdem geloescht - sonst laege ein Schuss oder eine Faehigkeit
       * aus dem Moment des Anhaltens bereit und ginge beim Weitermachen sofort
       * los, ohne dass jemand den Knopf gedrueckt haette.
       */
      this.hud.inputManager.clearOneShots();
      return;
    }

    /*
     * Zwischenbildschirm offen, aber die Runde laeuft weiter (Koop).
     *
     * Dann wird eine LEERE Eingabe geschickt statt der echten. Der dunkle
     * Hintergrund liegt zwar ueber den Knoepfen, aber die Touch-Steuerung
     * hoert auf die ganze Szene - ein Daumen, der auf "Weiter spielen" zielt,
     * wuerde sonst nebenbei den Joystick ziehen oder einen Schuss ausloesen.
     * Stehenbleiben ist das ehrlichere Verhalten: Man spielt gerade nicht.
     */
    const input = this.overlayOpen ? emptyInput() : this.hud.inputManager.getState();
    if (this.overlayOpen) {
      this.hud.inputManager.clearOneShots();
    }

    // Beim Super laeuft die Zeit kurz langsamer. Die Simulation merkt davon
    // nichts - sie bekommt einfach weniger Zeit zugeteilt.
    this.juice.update(delta);
    const consumed = this.session.update(delta * this.juice.currentTimeScale, input);
    if (consumed) {
      // Einmalige Wuensche (Schuss, Super) erst loeschen, wenn sie verarbeitet
      // wurden - sonst geht ein Klick zwischen zwei Ticks verloren.
      this.hud.inputManager.clearOneShots();
    }

    this.handleEvents();
    this.updateValues(player, delta);
    this.checkConnection();
    this.entities.update();
    this.drawAim(player, input);
    this.updateHudModel(player);
    this.updateMusic(delta);

    // Boden, Deckung und Buesche nach Kamerasicht ein- und ausblenden. In einer
    // Welt dieser Groesse ist das der Unterschied zwischen "laeuft" und "ruckelt".
    this.arena.update();

    this.cameraController.update(
      this.session.view.state.players.map((entry) => ({
        position: this.session.view.renderPlayerPosition(entry.id),
        isSelf: entry.id === this.session.selfId,
        down: entry.down,
      })),
    );
  }

  /**
   * Welche Musik gerade laufen soll.
   *
   *   Gefecht            das treibende Stueck, volle Lautstaerke
   *   dazwischen         das ruhige Stueck, deutlich leiser
   *   angehalten (solo)  nichts
   *
   * Der WECHSEL ist das Signal, nicht die Stille: Solange niemand in der Naehe
   * ist, laeuft leise das ruhige Stueck; setzt das treibende in voller
   * Lautstaerke ein, ist etwas im Anmarsch. Das hoert man auch dann, wenn man
   * gerade nicht auf den Bildschirm schaut - in einer offenen Welt sogar,
   * BEVOR man den Gegner sieht. Und anders als bei voelliger Stille wirkt die
   * ruhige Phase nicht wie ein Aussetzer.
   *
   * Angehalten bleibt es still: Musik, die weiterlaeuft, waehrend das Bild
   * steht, klingt nach Absturz.
   *
   * `setMusic` prueft selbst, ob sich ueberhaupt etwas aendert - deshalb darf
   * das hier jedes Bild gerufen werden.
   */
  private updateMusic(delta: number): void {
    if (this.paused || this.finished) {
      audio.setMusic(null);
      return;
    }

    const distance = this.nearestEnemyDistance();

    if (distance < COMBAT_ENTER_RANGE) {
      this.calmSeconds = 0;
    } else if (distance > COMBAT_LEAVE_RANGE) {
      this.calmSeconds += delta / 1000;
    }

    if (this.calmSeconds >= COMBAT_LEAVE_SECONDS) {
      audio.setMusic("menu", CALM_MUSIC_VOLUME);
    } else {
      audio.setMusic("wave", 1);
    }
  }

  /** Abstand zum naechsten Gegner - oder unendlich, wenn keiner da ist. */
  private nearestEnemyDistance(): number {
    const state = this.session.view.state;
    const self = state.players.find((entry) => entry.id === this.session.selfId);
    if (!self) {
      return Number.POSITIVE_INFINITY;
    }

    let nearest = Number.POSITIVE_INFINITY;
    for (const enemy of state.enemies) {
      nearest = Math.min(
        nearest,
        Math.hypot(enemy.position.x - self.position.x, enemy.position.y - self.position.y),
      );
    }
    return nearest;
  }

  /**
   * Oeffnet oder schliesst den Zwischenbildschirm.
   *
   * Solo wird dabei wirklich angehalten, im Koop nur angezeigt. Diese eine
   * Unterscheidung steht absichtlich NUR hier - die HUD-Szene fragt nicht nach
   * dem Modus, sie zeigt nur an, was ihr gesagt wird.
   */
  setPaused(open: boolean): void {
    if (this.overlayOpen === open || this.finished) {
      return;
    }
    this.overlayOpen = open;

    // Anhalten geht nur solo. Im Koop bleibt `paused` false, und die Runde
    // laeuft hinter dem Bildschirm weiter.
    this.paused = open && this.session.canPause;

    this.hud?.setOverlayVisible(open);

    // Der Ton geht nur mit, wenn wirklich angehalten wird. Im Koop laeuft die
    // Runde weiter - stille Musik waere dort ein falsches Signal.
    if (this.session.canPause) {
      // Kein Zeitfortschritt: Hier geht es nur darum, die Musik sofort
      // anzuhalten oder wieder zu starten.
      this.updateMusic(0);
    }
  }

  /** Beim Verlassen der App von selbst anhalten. Zurueck kommt man von Hand. */
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      this.setPaused(true);
    }
  };

  /** Gesamter ausgeteilter Schaden und Zeit - fuer die Schaden/s-Anzeige. */
  private damageDealt = 0;
  private fightSeconds = 0;

  /** Fuettert die Zahlenanzeige aus `?debug=werte`. Ohne den Schalter ein No-op. */
  private updateValues(player: PlayerState, delta: number): void {
    const state = this.session.view.state;
    if (state.enemies.length > 0) {
      this.fightSeconds += delta / 1000;
    }
    for (const event of this.session.view.events) {
      if (event.type === "hit") {
        this.damageDealt += event.damage;
      }
    }

    updateValuesOverlay(
      {
        fps: this.game.loop.actualFps,
        zone: state.zone,
        enemies: state.enemies.length,
        projectiles: state.projectiles.filter((entry) => entry.active).length,
        ammo: player.reloadTimers.filter((timer) => timer <= 0).length,
        health: player.health,
        maxHealth: player.maxHealth,
        superCharge: player.superCharge,
        dps: this.fightSeconds > 0 ? this.damageDealt / this.fightSeconds : 0,
      },
      this.time.now,
    );
  }

  private handleEvents(): void {
    const events = this.session.view.events;

    for (const event of events) {
      if (event.type === "hit") {
        this.entities.flashEnemy(event.enemyId);
      }
      if (event.type === "gameOver" && !this.finished) {
        this.finished = true;
        // Kurz warten, damit der letzte Effekt noch zu sehen ist.
        this.time.delayedCall(900, () => {
          this.scene.stop("Hud");
          this.scene.start("GameOver", {
            score: event.score,
            zone: event.zone,
            character: this.character,
          });
        });
      }
    }

    this.juice.handle(events);
    playEventSounds(events);
  }

  /**
   * Reisst die Verbindung ab, ist die Runde vorbei - Host-Migration lohnt sich
   * fuer ein Spiel unter Freunden nicht (Briefing, Abschnitt 6).
   */
  private checkConnection(): void {
    if (this.finished || !this.session.connectionLost) {
      return;
    }

    this.finished = true;
    this.hudModel.connectionMessage = this.session.connectionLost;
    this.time.delayedCall(2600, () => {
      this.scene.stop("Hud");
      this.scene.start("Menu");
    });
  }

  private selfPlayer(): PlayerState | undefined {
    return this.session.view.state.players.find((entry) => entry.id === this.session.selfId);
  }

  /**
   * Ziellinie mit Reichweitenanzeige.
   *
   * Sie zeigt zweierlei: wohin geschossen wird und wie weit die Waffe reicht -
   * damit niemand ins Leere feuert. Wer nur haelt, ohne zu ziehen, sieht die
   * Linie zum Gegner, den die Simulation automatisch anvisiert.
   */
  private drawAim(player: PlayerState, input: InputState): void {
    this.aimLine.clear();
    if (player.down || !this.hud) {
      return;
    }

    const aiming = this.hud.inputManager.aiming;
    if (aiming) {
      this.drawAbilityAim(player, input, aiming);
      return;
    }

    // Kein Knopf wird ausgerichtet: die gewohnte Ziellinie des Basisangriffs,
    // solange gefeuert wird. Sie zeigt auf den Gegner, den die Simulation
    // automatisch anvisiert - der Basisangriff zielt nicht mehr von Hand.
    if (!input.fire) {
      return;
    }

    const position = this.session.view.renderPlayerPosition(player.id);
    const range = CHARACTERS[player.character].shot.range;
    const direction = this.aimDirection(player, input, range);
    if (!direction) {
      return;
    }

    const endX = position.x + direction.x * range;
    const endY = position.y + direction.y * range;

    this.aimLine.lineStyle(3, COLORS.playerBullet, 0.45);
    this.aimLine.lineBetween(position.x, position.y, endX, endY);
    this.aimLine.lineStyle(2, COLORS.playerBullet, 0.8);
    this.aimLine.strokeCircle(endX, endY, 12);
  }

  /**
   * Zielanzeige fuer Faehigkeit und Super.
   *
   * GRUNDREGEL: Hier wird NICHTS geschaetzt. Jede Zahl kommt aus derselben
   * Stelle, mit der die Simulation rechnet - `ABILITIES` beziehungsweise
   * `SUPERS` in `balance.ts`. Eine Anzeige, die eine andere Reichweite zeigt
   * als die, die wirkt, waere schlimmer als gar keine: Man wuerde ihr glauben
   * und danebenzielen.
   */
  private drawAbilityAim(
    player: PlayerState,
    input: InputState,
    which: "ability" | "super",
  ): void {
    const position = this.session.view.renderPlayerPosition(player.id);
    const direction = input.aim ?? player.facing;
    const strength = Math.max(0.35, this.hud?.inputManager.aimStrength ?? 1);

    if (which === "super") {
      this.drawSuperAim(player, position, direction, strength);
      return;
    }

    const ability = ABILITIES[player.character];

    // Die Heilung des Tanks wirkt auf ihn selbst - es gibt keine Richtung, in
    // die man sie schicken koennte. Ein Zielstrahl waere hier eine Linie, der
    // man folgen wuerde, obwohl sie nichts bedeutet.
    if (ability.aimStyle === "self") {
      return;
    }

    const reach = ability.range * (ability.aimStyle === "circle" ? strength : 1);
    const endX = position.x + direction.x * reach;
    const endY = position.y + direction.y * reach;

    this.aimLine.lineStyle(3, COLORS.superReady, 0.5);
    this.aimLine.lineBetween(position.x, position.y, endX, endY);

    if (player.character === "scout") {
      // Splittergranate: der Kreis ist der echte Schadensradius.
      this.aimLine.lineStyle(2, COLORS.superReady, 0.9);
      this.aimLine.strokeCircle(endX, endY, ABILITIES.scout.blastRadius);
      this.aimLine.fillStyle(COLORS.superReady, 0.12);
      this.aimLine.fillCircle(endX, endY, ABILITIES.scout.blastRadius);
      return;
    }

    // Sniper: Laehmschuss - gerade Linie bis zur vollen Reichweite.
    this.aimLine.lineStyle(2, COLORS.superReady, 0.9);
    this.aimLine.strokeCircle(endX, endY, 14);
  }

  /** Zielanzeige des Supers, ebenfalls mit den echten Werten. */
  private drawSuperAim(
    player: PlayerState,
    position: Vec2,
    direction: Vec2,
    strength: number,
  ): void {
    if (player.character === "tank") {
      // Bodenstampfer wirkt rund um den Spieler, nicht in eine Richtung.
      this.aimLine.lineStyle(3, COLORS.superReady, 0.9);
      this.aimLine.strokeCircle(position.x, position.y, SUPERS.tank.radius);
      this.aimLine.fillStyle(COLORS.superReady, 0.12);
      this.aimLine.fillCircle(position.x, position.y, SUPERS.tank.radius);
      return;
    }

    const reach =
      player.character === "scout"
        ? SUPERS.scout.speed * SUPERS.scout.duration
        : SUPERS.sniper.searchRange;
    const length = player.character === "scout" ? reach : reach * strength;
    const endX = position.x + direction.x * length;
    const endY = position.y + direction.y * length;

    this.aimLine.lineStyle(4, COLORS.superReady, 0.55);
    this.aimLine.lineBetween(position.x, position.y, endX, endY);
    this.aimLine.lineStyle(2, COLORS.superReady, 0.9);
    this.aimLine.strokeCircle(endX, endY, 16);
  }

  /** Gezogene Richtung, sonst die Richtung zum automatisch gewaehlten Ziel. */
  private aimDirection(player: PlayerState, input: InputState, range: number): Vec2 | null {
    if (input.aim) {
      return input.aim;
    }

    const target = nearestEnemy(this.session.view.state, player.position, range * 1.15);
    if (!target) {
      return null;
    }

    const dx = target.position.x - player.position.x;
    const dy = target.position.y - player.position.y;
    const distance = Math.hypot(dx, dy);
    return distance > 1e-6 ? { x: dx / distance, y: dy / distance } : null;
  }

  /** Fuellt das Objekt, das die HudScene liest. */
  private updateHudModel(player: PlayerState): void {
    const state = this.session.view.state;
    const reloadTime = CHARACTERS[player.character].reloadTime;

    this.hudModel.characterName = CHARACTERS[player.character].name;
    this.hudModel.health = player.health;
    this.hudModel.maxHealth = player.maxHealth;
    this.hudModel.ammo = player.reloadTimers.map((timer) =>
      timer <= 0 ? 1 : 1 - timer / reloadTime,
    );
    this.hudModel.superCharge = player.superCharge;
    this.hudModel.abilityCooldown = player.abilityCooldown;
    this.hudModel.abilityCooldownMax = ABILITIES[player.character].cooldown;
    this.hudModel.abilityLabel = ABILITIES[player.character].short;
    this.hudModel.zone = state.zone;
    this.hudModel.deepestZone = state.deepestZone;
    this.hudModel.inSafeZone =
      distanceFromStart(state, player.position) <= WORLD.safeRadius;
    this.hudModel.score = state.score;
    this.hudModel.phase = state.phase;
    this.hudModel.runTime = state.runTime;
    this.hudModel.enemiesLeft = state.enemies.length + this.session.view.pendingCount;
    this.hudModel.skillPoints = player.skillPoints;
    this.hudModel.skillLevels = player.skills;
    this.hudModel.down = player.down;
    this.hudModel.reviveProgress = player.reviveProgress / PLAYER.reviveTime;
    this.hudModel.mates = state.players
      .filter((entry) => entry.id !== player.id)
      .map((entry) => ({
        name: entry.name,
        healthFraction: entry.health / entry.maxHealth,
        down: entry.down,
      }));
  }
}
