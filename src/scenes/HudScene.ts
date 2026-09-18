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
import { COLORS, DEPTH, SAFE, VIEWPORT } from "../config/constants";
import { audio } from "../audio/AudioEngine";
import { InputManager } from "../input/InputManager";
import { Button } from "../ui/Button";
import { SkillPanel } from "../ui/SkillPanel";
import type { HudModel } from "../ui/HudModel";

export interface HudSceneData {
  model: HudModel;
}


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
  private skillPanel!: SkillPanel;
  private skillHint!: Phaser.GameObjects.Text;
  private menuButton!: Button;

  constructor() {
    super("Hud");
  }

  init(data: HudSceneData): void {
    this.model = data.model;
  }

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
      topEdge + 88,
      audio.isMuted ? "Ton aus" : "Ton an",
      () => {
        const muted = audio.toggleMuted();
        this.muteButton.setText(muted ? "Ton aus" : "Ton an");
      },
      { width: 96, height: 30, fontSize: 13, color: COLORS.hudDim },
    );
    this.muteButton.setDepth(DEPTH.hud);

    // Menü und Ton liegen oben rechts unter der Punkteanzeige: Unten rechts
    // sitzt der Super-Knopf, und dort wuerde der Daumen sie staendig streifen.
    // Rueckweg ins Menue auch ohne Tastatur - auf dem Handy gibt es kein Esc.
    this.menuButton = new Button(
      this,
      rightEdge - 146,
      topEdge + 88,
      "Menü",
      () => {
        this.scene.stop("Game");
        this.scene.start("Menu");
      },
      { width: 80, height: 30, fontSize: 13, color: COLORS.hudDim },
    );
    this.menuButton.setDepth(DEPTH.hud);

    // Falls das Spiel direkt gestartet wurde: Ton beim ersten Antippen freigeben.
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      audio.unlock();
      audio.startMusic();
    });

    this.inputManager = new InputManager(this);

    // Die Auswahl schickt den Wunsch durch denselben Kanal wie jede andere
    // Eingabe - im Koop entscheidet dann der Host darueber.
    this.skillPanel = new SkillPanel(this, (skill) => this.inputManager.requestLevelUp(skill));

    this.skillHint = this.add
      .text(leftEdge, topEdge + 50, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setDepth(DEPTH.hud);

    this.ready = true;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.ready = false;
      this.inputManager.destroy();
      this.skillPanel.destroy();
    });
  }

  update(): void {
    if (!this.model) {
      return;
    }

    this.waveText.setText(this.model.wave > 0 ? `Welle ${this.model.wave}` : "Gleich geht es los");
    this.scoreText.setText(
      `Score ${this.model.score}\nRekord ${this.model.highscore}\nGegner ${this.model.enemiesLeft}`,
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
    this.updateSkills();
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
   * Punkte verteilt man in der Pause. Waehrend einer Welle erinnert nur eine
   * kleine Zeile daran - ein Menue mitten im Gefecht waere im Weg.
   */
  private updateSkills(): void {
    const inBreak = this.model.phase === "break" || this.model.phase === "preparing";
    this.skillPanel.update(this.model.skillPoints, this.model.skillLevels, inBreak);

    const showHint = this.model.skillPoints > 0 && !inBreak;
    this.skillHint.setVisible(showHint);
    if (showHint) {
      this.skillHint.setText(
        this.model.skillPoints === 1
          ? "1 Punkt frei - in der Pause verteilen"
          : `${this.model.skillPoints} Punkte frei - in der Pause verteilen`,
      );
    }
  }

  /**
   * Setzt alles neu, was an einer Bildschirmkante klebt.
   *
   * Wird bei jeder Aenderung der Entwurfsflaeche gerufen. Die Balken unten
   * links zeichnen sich ohnehin jedes Bild neu und rechnen dabei frisch - hier
   * geht es um die Texte und Knoepfe, die ihre Position nur einmal bekommen
   * haben.
   */
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
    this.skillHint.setPosition(leftEdge, topEdge + 50);
    this.announceText.setPosition(VIEWPORT.width / 2, 132);
    this.muteButton.setPosition(rightEdge - 44, topEdge + 88);
    this.menuButton.setPosition(rightEdge - 146, topEdge + 88);
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
      this.announceText.setColor("#ff5470");
      return;
    }

    if (this.model.down) {
      this.announceText.setText("Am Boden - ein Mitspieler kann dich aufheben");
      this.announceText.setColor("#ff5470");
      return;
    }

    switch (this.model.phase) {
      case "preparing":
        this.announceText.setText(`Bereitmachen\n${Math.ceil(Math.max(0, this.model.phaseTime))}`);
        this.announceText.setColor("#ffd166");
        break;
      case "break":
        this.announceText.setText(
          `Welle ${this.model.wave} geschafft\nNächste in ${Math.ceil(Math.max(0, this.model.phaseTime))}`,
        );
        this.announceText.setColor("#7ee08a");
        break;
      default:
        this.announceText.setText("");
        break;
    }
  }
}
