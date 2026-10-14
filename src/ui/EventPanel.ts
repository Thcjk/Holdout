/**
 * Ein Ereignis an der Station: Lage beschreiben, zwei Moeglichkeiten zur Wahl.
 * Liegt in der Mitte ueber dem Spiel, bis entschieden ist.
 */

import Phaser from "phaser";
import { VIEWPORT } from "../config/constants";
import { EVENTS, affordable } from "../game/data/events";
import type { GameState } from "../game/types";
import { Button } from "./Button";
import { BOX, ComicBox } from "./ComicBox";
import { FONT_BODY, FONT_TITLE, T } from "./theme";
import { DEPTH } from "./world/view";

const W = 560;
const H = 260;

export class EventPanel {
  private objects: { destroy(): void }[] = [];
  private shownId: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onChoose: (option: number) => void,
  ) {}

  /** Zeigt das Ereignis, solange eins ansteht (und nichts anderes offen ist). */
  update(state: GameState, blocked: boolean): void {
    const id = state.phase === "rest" && !blocked ? (state.event?.id ?? null) : null;
    if (id === this.shownId) {
      return;
    }
    this.clear();
    this.shownId = id;
    const event = id ? EVENTS.find((e) => e.id === id) : undefined;
    if (!event) {
      return;
    }
    const cx = VIEWPORT.width / 2;
    const cy = VIEWPORT.height / 2 + 20;
    const fixed = <O extends Phaser.GameObjects.Components.ScrollFactor>(o: O): O => {
      o.setScrollFactor(0);
      return o;
    };
    const shade = fixed(
      this.scene.add
        .rectangle(0, 0, VIEWPORT.width, VIEWPORT.height, 0x0e0a12, 0.55)
        .setOrigin(0, 0)
        .setDepth(DEPTH.hud + 14)
        .setInteractive(),
    );
    const panel = new ComicBox(this.scene, BOX.panel, cx, cy, W, H);
    panel.container.setScrollFactor(0);
    panel.setDepth(DEPTH.hud + 15);
    const title = fixed(
      this.scene.add
        .text(cx, cy - H / 2 + 28, event.title.toUpperCase(), {
          fontFamily: FONT_TITLE,
          fontSize: "34px",
          color: T.gold,
        })
        .setOrigin(0.5)
        .setStroke(T.outline, 6)
        .setDepth(DEPTH.hud + 16),
    );
    const text = fixed(
      this.scene.add
        .text(cx, cy - H / 2 + 56, event.text, {
          fontFamily: FONT_BODY,
          fontSize: "15px",
          color: T.body,
          align: "center",
          lineSpacing: 4,
          wordWrap: { width: W - 50 },
        })
        .setOrigin(0.5, 0)
        .setStroke(T.outline, 3)
        .setDepth(DEPTH.hud + 16),
    );
    this.objects.push(shade, panel, title, text);
    event.choices.forEach((choice, i) => {
      const x = cx + (i === 0 ? -132 : 132);
      const y = cy + H / 2 - 66;
      const button = new Button(
        this.scene,
        x,
        y,
        choice.label.toUpperCase(),
        () => this.onChoose(i),
        {
          width: 236,
          height: 48,
          fontSize: 18,
          variant: i === 0 ? "primary" : "secondary",
        },
      );
      button.setScrollFactor(0);
      button.setDepth(DEPTH.hud + 16);
      button.setEnabled(affordable(choice, state.bank));
      const result = fixed(
        this.scene.add
          .text(x, y + 36, choice.result, {
            fontFamily: FONT_BODY,
            fontSize: "13px",
            color: T.cyan,
            align: "center",
          })
          .setOrigin(0.5, 0)
          .setStroke(T.outline, 3)
          .setDepth(DEPTH.hud + 16),
      );
      this.objects.push(button, result);
    });
  }

  private clear(): void {
    for (const o of this.objects) {
      o.destroy();
    }
    this.objects = [];
  }

  destroy(): void {
    this.clear();
  }
}
