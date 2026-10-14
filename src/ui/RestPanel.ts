/**
 * Die Tafel in der Rast: ausbauen (Bau-Ansicht), Rumpf reparieren, weiterziehen.
 *
 * Sie liegt unten in der Mitte und laesst das Deck frei - waehrend der Rast kann
 * man noch herumlaufen und liegengebliebenen Schrott einsammeln.
 */

import Phaser from "phaser";
import { SAFE, VIEWPORT } from "../config/constants";
import { REPAIR_AMOUNT, REPAIR_COST } from "../game/constants";
import type { GameState } from "../game/types";
import { Button } from "./Button";
import { BOX, ComicBox } from "./ComicBox";
import { FONT_BODY, T } from "./theme";
import { DEPTH } from "./world/view";

const W = 580;
const H = 140;

export class RestPanel {
  private readonly panel: ComicBox;
  private readonly text: Phaser.GameObjects.Text;
  private readonly build: Button;
  private readonly repair: Button;
  private readonly depart: Button;
  private shown = true;

  constructor(
    scene: Phaser.Scene,
    onBuild: () => void,
    onRepair: () => void,
    onDepart: () => void,
  ) {
    this.panel = new ComicBox(scene, BOX.panel, 0, 0, W, H);
    this.panel.container.setScrollFactor(0);
    this.panel.setDepth(DEPTH.hud + 10);
    this.text = scene.add
      .text(0, 0, "", {
        fontFamily: FONT_BODY,
        fontSize: "15px",
        color: T.body,
        align: "center",
        lineSpacing: 4,
        wordWrap: { width: W - 40 },
      })
      .setOrigin(0.5, 0)
      .setStroke(T.outline, 3)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 11);
    this.build = new Button(scene, 0, 0, "AUSBAUEN", onBuild, {
      width: 160,
      height: 46,
      fontSize: 18,
    });
    this.repair = new Button(scene, 0, 0, "", onRepair, {
      width: 196,
      height: 46,
      fontSize: 16,
      variant: "secondary",
    });
    this.depart = new Button(scene, 0, 0, "WEITERZIEHEN ▶", onDepart, {
      width: 180,
      height: 46,
      fontSize: 18,
    });
    for (const button of [this.build, this.repair, this.depart]) {
      button.setDepth(DEPTH.hud + 12);
      button.setScrollFactor(0);
    }
    this.layout();
    this.setVisible(false);
  }

  layout(): void {
    const x = VIEWPORT.width / 2;
    const top = VIEWPORT.height - SAFE.bottom - H - 10;
    this.panel.setPosition(x, top + H / 2);
    this.text.setPosition(x, top + 16);
    this.build.setPosition(x - 196, top + H - 36);
    this.repair.setPosition(x - 8, top + H - 36);
    this.depart.setPosition(x + 186, top + H - 36);
  }

  update(state: GameState, building: boolean): void {
    const visible = state.phase === "rest" && !building;
    this.setVisible(visible);
    if (!visible) {
      return;
    }
    const f = state.fort;
    const missing = f.hullMax - f.hull;
    this.text.setText(
      `Rast: ${state.restAt}. Die Armee ist zurückgefallen – sammelt den Schrott am Boden.\nRumpf ${Math.ceil(f.hull)} / ${f.hullMax} · Schrott ${state.bank} · Vorsprung ${state.lead}`,
    );
    this.repair.setText(`REPARIEREN +${REPAIR_AMOUNT} · ${REPAIR_COST}`);
    this.repair.setEnabled(missing > 0 && state.bank >= REPAIR_COST);
  }

  private setVisible(visible: boolean): void {
    if (visible === this.shown) {
      return;
    }
    this.shown = visible;
    this.panel.setVisible(visible);
    this.text.setVisible(visible);
    this.build.setVisible(visible);
    this.repair.setVisible(visible);
    this.depart.setVisible(visible);
  }

  destroy(): void {
    this.panel.destroy();
    this.text.destroy();
    this.build.destroy();
    this.repair.destroy();
    this.depart.destroy();
  }
}
