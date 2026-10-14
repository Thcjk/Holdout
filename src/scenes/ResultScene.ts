/**
 * Ergebnis eines Laufs: geschafft oder Rumpf zerstoert, dazu ein paar Zahlen.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { VIEWPORT } from "../config/constants";
import { setReloadSafe } from "../platform/update";
import { Button } from "../ui/Button";
import { BOX, ComicBox } from "../ui/ComicBox";
import { TEX } from "../ui/pixel/textures";
import { FONT_BODY, FONT_TITLE, T } from "../ui/theme";
import { CREW } from "../game/data/crew";
import type { GameResult } from "./GameScene";

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("Result");
  }

  create(result: GameResult): void {
    setReloadSafe(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setReloadSafe(false));
    audio.setMusic("menu");
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    this.add.tileSprite(0, 0, w, h, TEX.ground).setOrigin(0, 0);
    this.add.rectangle(0, 0, w, h, 0x0e0a12, 0.5).setOrigin(0, 0);
    new ComicBox(this, BOX.panel, w / 2, h / 2, 520, 440);
    this.add
      .text(w / 2, h / 2 - 172, result.won ? "GESCHAFFT!" : "RUMPF ZERSTÖRT", {
        fontFamily: FONT_TITLE,
        fontSize: "58px",
        color: result.won ? T.gold : T.bad,
      })
      .setOrigin(0.5)
      .setStroke(T.outline, 8);
    const minutes = Math.floor(result.seconds / 60);
    const seconds = String(result.seconds % 60).padStart(2, "0");
    const lines = [
      result.won
        ? "Die Festung hat das Goldene Tor durchschritten."
        : `Gekommen bis Station ${result.marches} von ${result.count}.`,
      `${CREW[result.crew].name}${result.heat > 0 ? ` · Hitze ${result.heat}` : ""}`,
      `Gegner besiegt: ${result.kills} · Schrott gesammelt: ${result.scrap}`,
      result.won
        ? `Rumpf am Ziel: ${result.hull} · Zeit: ${minutes}:${seconds}`
        : `Zeit: ${minutes}:${seconds}`,
    ];
    this.add
      .text(w / 2, h / 2 - 128, lines.join("\n"), {
        fontFamily: FONT_BODY,
        fontSize: "18px",
        color: T.body,
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0)
      .setStroke(T.outline, 3);
    // Altgold und neue Erfolge
    this.add
      .text(w / 2, h / 2 + 2, `+${result.altgold} ALTGOLD`, {
        fontFamily: FONT_TITLE,
        fontSize: "40px",
        color: T.gold,
      })
      .setOrigin(0.5)
      .setStroke(T.outline, 6);
    const news = [
      ...result.achievements.map((name) => `Erfolg: ${name}`),
      ...(result.heatUnlocked ? [`Hitze ${result.heatUnlocked} freigeschaltet!`] : []),
    ];
    if (news.length > 0) {
      this.add
        .text(w / 2, h / 2 + 34, news.slice(0, 4).join("\n"), {
          fontFamily: FONT_BODY,
          fontSize: "15px",
          color: T.cyan,
          align: "center",
          lineSpacing: 3,
        })
        .setOrigin(0.5, 0)
        .setStroke(T.outline, 3);
    }
    new Button(this, w / 2 - 92, h / 2 + 172, "NOCHMAL", () => this.scene.start("Game"), {
      width: 168,
      height: 52,
      fontSize: 22,
    });
    new Button(this, w / 2 + 92, h / 2 + 172, "MENÜ", () => this.scene.start("Title"), {
      width: 168,
      height: 52,
      fontSize: 22,
      variant: "secondary",
    });
  }
}
