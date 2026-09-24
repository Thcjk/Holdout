/**
 * HUD und Touch-Bedienung in einer eigenen Szene.
 *
 * Warum getrennt vom Spiel? Die Spielkamera zoomt je nach Spielerabstand.
 * Alles, was in dieser Kamera liegt, zoomt mit - auch ein Text, der eigentlich
 * fest am Bildschirmrand kleben soll. Eine zweite Szene hat ihre eigene Kamera
 * ohne Zoom; erst dadurch bleiben Anzeige und Joysticks immer gleich gross.
 *
 * Diese Szene laeuft parallel ueber der Spielszene (`scene.launch`), nicht statt ihr.
 */

import Phaser from "phaser";
import { ENCOUNTERS } from "../config/balance";
import { COLORS, DEPTH, SAFE, TOUCH, VIEWPORT } from "../config/constants";
import { audio } from "../audio/AudioEngine";
import { InputManager } from "../input/InputManager";
import { Button } from "../ui/Button";
import { placeOnEdge } from "../ui/compassPlacement";
import type { Rect } from "../ui/compassPlacement";
import { Minimap } from "../ui/Minimap";
import { BackpackWindow } from "../ui/BackpackWindow";
import type { InventoryCommand } from "../systems/types";
import type { HudModel } from "../ui/HudModel";

/** Dauer des Extraktions-Countdowns, fuer die Restzeit in der Anzeige. */
const EXTRACTION_SECONDS = ENCOUNTERS.extractionSeconds;

export interface HudSceneData {
  model: HudModel;
  /** Nur solo darf angehalten werden - siehe `GameSession.canPause`. */
  canPause: boolean;
  onPause: () => void;
  onResume: () => void;
  /** Runde aufgeben und zurueck ins Menue. */
  onQuit: () => void;
  /** Das Rucksack-Fenster geht auf oder zu - die Figur bleibt dann stehen. */
  onBackpack: (open: boolean) => void;
}


/**
 * Abstand der Knopfreihe (Pause, Ton) von der oberen Kante.
 *
 * 106 -> 62 (Etappe 6): Darunter sitzt jetzt die kleine Karte, und alles
 * zusammen muss oberhalb des SUPER-Knopfs enden. Dafuer steht die
 * Punkteanzeige auf ZWEI Zeilen statt vier ("Score · Rekord", "Gegner ·
 * Beute").
 */
const BUTTON_ROW_Y = 62;

/** Oberkante der kleinen Karte, unter der Knopfreihe. */
const MINIMAP_Y = 90;

export class HudScene extends Phaser.Scene {
  /** Erst wenn das hier `true` ist, darf die Spielszene Eingaben abholen. */
  ready = false;
  inputManager!: InputManager;

  private model!: HudModel;

  private bars!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private announceText!: Phaser.GameObjects.Text;
  private mateText!: Phaser.GameObjects.Text;
  private muteButton!: Button;
  private menuButton!: Button;

  private canPause = false;
  /** Welt steht wirklich still (nur solo)? Dann bringt das HUD nichts nach. */
  private paused = false;
  private onPause: () => void = () => {};
  private onResume: () => void = () => {};
  private onQuit: () => void = () => {};

  /** Die Teile des Pausenbildes. Zusammen ein- und ausgeblendet. */
  private pauseBackdrop!: Phaser.GameObjects.Rectangle;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseHint!: Phaser.GameObjects.Text;
  private resumeButton!: Button;
  private quitButton!: Button;

  constructor() {
    super("Hud");
  }

  init(data: HudSceneData): void {
    this.model = data.model;
    this.canPause = data.canPause;
    this.onPause = data.onPause;
    this.onResume = data.onResume;
    this.onQuit = data.onQuit;
    this.onBackpack = data.onBackpack;
  }

  private onBackpack: (open: boolean) => void = () => {};
  private backpackButton!: Button;
  private backpackWindow!: BackpackWindow;

  /** Fuer die Spielszene: der naechste Rucksack-Befehl an die Simulation. */
  peekInventoryCommand(): InventoryCommand | null {
    return this.backpackWindow?.peekCommand() ?? null;
  }

  shiftInventoryCommand(): void {
    this.backpackWindow?.shiftCommand();
  }

  private setBackpackOpen(open: boolean): void {
    if (open === this.backpackWindow.isOpen) {
      return;
    }
    if (open) {
      this.backpackWindow.show(this.model.backpack);
    } else {
      this.backpackWindow.hide();
    }
    this.onBackpack(open);
  }

  private minimap!: Minimap;
  private compass!: Phaser.GameObjects.Graphics;
  private compassText!: Phaser.GameObjects.Text;

  create(): void {
    // Randabstaende: Grundabstand plus das, was das Geraet selbst als verdeckt
    // meldet (Notch, Home-Indikator, runde Ecken). Siehe platform/safeArea.ts.
    const leftEdge = SAFE.left + 14;
    const rightEdge = VIEWPORT.width - SAFE.right - 14;
    const topEdge = SAFE.top + 12;

    // Aendert sich die Entwurfsflaeche (Adressleiste klappt ein oder aus),
    // muessen alle Anzeigen am Rand neu gesetzt werden - sonst kleben sie an
    // der alten Kante.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);

    this.bars = this.add.graphics().setDepth(DEPTH.hud);

    // Der Ausstiegs-Kompass. Eigenes Graphics-Objekt, weil er jedes Bild neu
    // gezeichnet wird und die Balken daneben nicht mitloeschen soll.
    this.compass = this.add.graphics().setDepth(DEPTH.hud);
    this.compassText = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#7ee08a",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    this.waveText = this.add
      .text(leftEdge, topEdge, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#dce8f7",
        fontStyle: "bold",
      })
      .setDepth(DEPTH.hud);

    this.scoreText = this.add
      .text(rightEdge, topEdge, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#dce8f7",
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.hud);

    this.mateText = this.add
      .text(leftEdge, topEdge + 28, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#8ea6c4",
      })
      .setDepth(DEPTH.hud);

    this.announceText = this.add
      .text(VIEWPORT.width / 2, 132, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        color: "#ffd166",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    // Stummschalten muss im Spiel erreichbar sein (Briefing, Abschnitt 7).
    this.muteButton = new Button(
      this,
      rightEdge - 44,
      topEdge + BUTTON_ROW_Y,
      audio.isMuted ? "Ton aus" : "Ton an",
      () => {
        const muted = audio.toggleMuted();
        this.muteButton.setText(muted ? "Ton aus" : "Ton an");
      },
      { width: 96, height: 30, fontSize: 13, color: COLORS.hudDim },
    );
    this.muteButton.setDepth(DEPTH.hud);

    /*
     * Pause und Ton liegen oben rechts unter der Punkteanzeige: Unten rechts
     * sitzt der Super-Knopf, und dort wuerde der Daumen sie staendig streifen.
     *
     * DIESER KNOPF HAT DIE RUNDE FRUEHER SOFORT BEENDET. Wer nur kurz
     * aufhoeren wollte, verlor damit alles - genau die Beschwerde, die zu
     * dieser Aenderung gefuehrt hat. Solo wurde das zuerst behoben, im Koop
     * blieb der alte Weg stehen und warf einen weiterhin ohne Rueckfrage
     * hinaus. Jetzt oeffnet er in BEIDEN Faellen erst einen
     * Zwischenbildschirm.
     *
     * Die Beschriftung sagt, was wirklich passiert: Solo wird angehalten
     * ("Pause"), im Koop laeuft die Runde weiter, weil der Host fuer alle
     * rechnet - dort steht deshalb "Menü" und nicht "Pause". Ein Knopf, der
     * Pause verspricht und keine macht, waere schlimmer als der alte Zustand.
     */
    this.menuButton = new Button(
      this,
      rightEdge - 146,
      topEdge + BUTTON_ROW_Y,
      this.canPause ? "Pause" : "Menü",
      () => this.onPause(),
      { width: 80, height: 30, fontSize: 13, color: COLORS.hudDim },
    );
    this.menuButton.setDepth(DEPTH.hud);

    /*
     * Der Rucksack im Run (Etappe 9): links neben Pause und Ton, aus
     * demselben Grund dort oben - hier kommt man mit Absicht hin, nicht aus
     * Versehen mit dem Daumen, der gerade FEUER haelt.
     */
    this.backpackButton = new Button(
      this,
      rightEdge - 246,
      topEdge + BUTTON_ROW_Y,
      "Rucksack",
      () => this.setBackpackOpen(!this.backpackWindow.isOpen),
      { width: 100, height: 30, fontSize: 13, color: COLORS.hudDim },
    );
    this.backpackButton.setDepth(DEPTH.hud);
    this.backpackWindow = new BackpackWindow(this, () => this.setBackpackOpen(false));

    /*
     * Die Karte - klein und immer sichtbar rechts oben (Arbeitsdokument,
     * Etappe 6). Antippen oeffnet die grosse Ansicht, OHNE anzuhalten. Der
     * fruehere Knopf "Karte" ist damit weggefallen: Die Karte selbst ist der
     * Knopf.
     */
    this.minimap = new Minimap(this, topEdge + MINIMAP_Y, () => undefined);

    /*
     * Ton beim ersten Antippen freigeben - Browser verweigern Klang, bevor der
     * Nutzer etwas beruehrt hat.
     *
     * Hier wird NICHT die Musik gestartet: Welches Stueck laufen soll, haengt
     * an der Rundenphase, und die kennt nur die Spielszene. `unlock()` nimmt
     * die dort gesetzte Wahl von selbst auf.
     */
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      audio.unlock();
    });

    this.inputManager = new InputManager(this);

    // GANZ ZUM SCHLUSS: `createPauseScreen` blendet am Ende alles aus, was in
    // der Pause nicht sichtbar sein darf. Frueher aufgerufen, gaebe es das
    // noch gar nicht, und der Aufbau des HUD braeche mit "Cannot read
    // properties of undefined" ab.
    this.createPauseScreen();

    this.ready = true;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.ready = false;
      this.inputManager.destroy();
    });
  }

  update(): void {
    /*
     * In der Pause steht die Welt still, also gibt es nichts nachzufuehren.
     *
     * Das ist nicht nur gespart: Weiterlaufende Anzeigen wuerden jedes Bild
     * wieder einblenden, was das Pausenbild gerade ausgeblendet hat - sie
     * flackerten mitten durch die Pausenschrift.
     */
    if (!this.model || this.paused) {
      return;
    }

    /*
     * Die Zone ist der Nachfolger der Wellennummer - aber sie sagt etwas
     * anderes: nicht "wie lange haeltst du durch", sondern "wie tief bist du
     * drin". In der sicheren Zone steht das ausdruecklich da, weil dort die
     * Regeln andere sind (man heilt, man verteilt Punkte).
     */
    this.waveText.setText(
      this.model.inSafeZone ? "Sichere Zone" : `Zone ${this.model.zone}`,
    );
    this.drawCompass();
    this.minimap.update(this.model.minimap);
    this.backpackWindow.sync(this.model.backpack);
    /*
     * Die Beute steht bei der Punktzahl und nicht unten.
     *
     * Eine Zahl reicht - was genau man traegt, gehoert ab Phase 11 in den
     * Rucksack und nicht ins Gefechts-HUD. Der untere Rand ist ohnehin der
     * knappste Platz im Bild; dort sitzen Leben, Super und der Knopfbogen.
     */
    this.scoreText.setText(
      `Score ${this.model.score} · Rekord ${this.model.highscore}\n` +
        `Gegner ${this.model.enemiesLeft} · Beute ${this.model.carriedItems}`,
    );
    this.mateText.setText(
      this.model.mates
        .map(
          (mate) =>
            `${mate.name}: ${mate.down ? "am Boden" : `${Math.round(mate.healthFraction * 100)} %`}`,
        )
        .join("   "),
    );

    this.drawPlayerBars();
    this.updateAnnouncement();
    this.inputManager.setStatus({
      // `ammo` sind Fuellstaende 0 bis 1 - voll ist, was 1 erreicht hat.
      ammo: this.model.ammo.filter((fraction) => fraction >= 1).length,
      ammoMax: this.model.ammo.length,
      abilityCooldown: this.model.abilityCooldown,
      abilityCooldownMax: this.model.abilityCooldownMax,
      superCharge: this.model.superCharge,
      abilityLabel: this.model.abilityLabel,
    });
  }

  /**
   * Das Pausenbild.
   *
   * Es wird EINMAL gebaut und danach nur ein- und ausgeblendet. Bei jedem
   * Anhalten neu zu bauen hiesse, mitten im Spiel Objekte zu erzeugen - das
   * ruckelt genau in dem Moment, in dem man hinschaut.
   *
   * Der dunkle Hintergrund ist nicht nur Optik: Er faengt als anklickbare
   * Flaeche die Beruehrungen ab, damit ein Daumen neben den Knoepfen nicht den
   * Joystick darunter erwischt.
   */
  private createPauseScreen(): void {
    /*
     * Im Koop laeuft die Runde dahinter weiter - dann darf der Hintergrund
     * nicht so dicht sein, dass man nichts mehr davon sieht. Solo steht das
     * Bild ohnehin still, dort stoert die dunklere Flaeche niemanden.
     */
    this.pauseBackdrop = this.add
      .rectangle(
        0,
        0,
        VIEWPORT.width * 2,
        VIEWPORT.height * 2,
        0x070b12,
        this.canPause ? 0.82 : 0.58,
      )
      .setOrigin(0)
      .setDepth(DEPTH.hud + 10)
      .setInteractive();

    this.pauseTitle = this.add
      .text(VIEWPORT.width / 2, VIEWPORT.height / 2 - 96, this.canPause ? "Pause" : "Menü", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "40px",
        color: "#dce8f7",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 11);

    this.pauseHint = this.add
      .text(
        VIEWPORT.width / 2,
        VIEWPORT.height / 2 - 52,
        // Die Wahrheit, nicht die Wunschvorstellung: Im Koop wartet niemand.
        this.canPause
          ? "Die Runde wartet auf dich"
          : "Achtung: Die Runde läuft weiter – im Koop rechnet der Host für alle.",
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "15px",
          color: this.canPause ? "#8ea6c4" : "#ffd166",
          align: "center",
          wordWrap: { width: VIEWPORT.width - 140 },
        },
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 11);

    this.resumeButton = new Button(
      this,
      VIEWPORT.width / 2,
      VIEWPORT.height / 2 + 6,
      this.canPause ? "Weiter" : "Weiter spielen",
      () => this.onResume(),
      { width: 240, height: 52, fontSize: 21 },
    );
    this.resumeButton.setDepth(DEPTH.hud + 11);

    this.quitButton = new Button(
      this,
      VIEWPORT.width / 2,
      VIEWPORT.height / 2 + 74,
      this.canPause ? "Runde beenden" : "Runde verlassen",
      () => {
        this.scene.stop("Game");
        this.onQuit();
      },
      { width: 240, height: 42, fontSize: 16, color: COLORS.hudDim },
    );
    this.quitButton.setDepth(DEPTH.hud + 11);

    this.setOverlayVisible(false);
  }

  /**
   * Blendet den Zwischenbildschirm ein oder aus. Gerufen von der Spielszene.
   *
   * Ob dahinter wirklich angehalten wird, entscheidet die Spielszene - hier
   * wird nur angezeigt. Das HUD friert nur dann mit ein, wenn die Welt
   * tatsaechlich stillsteht (solo); im Koop laeuft die Runde weiter, und die
   * Anzeigen muessen weiterlaufen.
   */
  setOverlayVisible(visible: boolean): void {
    if (!this.pauseBackdrop) {
      return;
    }
    this.pauseBackdrop.setVisible(visible);
    this.pauseTitle.setVisible(visible);
    this.pauseHint.setVisible(visible);
    this.resumeButton.setVisible(visible);
    this.quitButton.setVisible(visible);

    /*
     * Die grosse Ansage in der Bildmitte muss weg, solange pausiert ist.
     *
     * Sie sitzt genau dort, wo "Pause" steht, und der dunkle Hintergrund ist
     * absichtlich durchscheinend - also stand "Bereitmachen 2" quer durch die
     * Pausenschrift. Zwei Ueberschriften uebereinander liest niemand.
     */
    this.announceText.setVisible(!visible);

    /*
     * Die Karte macht beim Pausenbild zu.
     *
     * Beides gleichzeitig offen waere ein Widerspruch: Die Karte sagt unten
     * ausdruecklich "Die Runde laeuft weiter", der Pausenbildschirm sagt solo
     * das Gegenteil - und beide saessen uebereinander in der Bildmitte.
     */
    if (visible && this.minimap.isOpen) {
      this.minimap.toggle();
    }
    // Der Rucksack ebenso: Pause und Rucksack gleichzeitig waeren zwei
    // Fenster uebereinander.
    if (visible && this.backpackWindow?.isOpen) {
      this.setBackpackOpen(false);
    }

    this.paused = visible && this.canPause;
  }

  /**
   * Setzt alles neu, was an einer Bildschirmkante klebt.
   *
   * Wird bei jeder Aenderung der Entwurfsflaeche gerufen. Die Balken unten
   * links zeichnen sich ohnehin jedes Bild neu und rechnen dabei frisch - hier
   * geht es um die Texte und Knoepfe, die ihre Position nur einmal bekommen
   * haben.
   */
  /**
   * Der Pfeil zum naechsten bekannten Ausstieg.
   *
   * ================================================================
   * WARUM ER AM BILDSCHIRMRAND SITZT UND NICHT IN DER MITTE
   * ================================================================
   *
   * Ein Kompass soll im Augenwinkel liegen, nicht im Blickfeld. Waehrend man
   * kaempft, schaut man auf die eigene Figur und auf das, was auf sie zulaeuft
   * - alles, was dort zusaetzlich steht, verdeckt genau das.
   *
   * Deshalb laeuft der Pfeil auf einer ELLIPSE um die Bildmitte und sitzt
   * immer dort, wo der Ausstieg liegt. Eine Ellipse und kein Kreis, weil das
   * Bild breiter als hoch ist: Auf einem Kreis waere der Pfeil oben und unten
   * am Rand, links und rechts aber mitten im Bild.
   *
   * Die Zahl daneben ist der Abstand in Metern (100 Weltpixel = 1 m, dieselbe
   * Umrechnung wie sonst nirgends - sie muss nur in sich stimmig sein und eine
   * Groessenordnung vermitteln, die man mit dem Laufweg vergleichen kann).
   *
   * Gezeichnet wird nur, was es zu zeigen gibt: Ohne entdeckten Ausstieg
   * bleibt die Flaeche leer.
   */
  private drawCompass(): void {
    this.compass.clear();

    const target = this.model?.extractionCompass ?? null;
    if (!target) {
      this.compassText.setVisible(false);
      return;
    }

    /*
     * Am Bildschirmrand, wie im Arbeitsdokument verlangt - aber nie auf einer
     * Anzeige. Bis 2026-09-24 lief der Pfeil auf einer Ellipse weiter innen,
     * weil er am Rand prompt auf "Ton an" sass. Jetzt weicht er den vier
     * besetzten Ecken aus (`ui/compassPlacement.ts`) und bleibt trotzdem am
     * Rand, wo man einen Hinweis auf etwas ausserhalb des Bildes erwartet.
     */
    const inset = 30;
    const frame = {
      x: SAFE.left + inset,
      y: SAFE.top + inset,
      width: VIEWPORT.width - SAFE.left - SAFE.right - inset * 2,
      height: VIEWPORT.height - SAFE.top - SAFE.bottom - inset * 2,
    };
    const { x, y } = placeOnEdge(target.angle, frame, this.compassKeepOut());

    // Steht man schon drin, waere ein Pfeil nur Verwirrung - dann sagt es der
    // Extraktionsbalken, nicht der Kompass.
    const meters = Math.round(target.distance / 100);
    if (meters <= 2) {
      this.compassText.setVisible(false);
      return;
    }

    // Ein Dreieck in Zielrichtung, dahinter ein dunkler Kreis als Untergrund:
    // Auf hellem Sand waere ein gruener Pfeil allein schwer zu sehen.
    this.compass.fillStyle(0x0d1420, 0.55);
    this.compass.fillCircle(x, y, 17);
    this.compass.lineStyle(2, COLORS.mate, 0.9);
    this.compass.strokeCircle(x, y, 17);

    const tip = 11;
    const back = 7;
    const spread = 2.5;
    this.compass.fillStyle(COLORS.mate, 1);
    this.compass.beginPath();
    this.compass.moveTo(x + Math.cos(target.angle) * tip, y + Math.sin(target.angle) * tip);
    this.compass.lineTo(
      x + Math.cos(target.angle + spread) * back,
      y + Math.sin(target.angle + spread) * back,
    );
    this.compass.lineTo(
      x + Math.cos(target.angle - spread) * back,
      y + Math.sin(target.angle - spread) * back,
    );
    this.compass.closePath();
    this.compass.fillPath();

    // Die Zahl nach INNEN versetzt, nie nach aussen: Sonst rutscht sie bei
    // einem Pfeil am Rand aus dem Bild.
    // 36 statt knapp 20: Der Kreis hat 17 Pixel Radius, die Schrift noch
    // einmal rund 7 - bei zu kleinem Abstand stand die Entfernung halb hinter
    // dem Pfeil, genau so im Emulator gesehen.
    this.compassText.setPosition(
      x - Math.cos(target.angle) * 36,
      y - Math.sin(target.angle) * 36,
    );
    this.compassText.setText(`${meters} m`);
    this.compassText.setVisible(true);
  }

  /**
   * Die vier besetzten Ecken, gemessen an den echten Anzeigen statt
   * geschaetzt - aendert sich ein Text oder ein Knopf, weicht der Kompass
   * trotzdem richtig aus.
   */
  private compassKeepOut(): Rect[] {
    const toRect = (bounds: Phaser.Geom.Rectangle): Rect => ({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
    const union = (list: Phaser.Geom.Rectangle[]): Rect => {
      const first = list[0] ?? new Phaser.Geom.Rectangle();
      const merged = Phaser.Geom.Rectangle.Clone(first);
      for (const bounds of list.slice(1)) {
        Phaser.Geom.Rectangle.Union(merged, bounds, merged);
      }
      return toRect(merged);
    };

    const topLeft = [this.waveText.getBounds()];
    if (this.mateText.text !== "") {
      topLeft.push(this.mateText.getBounds());
    }

    const bottom = VIEWPORT.height - SAFE.bottom;
    const right = VIEWPORT.width - SAFE.right;
    // Der Knopfbogen: aeusserste Kanten von Faehigkeit (links) und Super (oben),
    // jeweils samt Abklingring.
    const arcLeft = right - TOUCH.abilityButton.marginX - TOUCH.abilityButton.radius - 10;
    const arcTop = bottom - TOUCH.superButton.marginY - TOUCH.superButton.radius - 10;

    return [
      union(topLeft),
      union([
        this.scoreText.getBounds(),
        this.muteButton.getBounds(),
        this.menuButton.getBounds(),
        this.backpackButton.getBounds(),
      ]),
      this.minimap.smallBounds,
      ...(this.minimap.largeBounds ? [this.minimap.largeBounds] : []),
      // Leben und Super unten links, wie in `drawPlayerBars`.
      { x: SAFE.left, y: bottom - 64, width: 250, height: 64 },
      { x: arcLeft, y: arcTop, width: right - arcLeft, height: bottom - arcTop },
    ];
  }

  private layout(): void {
    if (!this.ready) {
      return;
    }
    const leftEdge = SAFE.left + 14;
    const rightEdge = VIEWPORT.width - SAFE.right - 14;
    const topEdge = SAFE.top + 12;

    this.waveText.setPosition(leftEdge, topEdge);
    this.scoreText.setPosition(rightEdge, topEdge);
    this.mateText.setPosition(leftEdge, topEdge + 28);
    this.announceText.setPosition(VIEWPORT.width / 2, 132);
    this.muteButton.setPosition(rightEdge - 44, topEdge + BUTTON_ROW_Y);
    this.menuButton.setPosition(rightEdge - 146, topEdge + BUTTON_ROW_Y);
    this.backpackButton.setPosition(rightEdge - 246, topEdge + BUTTON_ROW_Y);
    this.backpackWindow.layout();
    this.minimap.layout(topEdge + MINIMAP_Y);

    // Das Pausenbild sitzt in der Mitte - die verschiebt sich mit der Breite.
    this.pauseTitle.setPosition(VIEWPORT.width / 2, VIEWPORT.height / 2 - 96);
    this.pauseHint.setPosition(VIEWPORT.width / 2, VIEWPORT.height / 2 - 52);
    this.resumeButton.setPosition(VIEWPORT.width / 2, VIEWPORT.height / 2 + 6);
    this.quitButton.setPosition(VIEWPORT.width / 2, VIEWPORT.height / 2 + 74);
    this.pauseBackdrop.setSize(VIEWPORT.width * 2, VIEWPORT.height * 2);

    this.inputManager.layout();
  }

  /**
   * Leben und Super unten links.
   *
   * Die Munition steht hier bewusst NICHT mehr: Sie sitzt jetzt als Ringstuecke
   * um den FEUER-Knopf, also genau dort, wo der Daumen ohnehin liegt. Zweimal
   * dasselbe an zwei Bildschirmecken kostet nur Platz und Aufmerksamkeit - und
   * der untere Rand ist der knappste Platz im Bild.
   */
  private drawPlayerBars(): void {
    const left = SAFE.left + 16;
    const bottom = VIEWPORT.height - SAFE.bottom - 18;

    this.bars.clear();

    // Lebensbalken
    const healthWidth = 220;
    const healthFraction = Math.max(0, this.model.health / this.model.maxHealth);
    this.bars.fillStyle(0x000000, 0.5);
    this.bars.fillRect(left - 2, bottom - 20, healthWidth + 4, 16);
    this.bars.fillStyle(healthFraction > 0.3 ? COLORS.mate : COLORS.danger, 1);
    this.bars.fillRect(left, bottom - 18, healthWidth * healthFraction, 12);

    // Super-Aufladung, direkt ueber dem Lebensbalken.
    const superY = bottom - 40;
    const superWidth = 140;
    const ready = this.model.superCharge >= 100;
    this.bars.fillStyle(0x000000, 0.5);
    this.bars.fillRect(left - 2, superY - 2, superWidth + 4, 12);
    this.bars.fillStyle(ready ? COLORS.superReady : COLORS.hudDim, 1);
    this.bars.fillRect(left, superY, (superWidth * Math.min(100, this.model.superCharge)) / 100, 8);

    if (this.model.down) {
      // Fortschrittsring der eigenen Wiederbelebung.
      const fraction = Math.min(1, this.model.reviveProgress / 3);
      this.bars.fillStyle(0x000000, 0.5);
      this.bars.fillRect(VIEWPORT.width / 2 - 92, VIEWPORT.height / 2 + 30, 184, 14);
      this.bars.fillStyle(COLORS.mate, 1);
      this.bars.fillRect(VIEWPORT.width / 2 - 90, VIEWPORT.height / 2 + 32, 180 * fraction, 10);
    }
  }

  private updateAnnouncement(): void {
    if (this.model.connectionMessage) {
      this.announceText.setText(this.model.connectionMessage);
      this.announceText.setColor("#e4572e");
      return;
    }

    if (this.model.down) {
      this.announceText.setText("Am Boden - ein Mitspieler kann dich aufheben");
      this.announceText.setColor("#e4572e");
      return;
    }

    /*
     * Die Extraktion geht allem anderen vor.
     *
     * Sie ist der einzige Moment im Run, in dem eine Sekunde zaehlt: Wer die
     * Zone verlaesst, faengt von vorn an. Ein Hinweis zur sicheren Zone waere
     * daneben bestenfalls egal.
     */
    if (this.model.extraction >= 0) {
      const seconds = Math.ceil(EXTRACTION_SECONDS * (1 - this.model.extraction));
      // "Wer steht", nicht "alle": Seit 2026-09-24 zaehlen Gefallene nicht
      // mehr mit (siehe `stepExtraction`). Der Text soll genau das sagen.
      this.announceText.setText(`Extraktion läuft - ${seconds}\nWer steht, bleibt in der Zone`);
      this.announceText.setColor("#7ee08a");
      return;
    }

    /*
     * In der sicheren Zone steht hier, was dort gilt - sonst nichts.
     *
     * Der Hinweis ersetzt kein Tutorial, aber er erklaert die Regel, die man
     * sonst nirgends ablesen koennte: dass man hier heilt. Draussen bleibt die
     * Zeile leer, damit sie nicht im Gefecht im Weg steht.
     */
    if (this.model.inSafeZone) {
      this.announceText.setText("Sichere Zone - hier heilst du");
      this.announceText.setColor("#7ee08a");
      return;
    }

    this.announceText.setText("");
  }
}
