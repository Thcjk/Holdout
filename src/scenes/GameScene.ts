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
import { ABILITIES, CHARACTERS, PLAYER, SUPERS } from "../config/balance";
import { COLORS, DEPTH, VIEW3D } from "../config/constants";
import type { GameSession } from "../net/GameSession";
import { SoloSession } from "../net/SoloSession";
import { ArenaRenderer } from "../render/ArenaRenderer";
import { CameraController } from "../render/CameraController";
import { EntityRenderer } from "../render/EntityRenderer";
import { Juice } from "../render/Juice";
import { graphicsPainter } from "../render/AimPainter";
import type { AimPainter } from "../render/AimPainter";
import { World3D } from "../render/World3D";
import { VIEW_MODE } from "../platform/debugFlags";
import { TOP_DOWN, groundToScreen } from "../input/viewMapping";
import { setReloadSafe } from "../platform/update";
import { hideValuesOverlay, updateValuesOverlay } from "../platform/valuesOverlay";
import { loadHighscore } from "../storage/highscore";
import { extractionFraction, leftBehind } from "../systems/encounters";
import { distanceFromStart, safeRadiusOf } from "../systems/zones";
import { nearestEnemy } from "../systems/targeting";
import { attackLabel, attackRange, autoAimReach, reloadTimeOf } from "../systems/weapons";
import { emptyInput } from "../systems/types";
import type {
  CharacterId,
  InputState,
  PackedItem,
  PlayerState,
  Vec2,
  WorldState,
} from "../systems/types";
import { createHudModel } from "../ui/HudModel";
import type { HudModel } from "../ui/HudModel";
import { HudScene } from "./HudScene";
import { finishRun } from "../storage/carried";
import { saveActive } from "../storage/saveSlots";
import { packCarried } from "../systems/backpackCodec";
import { completeNode, currentNode } from "../systems/run";
import { placeName, regionOfLayer } from "../config/story";
import type { RunState } from "../systems/run";

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
  /**
   * Was im Loadout-Bildschirm eingepackt wurde.
   *
   * DAS HAT BIS HIERHER GEFEHLT, und es war der Grund, warum das Packen
   * folgenlos blieb: `startRun` gab nur den Charakter weiter, die Spielszene
   * legte eine `SoloSession` ohne Rucksack an, und im HUD stand "Beute 0",
   * obwohl man gerade vier Gegenstaende eingeraeumt hatte.
   *
   * Im Koop steht hier nichts - dort reist der Rucksack ueber die Lobby zum
   * Host (`PlayerSetup.backpack`), weil er die Runde fuer alle rechnet.
   */
  backpack?: PackedItem[];
  /**
   * Der Run auf der Knoten-Karte (seit 2026-09-25). Ist er gesetzt, fuehrt
   * der Ausgang eines Gebiets zurueck auf die Karte statt zum Ergebnis.
   */
  run?: RunState;
}

export class GameScene extends Phaser.Scene {
  private session!: GameSession;

  /*
   * Die Darstellung der Welt: ENTWEDER die 3D-Welt (Standard seit dem
   * 3D-Umbau) ODER die vier 2D-Teile (`?view=2d`). Die Szene selbst - Eingabe,
   * Musik, HUD, Run-Ende - ist fuer beide dieselbe; nur diese Felder
   * unterscheiden sich. Deshalb sind sie alle optional.
   */
  private world3d?: World3D;
  private cameraController?: CameraController;
  private arena?: ArenaRenderer;
  private entities?: EntityRenderer;
  private juice?: Juice;

  /** Zeichnet die Zielvorschau - in 2D mit Graphics, in 3D am Boden. */
  private aimPainter!: AimPainter;
  private hudModel: HudModel = createHudModel();
  /** Wie lange schon kein Gegner mehr in der Naehe war - steuert die Musik. */
  private calmSeconds = COMBAT_LEAVE_SECONDS;
  private hud?: HudScene;
  private character: CharacterId = "scout";
  private run?: RunState;
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
  /** Ist die Sitzung schon an den naechsten Run weitergegeben? */
  private released = false;
  /** Ist das Rucksack-Fenster offen? Dann ruht die Eingabe, die Runde nicht. */
  private backpackOpen = false;

  constructor() {
    super("Game");
  }

  init(data: GameSceneData): void {
    this.character = data.character ?? "scout";
    this.run = data.run;
    this.finished = false;
    this.released = false;
    this.backpackOpen = false;
    this.hudModel = createHudModel();
    this.hudModel.highscore = loadHighscore()?.score ?? 0;

    this.session =
      data.session ??
      new SoloSession({
        id: "local",
        name: "Du",
        character: this.character,
        backpack: data.backpack,
      });
  }

  create(): void {
    this.world3d = undefined;
    this.arena = undefined;
    this.juice = undefined;
    this.entities = undefined;
    this.cameraController = undefined;

    if (VIEW_MODE === "3d") {
      // Three.js zeichnet die Welt UNTER dieser Szene; Phaser bleibt fuer
      // HUD und Touch zustaendig (siehe CLAUDE.md, "3D-Umbau").
      this.world3d = new World3D(this.session.view.state);
      this.aimPainter = this.world3d.aim;
    } else {
      this.arena = new ArenaRenderer(this, this.session.view.state);
      this.juice = new Juice(this);
      this.entities = new EntityRenderer(this, this.session.view, this.session.selfId);
      // Grenzen aus der GENERIERTEN Welt, nicht aus der alten Konstanten: Jeder
      // Run hat seine eigene Karte, und die Kamera darf genau bis an deren Rand.
      const bounds = this.session.view.state.bounds;
      this.cameraController = new CameraController(this, bounds.width, bounds.height);
      this.aimPainter = graphicsPainter(this.add.graphics().setDepth(DEPTH.projectiles));
    }

    this.scene.launch("Hud", {
      model: this.hudModel,
      canPause: this.session.canPause,
      onPause: () => this.setPaused(true),
      onResume: () => this.setPaused(false),
      onQuit: () => {
        this.scene.stop("Hud");
        // Der Spielstand bleibt, wie er auf der Karte gespeichert wurde:
        // "Laden" beginnt dieses Gebiet neu.
        this.scene.start("Title");
      },
      onBackpack: (open: boolean) => {
        // Kein Anhalten, auch solo nicht - siehe `ui/BackpackWindow.ts`.
        // Nur die Eingabe ruht, damit Finger im Fenster nicht die Figur
        // steuern.
        this.backpackOpen = open;
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
      // Beim Run-Ende ist die Sitzung schon freigegeben (`release`) - ihre
      // Verbindung lebt im naechsten Run weiter und darf hier nicht zu.
      if (!this.released) {
        this.session.destroy();
      }
      this.cameraController?.destroy();
      this.entities?.destroy();
      this.juice?.destroy();
      this.arena?.destroy();
      this.world3d?.destroy();
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

    // Der Daumen liefert Bildschirmrichtungen; wie die in Bodenrichtungen
    // umzurechnen sind, haengt an der Kamera. In 2D ist es die Identitaet.
    this.hud.inputManager.view = this.world3d?.orientation ?? TOP_DOWN;

    if (this.paused) {
      // Weiterzeichnen, damit die Welt auch nach einer Drehung des Handys
      // in der Pause deckungsgleich unter dem HUD liegt.
      this.drawWorld3d(0);
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
    const idle = this.overlayOpen || this.backpackOpen;
    const input = idle ? emptyInput() : this.hud.inputManager.getState();
    if (idle) {
      this.hud.inputManager.clearOneShots();
    }
    // Rucksack-Befehle kommen aus dem Fenster der HUD-Szene, nicht vom Daumen.
    input.inventory = this.hud.peekInventoryCommand();
    // Rucksack offen = geschuetzt (2026-09-26): in Ruhe umraeumen.
    input.shielded = this.backpackOpen;

    // Beim Super laeuft die Zeit kurz langsamer. Die Simulation merkt davon
    // nichts - sie bekommt einfach weniger Zeit zugeteilt.
    this.juice?.update(delta);
    const consumed = this.session.update(delta * (this.juice?.currentTimeScale ?? 1), input);
    if (consumed) {
      // Einmalige Wuensche (Schuss, Super) erst loeschen, wenn sie verarbeitet
      // wurden - sonst geht ein Klick zwischen zwei Ticks verloren.
      this.hud.inputManager.clearOneShots();
      if (input.inventory) {
        this.hud.shiftInventoryCommand();
      }
    }

    this.handleEvents();
    this.updateValues(player, delta);
    this.checkConnection();
    this.entities?.update();
    this.drawWorld3d(delta);
    this.drawAim(player, input);
    this.updateHudModel(player);
    this.updateMusic(delta);

    // Boden, Deckung und Buesche nach Kamerasicht ein- und ausblenden. In einer
    // Welt dieser Groesse ist das der Unterschied zwischen "laeuft" und "ruckelt".
    this.arena?.update();

    this.cameraController?.update(
      this.session.view.state.players.map((entry) => ({
        position: this.session.view.renderPlayerPosition(entry.id),
        isSelf: entry.id === this.session.selfId,
        down: entry.down,
      })),
    );
  }

  /** Die 3D-Welt ein Bild weiterzeichnen - in der 2D-Ansicht nichts. */
  private drawWorld3d(delta: number): void {
    this.world3d?.update(this.session.view, this.session.selfId, delta, this.game.canvas);
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
        position: player.position,
        view: this.world3d
          ? `3D Neigung ${VIEW3D.pitch} Drehung ${VIEW3D.yaw} Abstand ${VIEW3D.distance} Bildwinkel ${VIEW3D.fov}`
          : "2D",
        render: this.world3d?.stats,
      },
      this.time.now,
    );
  }

  private handleEvents(): void {
    const events = this.session.view.events;

    for (const event of events) {
      if (event.type === "hit") {
        this.entities?.flashEnemy(event.enemyId);
      }
      if (event.type === "backpackGrown" && event.playerId === this.session.selfId) {
        this.hudModel.flash = `Tasche gefunden – Rucksack jetzt ${event.width} × ${event.height}`;
        this.hudModel.flashUntil = this.time.now + 2500;
      }
      if (event.type === "hordeStarted") {
        this.hudModel.flash = "Die Horde kommt – schnell zum Ausgang!";
        this.hudModel.flashUntil = this.time.now + 3500;
      }
      if (event.type === "runEnded" && !this.finished && event.outcome === "exited" && this.run) {
        this.finished = true;
        this.time.delayedCall(700, () => this.backToMap());
        continue;
      }
      if (event.type === "runEnded" && !this.finished) {
        this.finished = true;
        // Kurz warten, damit der letzte Effekt noch zu sehen ist.
        this.time.delayedCall(900, () => {
          this.scene.stop("Hud");
          // Beute abrechnen, bevor die Sitzung freigegeben wird - danach
          // gibt es keinen Zustand mehr, aus dem man lesen koennte.
          const loot = finishRun(
            event.outcome,
            this.selfPlayer()?.backpack.items ?? [],
            leftBehind(this.session.view.state, this.session.selfId),
            this.selfPlayer()?.belt.items ?? [],
          );
          // Run vorbei: Lager und (nach Erfolg) Rucksack in den Spielstand,
          // kein laufender Run mehr.
          saveActive(null);
          const coop = !this.session.canPause;
          const transport = this.session.release();
          this.released = true;
          this.scene.start("GameOver", {
            score: event.score,
            zone: event.zone,
            outcome: event.outcome,
            character: this.character,
            // Ob solo oder im Koop gespielt wurde, weiss nur die Sitzung -
            // und sie ist gleich weg. Deshalb wird die Antwort jetzt
            // mitgegeben statt spaeter erfragt.
            coop,
            // Im Koop die offene Verbindung: Der naechste Run findet im
            // selben Raum statt (Etappe 7).
            transport: transport ?? undefined,
            /*
             * Beute abrechnen, SOLANGE DER ZUSTAND NOCH DA IST.
             *
             * Gleich wird die Szene abgeraeumt und mit ihr die Sitzung. Wer
             * das dem Ergebnisbildschirm ueberliesse, muesste ihm die ganze
             * Item-Liste mitgeben - und die Regel "Wipe leert, Erfolg
             * behaelt" stuende dann dort, statt an der einen Stelle in
             * `storage/carried.ts`.
             */
            loot,
          });
        });
      }
    }

    this.juice?.handle(events);
    playEventSounds(events);
  }

  /**
   * Gebiet geschafft: Rucksaecke und Leben in den Run uebernehmen und zurueck
   * auf die Karte. Die Verbindung bleibt offen (`release`) - im Koop geht es
   * im selben Raum weiter.
   */
  private backToMap(): void {
    const run = this.run;
    if (!run) return;
    const state = this.session.view.state;
    completeNode(
      run,
      state.players.map((player) => ({
        id: player.id,
        health: player.health,
        down: player.down,
        // Rucksack und Guertel zusammen (Guertelstuecke markiert).
        backpack: packCarried(player.backpack, player.belt),
        size: { width: player.backpack.width, height: player.backpack.height },
      })),
      (id) => state.players.find((player) => player.id === id)?.maxHealth ?? 1,
    );
    this.scene.stop("Hud");
    const transport = this.session.release();
    this.released = true;
    this.scene.start("Map", {
      run,
      character: this.character,
      transport: transport ?? undefined,
      message: `Tag ${run.day} geschafft – ${state.score} Punkte. Wohin als Nächstes?`,
    });
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
      this.scene.start("Title");
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
    this.aimPainter.clear();
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
    // Reichweite der AUSGERUESTETEN Waffe (oder der Faust) - dieselbe Zahl,
    // mit der die Simulation rechnet.
    const range = attackRange(player);
    const direction = this.aimDirection(player, input, autoAimReach(player));
    if (!direction) {
      return;
    }

    const end = { x: position.x + direction.x * range, y: position.y + direction.y * range };

    this.aimPainter.line(position, end, 3, COLORS.playerBullet, 0.45);
    this.aimPainter.circle(end, 12, 2, COLORS.playerBullet, 0.8);
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
      this.drawSuperAim(player, position, direction);
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
    const end = { x: position.x + direction.x * reach, y: position.y + direction.y * reach };

    this.aimPainter.line(position, end, 3, COLORS.superReady, 0.5);

    if (player.character === "scout") {
      // Splittergranate: der Kreis ist der echte Schadensradius.
      this.aimPainter.circle(end, ABILITIES.scout.blastRadius, 2, COLORS.superReady, 0.9);
      return;
    }

    // Sniper: Laehmschuss - gerade Linie bis zur vollen Reichweite.
    this.aimPainter.circle(end, 14, 2, COLORS.superReady, 0.9);
  }

  /** Zielanzeige des Supers, ebenfalls mit den echten Werten. */
  private drawSuperAim(player: PlayerState, position: Vec2, direction: Vec2): void {
    if (player.character === "tank") {
      // Bodenstampfer wirkt rund um den Spieler, nicht in eine Richtung.
      this.aimPainter.circle(position, SUPERS.tank.radius, 3, COLORS.superReady, 0.9);
      return;
    }

    if (player.character === "sniper") {
      /*
       * Aufklaerungsschuss: Linie bis zur vollen Reichweite, am Ende der
       * Kreis, der dort aufgedeckt WUERDE. Trifft das Geschoss vorher einen
       * Gegner oder eine Wand, liegt der Kreis entsprechend frueher - die
       * Anzeige zeigt den weitesten Fall, mit dem echten Radius.
       */
      const recon = SUPERS.sniper;
      const end = {
        x: position.x + direction.x * recon.range,
        y: position.y + direction.y * recon.range,
      };
      this.aimPainter.line(position, end, 4, COLORS.superReady, 0.55);
      this.aimPainter.circle(end, recon.revealRadius, 2, COLORS.marked, 0.8);
      return;
    }

    const reach = SUPERS.scout.speed * SUPERS.scout.duration;
    const end = { x: position.x + direction.x * reach, y: position.y + direction.y * reach };

    this.aimPainter.line(position, end, 4, COLORS.superReady, 0.55);
    this.aimPainter.circle(end, 16, 2, COLORS.superReady, 0.9);
  }

  /** Gezogene Richtung, sonst die Richtung zum automatisch gewaehlten Ziel. */
  private aimDirection(player: PlayerState, input: InputState, reach: number): Vec2 | null {
    if (input.aim) {
      return input.aim;
    }

    // Dieselbe Reichweite wie die Simulation (`combat.ts`) - sonst zeigte die
    // Linie auf einen Gegner, auf den gar nicht geschossen wird.
    const target = nearestEnemy(
      this.session.view.state,
      player.position,
      reach,
    );
    if (!target) {
      return null;
    }

    const dx = target.position.x - player.position.x;
    const dy = target.position.y - player.position.y;
    const distance = Math.hypot(dx, dy);
    return distance > 1e-6 ? { x: dx / distance, y: dy / distance } : null;
  }

  /** Liegt ein Weltpunkt sichtbar im Bild (mit etwas Rand)? */
  private isOnScreen(position: Vec2): boolean {
    if (this.world3d) {
      return this.world3d.isOnScreen(position);
    }
    const view = this.cameras.main.worldView;
    return (
      position.x > view.x + 60 &&
      position.x < view.right - 60 &&
      position.y > view.y + 60 &&
      position.y < view.bottom - 60
    );
  }

  /**
   * Eine Richtung am Boden (Winkel in der Simulation) als Richtung auf dem
   * Bildschirm. In 2D dasselbe; in 3D gedreht und gestaucht wie die Kamera -
   * sonst zeigte der Kompass am Rand schraeg an der Zone vorbei.
   */
  private screenAngle(groundAngle: number): number {
    if (!this.world3d) {
      return groundAngle;
    }
    const screen = groundToScreen(
      { x: Math.cos(groundAngle), y: Math.sin(groundAngle) },
      this.world3d.orientation,
    );
    return Math.atan2(screen.y, screen.x);
  }

  /** Fuellt das Objekt, das die HudScene liest. */
  private updateHudModel(player: PlayerState): void {
    const state = this.session.view.state;
    // Die Faust braucht keine Munition (Nachladezeit 0): Ring immer voll.
    const reloadTime = reloadTimeOf(player);

    this.hudModel.characterName = CHARACTERS[player.character].name;
    this.hudModel.health = player.health;
    this.hudModel.maxHealth = player.maxHealth;
    this.hudModel.ammo = player.reloadTimers.map((timer) =>
      timer <= 0 || reloadTime <= 0 ? 1 : 1 - timer / reloadTime,
    );
    this.hudModel.attackLabel = attackLabel(player);
    this.hudModel.superCharge = player.superCharge;
    this.hudModel.abilityCooldown = player.abilityCooldown;
    this.hudModel.abilityCooldownMax = ABILITIES[player.character].cooldown;
    this.hudModel.abilityLabel = ABILITIES[player.character].short;
    this.hudModel.zone = state.zone;
    this.hudModel.nodeTimer = state.nodeTimer ?? null;
    this.hudModel.horde = state.horde === true;
    if (this.run && !this.hudModel.placeName) {
      const node = currentNode(this.run);
      this.hudModel.placeName = placeName(node, this.run.map.depth, this.run.seed);
      // Beim Betreten: wo man ist und was hier gilt - ein Satz, dann weg.
      const region = regionOfLayer(node.layer, this.run.map.depth);
      this.hudModel.flash = `${this.hudModel.placeName} · ${region.name}\nFinde den Ausgang am Ende der Strasse`;
      this.hudModel.flashUntil = this.time.now + 4000;
    }
    this.hudModel.deepestZone = state.deepestZone;
    this.hudModel.inSafeZone =
      safeRadiusOf(state) > 0 &&
      distanceFromStart(state, player.position) <= safeRadiusOf(state);
    this.hudModel.extraction = state.extractionIndex < 0 ? -1 : extractionFraction(state);
    /*
     * Der Kompass zeigt auf etwas AUSSERHALB des Bildes. Liegt die Mitte der
     * Zone schon im Sichtfeld, sieht man den Teppich selbst - ein Pfeil am
     * Rand laege dann mitten darauf und verdeckte genau das, worauf er zeigt.
     * So im Emulator gesehen, deshalb diese Pruefung.
     */
    const nearest = nearestKnownExtraction(state, player.position);
    this.hudModel.extractionCompass =
      nearest && !this.isOnScreen(nearest.position)
        ? { angle: this.screenAngle(nearest.angle), distance: nearest.distance }
        : null;
    this.fillMinimap(state, player);
    this.hudModel.carriedItems = player.backpack.items.length;
    // Rucksack und Guertel (markiert) - das Fenster und die Guertel-Knoepfe lesen beides.
    this.hudModel.backpack = packCarried(player.backpack, player.belt);
    this.hudModel.backpackSize = { width: player.backpack.width, height: player.backpack.height };
    this.hudModel.score = state.score;
    this.hudModel.phase = state.phase;
    this.hudModel.runTime = state.runTime;
    this.hudModel.enemiesLeft = state.enemies.length + this.session.view.pendingCount;
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

  /**
   * Fuellt das Modell der Uebersichtskarte.
   *
   * Jedes Bild neu, aber IN DIE VORHANDENEN ARRAYS statt in neue: Bei 60
   * Bildern je Sekunde waeren neue Listen sonst Muell, den der Browser
   * dauernd wegraeumen muss - und zwar genau dann, wenn es gerade eng wird.
   *
   * Gefiltert wird hier und nicht in der Karte: Was die Karte zeigen DARF,
   * entscheidet der Weltzustand (`discovered`), und diese Entscheidung soll
   * nicht in der Darstellung noch einmal getroffen werden.
   */
  private fillMinimap(state: WorldState, player: PlayerState): void {
    const map = this.hudModel.minimap;
    map.worldSize = state.bounds.width;
    // Der Startpunkt ist die Weltmitte - dieselbe Rechnung wie in
    // `distanceFromStart`, aus der auch die Distanzzonen entstehen. Eine
    // zweite Quelle dafuer waere eine zweite Wahrheit.
    map.startX = state.bounds.width / 2;
    map.startY = state.bounds.height / 2;
    map.safeRadius = safeRadiusOf(state);
    map.selfX = player.position.x;
    map.selfY = player.position.y;

    map.mates.length = 0;
    for (const mate of state.players) {
      if (mate.id !== player.id) {
        map.mates.push({ x: mate.position.x, y: mate.position.y, down: mate.down });
      }
    }

    map.extractions.length = 0;
    for (const zone of state.extractions) {
      if (zone.discovered) {
        map.extractions.push({ x: zone.position.x, y: zone.position.y });
      }
    }

    map.encounters.length = 0;
    for (const spot of state.encounters) {
      if (spot.discovered) {
        map.encounters.push({
          x: spot.position.x,
          y: spot.position.y,
          isFinal: spot.isFinal,
          cleared: spot.status === "cleared",
        });
      }
    }

    // Vom Aufklaerungsschuss aufgedeckte Gegner (Etappe 10). Nur die: Eine
    // Karte mit ALLEN Gegnern nahme dem Erkunden seinen Sinn.
    map.revealed.length = 0;
    for (const enemy of state.enemies) {
      if (enemy.marked > 0) {
        map.revealed.push({ x: enemy.position.x, y: enemy.position.y });
      }
    }
  }

}

/**
 * Richtung und Entfernung zum naechsten schon entdeckten Ausstieg.
 *
 * NUR ENTDECKTE ZAEHLEN. Wuerde der Kompass auf alle sechs zeigen, waere die
 * Karte vom ersten Moment an geloest - man liefe die Pfeile ab, statt zu
 * erkunden. So ist er das, was er sein soll: ein Gedaechtnis fuer das, was man
 * schon gesehen hat, und kein Spickzettel.
 *
 * Steht hier in der Szene und nicht in `systems/`, weil es reine Anzeige ist:
 * Die Simulation trifft daraus keine Entscheidung.
 */
function nearestKnownExtraction(
  state: WorldState,
  from: Vec2,
): { angle: number; distance: number; position: Vec2 } | null {
  let best: { angle: number; distance: number; position: Vec2 } | null = null;

  for (const zone of state.extractions) {
    if (!zone.discovered) {
      continue;
    }
    const dx = zone.position.x - from.x;
    const dy = zone.position.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) {
      best = { angle: Math.atan2(dy, dx), distance, position: zone.position };
    }
  }

  return best;
}
