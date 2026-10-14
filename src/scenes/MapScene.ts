/**
 * Die Routenkarte: Wohin zieht die Festung als Naechstes?
 *
 * Spalten von Stationen, links der Start, rechts der Endgegner. Von der
 * aktuellen Station fuehren ein bis drei Wege weiter - die leuchten. Antippen
 * zeigt unten, was die Station bringt und was sie am Vorsprung kostet.
 * Von links rueckt die goldene Armee nach: Je kleiner der Vorsprung, desto
 * naeher ist sie. Bei 0 wird der naechste Marsch eine Heerschar.
 *
 * Wie die Bau-Ansicht liegt die Szene ueber dem Spiel und schickt nur Befehle.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { SAFE, VIEWPORT } from "../config/constants";
import { LEAD_MAX, NODES } from "../game/data/acts";
import type { GameState, MapNode } from "../game/types";
import type { GameSession } from "../net/GameSession";
import { Button } from "../ui/Button";
import { BOX, ComicBox } from "../ui/ComicBox";
import { TEX, nodeKey } from "../ui/pixel/textures";
import { FONT_BODY, FONT_TITLE, T } from "../ui/theme";

export interface MapData {
  session: GameSession;
  /** Nach dem Losziehen oder Zurueck. */
  onClose: () => void;
}

const INFO_H = 104;

export class MapScene extends Phaser.Scene {
  private session!: GameSession;
  private onClose: () => void = () => undefined;
  private selected: number | null = null;
  private dynamic: { destroy(): void }[] = [];
  private pulse: Phaser.GameObjects.Arc[] = [];
  private area = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    super("Map");
  }

  private get state(): GameState {
    return this.session.state;
  }

  create(data: MapData): void {
    this.session = data.session;
    this.onClose = data.onClose;
    this.dynamic = [];
    this.pulse = [];
    const s = this.state;
    const here = s.map.nodes[s.at]!;
    // Vorauswahl: die erste erreichbare Station.
    this.selected = here.next[0] ?? null;
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    this.add.rectangle(0, 0, w, h, 0x1a1116, 1).setOrigin(0, 0).setInteractive();
    this.add
      .image(w / 2, h / 2, TEX.ground)
      .setAlpha(0.35)
      .setScale(1.2);
    this.area = {
      x: SAFE.left + 70,
      y: 78,
      w: w - SAFE.left - SAFE.right - 140,
      h: h - 78 - INFO_H - SAFE.bottom - 34,
    };
    this.add
      .text(SAFE.left + 20, 30, `AKT ${s.map.act + 1} · ${s.map.name.toUpperCase()}`, {
        fontFamily: FONT_TITLE,
        fontSize: "38px",
        color: T.gold,
      })
      .setOrigin(0, 0.5)
      .setStroke(T.outline, 6);
    new Button(this, w - SAFE.right - 70, 30, "ZURÜCK", () => this.close(), {
      width: 120,
      height: 40,
      fontSize: 16,
      variant: "secondary",
    });
    this.drawLead(s);
    this.render();
    this.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 1100,
      repeat: -1,
      onUpdate: (tween) => {
        const v = tween.getValue() ?? 0;
        for (const ring of this.pulse) {
          ring.setScale(1 + Math.sin(v) * 0.08);
        }
      },
    });
  }

  /** Lage einer Station auf dem Bildschirm. */
  private spot(node: MapNode): { x: number; y: number } {
    const a = this.area;
    const layers = this.state.map.layers;
    return {
      x: a.x + (node.layer / (layers - 1)) * a.w,
      y: a.y + node.y * a.h,
    };
  }

  /** Vorsprung oben rechts als Punkte. */
  private drawLead(s: GameState): void {
    const x = VIEWPORT.width - SAFE.right - 150;
    this.add
      .text(x - 120, 30, "VORSPRUNG", { fontFamily: FONT_BODY, fontSize: "13px", color: T.muted })
      .setOrigin(1, 0.5)
      .setStroke(T.outline, 3);
    for (let i = 0; i < LEAD_MAX; i += 1) {
      this.add
        .rectangle(x - 110 + i * 18, 30, 12, 12, i < s.lead ? 0x5ef2e6 : 0x2a2636)
        .setStrokeStyle(2, 0x120f1e);
    }
  }

  private keep<O extends { destroy(): void }>(o: O): O {
    this.dynamic.push(o);
    return o;
  }

  private render(): void {
    for (const o of this.dynamic) {
      o.destroy();
    }
    this.dynamic = [];
    this.pulse = [];
    const s = this.state;
    const map = s.map;
    const here = map.nodes[s.at]!;
    const g = this.keep(this.add.graphics());

    // Die goldene Armee rueckt von links nach: so viele Spalten hinter der Festung,
    // wie der Vorsprung gross ist. Ist sie weiter weg, sieht man nur ihren Staub am Rand.
    const column = this.area.w / (map.layers - 1);
    const left = SAFE.left;
    const armyX = Math.max(left + 14, this.spot(here).x - (s.lead - 0.35) * column);
    if (armyX > left) {
      g.fillStyle(0xf0b23e, 0.18).fillRect(left, this.area.y - 20, armyX - left, this.area.h + 40);
      g.fillStyle(0xf0b23e, 0.5).fillRect(armyX - 2, this.area.y - 20, 3, this.area.h + 40);
      for (let i = 0; i < 26; i += 1) {
        const y = this.area.y - 10 + ((i * 37) % (this.area.h + 20));
        const x = armyX - 6 - ((i * 23) % 40);
        if (x > left) {
          g.fillStyle(0xeab43a, 1).fillRect(x, y, 2, 5);
          g.fillStyle(0xc8ccd8, 1).fillRect(x, y - 3, 2, 2);
        }
      }
      this.keep(
        this.add
          .text(Math.max(left + 50, armyX - 40), this.area.y + this.area.h + 14, "Goldene Armee", {
            fontFamily: FONT_BODY,
            fontSize: "12px",
            color: "#fff2a0",
          })
          .setOrigin(0.5)
          .setStroke(T.outline, 3),
      );
    }

    // Wege: gegangene golden, die moeglichen naechsten hell, der Rest blass.
    for (const node of map.nodes) {
      const a = this.spot(node);
      for (const id of node.next) {
        const target = map.nodes[id]!;
        const b = this.spot(target);
        const walked = s.path.includes(node.id) && s.path.includes(id);
        const option = node.id === s.at;
        const chosen = option && id === this.selected;
        const color = walked ? 0xf0b23e : chosen ? 0xffffff : option ? 0x5ef2e6 : 0xa08878;
        const alpha = walked || option ? 1 : 0.45;
        const steps = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 8);
        for (let k = 2; k < steps - 1; k += 1) {
          if (!walked && !option && k % 2 === 0) {
            continue;
          }
          const x = a.x + ((b.x - a.x) * k) / steps;
          const y = a.y + ((b.y - a.y) * k) / steps;
          g.fillStyle(color, alpha).fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
        }
      }
    }

    // Stationen
    for (const node of map.nodes) {
      const { x, y } = this.spot(node);
      const visited = s.path.includes(node.id);
      const option = here.next.includes(node.id);
      const boss = node.type === "boss";
      const r = boss ? 26 : 21;
      const fill = boss ? 0x5a1a14 : option ? 0x1f4a4e : visited ? 0x3a3036 : 0x2a2230;
      const ring = boss ? 0xff6a2a : option ? 0x5ef2e6 : visited ? 0x8a7a6a : 0xc8a060;
      this.keep(this.add.circle(x, y, r + 3, 0x120f1e));
      const disc = this.keep(this.add.circle(x, y, r, fill).setStrokeStyle(2, ring));
      if (node.id === this.selected) {
        this.keep(this.add.circle(x, y, r + 7).setStrokeStyle(3, 0xffffff));
      }
      if (option) {
        this.pulse.push(this.keep(this.add.circle(x, y, r + 5).setStrokeStyle(2, 0x5ef2e6, 0.8)));
        disc.setInteractive({ useHandCursor: true });
        disc.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
          audio.play("pickup");
          this.selected = node.id;
          this.render();
        });
      }
      this.keep(
        this.add
          .image(x, y, nodeKey(node.type))
          .setScale(boss ? 2 : 1.5)
          .setAlpha(visited && node.id !== s.at ? 0.55 : 1),
      );
      if (node.id === s.at) {
        this.keep(this.add.image(x, y - r - 12, TEX.fortIcon).setScale(1.4));
      }
      if (option || boss || node.id === s.at) {
        this.keep(
          this.add
            .text(x, y + r + 10, node.name, {
              fontFamily: FONT_BODY,
              fontSize: "12px",
              color: option ? T.cyan : boss ? "#ff9a7a" : T.body,
            })
            .setOrigin(0.5)
            .setStroke(T.outline, 3),
        );
      }
    }
    this.drawInfo(s);
  }

  /** Unten: was die ausgewaehlte Station bringt, und Losziehen. */
  private drawInfo(s: GameState): void {
    const w = VIEWPORT.width;
    const top = VIEWPORT.height - SAFE.bottom - INFO_H - 8;
    const node = this.selected !== null ? s.map.nodes[this.selected] : undefined;
    const boxW = w - SAFE.left - SAFE.right - 20;
    this.keep(
      new ComicBox(this, BOX.panel, SAFE.left + 10 + boxW / 2, top + INFO_H / 2, boxW, INFO_H),
    );
    if (!node) {
      return;
    }
    const spec = NODES[node.type];
    const left = SAFE.left + 30;
    this.keep(this.add.image(left + 18, top + 32, nodeKey(node.type)).setScale(1.5));
    this.keep(
      this.add
        .text(left + 44, top + 22, `${node.name.toUpperCase()}  ·  ${spec.label}`, {
          fontFamily: FONT_TITLE,
          fontSize: "26px",
          color: T.gold,
        })
        .setOrigin(0, 0.5)
        .setStroke(T.outline, 5),
    );
    const leadAfter = Math.min(LEAD_MAX, s.lead + spec.lead);
    const leadText =
      spec.lead === 0 ? "Vorsprung bleibt" : `Vorsprung ${spec.lead > 0 ? "+" : ""}${spec.lead}`;
    const horde = leadAfter <= 0;
    this.keep(
      this.add
        .text(left + 44, top + 44, spec.text || "Der nächste Abschnitt des Weges.", {
          fontFamily: FONT_BODY,
          fontSize: "14px",
          color: T.body,
          wordWrap: { width: boxW - 270 },
        })
        .setOrigin(0, 0)
        .setStroke(T.outline, 3),
    );
    this.keep(
      this.add
        .text(w - SAFE.right - 220, top + 22, horde ? `${leadText} → HEERSCHAR!` : leadText, {
          fontFamily: FONT_BODY,
          fontSize: "14px",
          color: horde ? T.bad : spec.lead > 0 ? T.good : spec.lead < 0 ? T.gold : T.muted,
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setStroke(T.outline, 3),
    );
    this.keep(
      new Button(
        this,
        w - SAFE.right - 120,
        top + INFO_H - 34,
        "LOSZIEHEN ▶",
        () => this.depart(node.id),
        { width: 190, height: 48, fontSize: 19 },
      ),
    );
  }

  private depart(node: number): void {
    this.session.send({ kind: "depart", node });
    this.close();
  }

  private close(): void {
    this.onClose();
    this.scene.stop();
  }
}
