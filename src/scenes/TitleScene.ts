/**
 * Titelbildschirm: Neu, Laden, Einstellungen.
 *
 * Seit 2026-09-26 der erste Bildschirm nach dem Laden (vorher sofort die
 * Charakterwahl). Rueckmeldung: "zuerst ein Speichersystem - neu, laden und
 * Einstellungen; wenn neu, dann solo oder koop usw."
 *
 * Ablauf:
 *   Neu            -> Platz waehlen -> Solo/Koop -> Charakter -> Packen -> ...
 *   Laden          -> Platz waehlen -> (laufender Run) Karte
 *                                   -> (sonst) Solo/Koop -> Charakter -> ...
 *   Einstellungen  -> Ton, Vollbild, App installieren, Spielstand loeschen
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { SAFE, VIEWPORT } from "../config/constants";
import { STORY } from "../config/story";
import { UI } from "../config/ui";
import { setReloadSafe } from "../platform/update";
import { loadHighscore } from "../storage/highscore";
import { listSlots } from "../storage/saveSlots";
import { Button } from "../ui/Button";
import { menuBackground, menuText } from "../ui/menuStyle";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    // Hier darf eine wartende neue Version sofort greifen - es laeuft nichts.
    setReloadSafe(true);
    menuBackground(this);

    // Musik wie frueher im Menue: sofort (Rueckweg aus einem Run) und beim
    // ersten Antippen (Browser geben Ton erst nach einer Beruehrung frei).
    audio.setMusic("menu");
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      audio.unlock();
      audio.setMusic("menu");
    });

    const centerX = VIEWPORT.width / 2;
    menuText(this, centerX, 96, "Holdout", 60, UI.text.title, true);
    menuText(this, centerX, 150, STORY.title, 18, UI.text.accent, true);

    const hasSaves = listSlots().some((slot) => slot !== null);

    new Button(this, centerX, 232, "Neu", () => this.scene.start("Slots", { mode: "new" }), {
      width: 300,
    });
    const load = new Button(
      this,
      centerX,
      302,
      "Laden",
      () => this.scene.start("Slots", { mode: "load" }),
      { width: 300 },
    );
    // Ohne Spielstand gibt es nichts zu laden - grau statt versteckt, damit
    // man sieht, dass es den Weg gibt.
    load.setEnabled(hasSaves);
    new Button(this, centerX, 372, "Einstellungen", () => this.scene.start("Settings"), {
      width: 300,
      variant: "secondary",
    });

    const best = loadHighscore();
    menuText(
      this,
      centerX,
      438,
      best ? `Rekord: ${best.score} Punkte` : "Halte durch, solange du kannst.",
      14,
      UI.text.muted,
    );

    // Versionsnummer: Diagnose, welcher Stand auf dem Geraet laeuft.
    this.add
      .text(VIEWPORT.width - SAFE.right - 10, VIEWPORT.height - SAFE.bottom - 8, `v${__APP_VERSION__}`, {
        fontFamily: UI.font,
        fontSize: "11px",
        color: "#a8977a",
      })
      .setOrigin(1, 1);
  }
}
