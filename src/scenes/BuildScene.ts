/**
 * Die Bau-Ansicht in der Rast: das Deck doppelt so gross, darauf das Raster.
 *
 * Unten liegt das Angebot dieser Rast (zufaellige Module, jedes einmal kaufbar),
 * daneben "Neu wuerfeln". Ein Modul antippen, dann ein gruenes Feld: gebaut.
 * Ein gebautes Modul antippen: rechts stehen seine Werte, Aufruesten, Abbauen.
 *
 * Die Szene liegt ueber dem Spiel. Sie aendert nichts selbst, sondern schickt
 * Befehle an die Sitzung und zeichnet sich neu, sobald sich der Zustand aendert.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { SAFE, VIEWPORT } from "../config/constants";
import {
  DECK_COLS,
  DECK_ROWS,
  REPAIR_AMOUNT,
  REPAIR_COST,
  TILE_H,
  TILE_W,
} from "../game/constants";
import { MODULES, sellValue, upgradeCost } from "../game/data/modules";
import { rerollCost as rerollPrice } from "../game/systems/modules";
import { canPlace, moduleAt, moduleCenter, tileFree } from "../game/deck";
import { FIXED_MODULES } from "../game/fortress";
import type { GameState, ModuleId, ModuleState } from "../game/types";
import type { GameSession } from "../net/GameSession";
import { Button } from "../ui/Button";
import { BOX, ComicBox } from "../ui/ComicBox";
import { levelName, moduleStats } from "../ui/moduleText";
import { DECK_X as BODY_DECK_X, DECK_Y as BODY_DECK_Y } from "../ui/pixel/festung";
import { TEX, moduleKey } from "../ui/pixel/textures";
import { C, FONT_BODY, FONT_TITLE, T } from "../ui/theme";

/** Ausschnitt der Festungs-Textur: Deck mit Gelaender und Rumpf. */
const CROP = {
  x: BODY_DECK_X - 6,
  y: BODY_DECK_Y - 24,
  w: DECK_COLS * TILE_W + 12,
  h: DECK_ROWS * TILE_H + 56,
};
const ZOOM = 2;
const PANEL_W = 236;

export interface BuildData {
  session: GameSession;
  onClose: () => void;
  /** Weiterziehen: Bau-Ansicht schliessen und die Karte zeigen. */
  onDepart: () => void;
}

export class BuildScene extends Phaser.Scene {
  private session!: GameSession;
  private onClose: () => void = () => undefined;
  private onDepart: () => void = () => undefined;
  private selectedOffer: ModuleId | null = null;
  private selectedModule: number | null = null;
  /** Alles, was bei einer Aenderung neu gezeichnet wird. */
  private dynamic: { destroy(): void }[] = [];
  private signature = "";
  private originX = 0;
  private originY = 0;

  constructor() {
    super("Build");
  }

  create(data: BuildData): void {
    this.session = data.session;
    this.onClose = data.onClose;
    this.onDepart = data.onDepart;
    this.selectedOffer = null;
    this.selectedModule = null;
    this.dynamic = [];
    this.signature = "";
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;

    // Deckt das Spiel ab und faengt alle Beruehrungen.
    this.add.rectangle(0, 0, w, h, 0x0e0a12, 0.97).setOrigin(0, 0).setInteractive();

    // Deck doppelt gross, mittig im Platz links von der Tafel.
    const areaLeft = SAFE.left + 10;
    const areaRight = w - SAFE.right - PANEL_W - 20;
    this.originX = Math.round(areaLeft + (areaRight - areaLeft - CROP.w * ZOOM) / 2);
    this.originY = 62;
    this.add
      .image(this.originX - CROP.x * ZOOM, this.originY - CROP.y * ZOOM, TEX.fortress)
      .setOrigin(0, 0)
      .setCrop(CROP.x, CROP.y, CROP.w, CROP.h)
      .setScale(ZOOM);

    // Ein unsichtbares Feld pro Kachel zum Antippen.
    for (let row = 0; row < DECK_ROWS; row += 1) {
      for (let col = 0; col < DECK_COLS; col += 1) {
        const r = this.tileRect(col, row);
        this.add
          .rectangle(r.x, r.y, r.w, r.h, 0x000000, 0)
          .setOrigin(0, 0)
          .setInteractive()
          .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.onTile(col, row));
      }
    }

    this.add
      .text(SAFE.left + 20, 30, `AUSBAU · ${this.state.restAt.toUpperCase()}`, {
        fontFamily: FONT_TITLE,
        fontSize: "38px",
        color: T.gold,
      })
      .setOrigin(0, 0.5)
      .setStroke(T.outline, 6);
    const back = new Button(this, w - SAFE.right - 70, 30, "ZURÜCK", () => this.close(), {
      width: 120,
      height: 40,
      fontSize: 16,
      variant: "secondary",
    });
    void back;
    this.render();
  }

  private get state(): GameState {
    return this.session.state;
  }

  update(): void {
    const s = this.state;
    if (s.phase !== "rest") {
      this.close();
      return;
    }
    const signature = JSON.stringify([
      s.bank,
      s.fort.hull,
      s.offer,
      s.rerolls,
      s.modules.map((m) => [m.uid, m.level]),
      this.selectedOffer,
      this.selectedModule,
    ]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.render();
    }
  }

  private close(): void {
    this.onClose();
    this.scene.stop();
  }

  // --- Koordinaten ---------------------------------------------------------------------------

  /** Bildschirmpunkt eines Punkts auf dem Deck (Zeichenkoordinaten relativ zur Deckecke). */
  private screen(lx: number, ly: number): { x: number; y: number } {
    return {
      x: this.originX + (BODY_DECK_X + lx - CROP.x) * ZOOM,
      y: this.originY + (BODY_DECK_Y + ly - CROP.y) * ZOOM,
    };
  }

  private tileRect(col: number, row: number): { x: number; y: number; w: number; h: number } {
    const p = this.screen(col * TILE_W, row * TILE_H);
    return { x: p.x, y: p.y, w: TILE_W * ZOOM, h: TILE_H * ZOOM };
  }

  // --- Bedienung -------------------------------------------------------------------------------

  private onTile(col: number, row: number): void {
    const s = this.state;
    if (this.selectedOffer) {
      const type = this.selectedOffer;
      // Breite Module: auch das rechte Feld antippen zaehlt.
      const anchor = canPlace(s.modules, type, col, row)
        ? col
        : canPlace(s.modules, type, col - 1, row)
          ? col - 1
          : null;
      if (anchor !== null && s.bank >= MODULES[type].cost) {
        this.session.send({ kind: "build", module: type, col: anchor, row });
        this.selectedOffer = null;
        this.selectedModule = null;
        return;
      }
    }
    const module = moduleAt(s.modules, col, row);
    this.selectedOffer = null;
    this.selectedModule = module ? module.uid : null;
  }

  private selectOffer(type: ModuleId): void {
    this.selectedOffer = this.selectedOffer === type ? null : type;
    this.selectedModule = null;
  }

  // --- Zeichnen --------------------------------------------------------------------------------

  private keep<O extends { destroy(): void }>(object: O): O {
    this.dynamic.push(object);
    return object;
  }

  private render(): void {
    for (const object of this.dynamic) {
      object.destroy();
    }
    this.dynamic = [];
    const s = this.state;
    this.drawGrid(s);
    this.drawModules(s);
    this.drawPanel(s);
    this.drawOffer(s);
  }

  private drawGrid(s: GameState): void {
    const g = this.keep(this.add.graphics());
    const type = this.selectedOffer;
    const affordable = type ? s.bank >= MODULES[type].cost : false;
    for (let row = 0; row < DECK_ROWS; row += 1) {
      for (let col = 0; col < DECK_COLS; col += 1) {
        const r = this.tileRect(col, row);
        if (!tileFree(s.modules, col, row)) {
          continue;
        }
        const valid =
          type !== null &&
          (canPlace(s.modules, type, col, row) || canPlace(s.modules, type, col - 1, row));
        if (valid && affordable) {
          g.fillStyle(0x6cf27a, 0.3).fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
          g.lineStyle(2, 0x6cf27a, 0.9).strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
        } else {
          g.lineStyle(1, C.cyan, type ? 0.15 : 0.35).strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
        }
      }
    }
    // Ausgewaehltes Modul: goldener Rahmen
    const selected = s.modules.find((m) => m.uid === this.selectedModule);
    if (selected) {
      const a = this.tileRect(selected.col, selected.row);
      const width = MODULES[selected.type].width * TILE_W * ZOOM;
      g.lineStyle(3, C.gold, 1).strokeRect(a.x + 2, a.y + 2, width - 4, a.h - 4);
    }
    // Generator-Verbindungen zu Waffen auf den Nachbarfeldern
    for (const gen of s.modules.filter((m) => m.type === "generator")) {
      for (const other of s.modules) {
        if (!MODULES[other.type].weapon) {
          continue;
        }
        const touches = Array.from(
          { length: MODULES[other.type].width },
          (_, i) => other.col + i,
        ).some((c) => Math.abs(c - gen.col) + Math.abs(other.row - gen.row) === 1);
        if (!touches) {
          continue;
        }
        const a = moduleCenter(gen);
        const b = moduleCenter(other);
        const pa = this.screen(a.x, a.y);
        const pb = this.screen(b.x, b.y);
        g.lineStyle(5, C.outline, 0.9).lineBetween(pa.x, pa.y, pb.x, pb.y);
        g.lineStyle(2, C.cyan, 1).lineBetween(pa.x, pa.y, pb.x, pb.y);
        const bonus = Math.round((MODULES.generator.power?.[gen.level - 1] ?? 0) * 100);
        this.keep(
          this.label(
            `+${bonus} %`,
            (pa.x + pb.x) / 2,
            (pa.y + pb.y) / 2 - 10,
            13,
            T.cyan,
          ).setOrigin(0.5),
        );
      }
    }
  }

  private drawModules(s: GameState): void {
    type Item = { bottom: number; draw: () => void };
    const items: Item[] = [];
    const place = (
      key: string,
      col: number,
      row: number,
      cols: number,
      rows: number,
      level = 0,
      flip = false,
    ): void => {
      const bottom = (row + rows) * TILE_H;
      items.push({
        bottom,
        draw: () => {
          const foot = this.screen((col + cols / 2) * TILE_W, bottom);
          this.keep(
            this.add.image(foot.x, foot.y, key).setOrigin(0.5, 1).setScale(ZOOM).setFlipX(flip),
          );
          for (let i = 0; i < level; i += 1) {
            this.keep(
              this.add.image(foot.x - (level - 1) * 7 + i * 14, foot.y - 6, TEX.pip).setScale(ZOOM),
            );
          }
        },
      });
    };
    for (const m of FIXED_MODULES) {
      place(moduleKey(m.id), m.col, m.row, m.cols, m.rows);
    }
    for (const m of s.modules) {
      place(
        moduleKey(m.type),
        m.col,
        m.row,
        MODULES[m.type].width,
        1,
        m.level,
        m.facing < 0 && MODULES[m.type].weapon === true,
      );
    }
    items.sort((a, b) => a.bottom - b.bottom).forEach((item) => item.draw());
  }

  private label(
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    font = FONT_BODY,
    wrap = 0,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        fontFamily: font,
        fontSize: `${size}px`,
        color,
        fontStyle: font === FONT_BODY ? "bold" : "normal",
        wordWrap: wrap > 0 ? { width: wrap } : undefined,
        lineSpacing: 3,
      })
      .setStroke(T.outline, Math.max(3, Math.round(size / 5)));
  }

  /** Tafel rechts: Angebot, gebautes Modul oder eine kurze Anleitung. */
  private drawPanel(s: GameState): void {
    const w = VIEWPORT.width;
    const x = w - SAFE.right - PANEL_W - 10;
    const y = 62;
    const height = 366;
    this.keep(new ComicBox(this, BOX.panel, x + PANEL_W / 2, y + height / 2, PANEL_W, height));
    const left = x + 16;
    const wrap = PANEL_W - 32;
    let cursor = y + 18;
    const line = (text: string, size: number, color: string, font = FONT_BODY, gap = 6): void => {
      const label = this.keep(this.label(text, left, cursor, size, color, font, wrap));
      cursor += label.height + gap;
    };

    const module = s.modules.find((m) => m.uid === this.selectedModule);
    const offer = this.selectedOffer;
    if (offer) {
      const spec = MODULES[offer];
      line(spec.name.toUpperCase(), 28, T.gold, FONT_TITLE, 2);
      line(
        `${spec.width === 2 ? "2 Felder" : "1 Feld"}${spec.edgeOnly ? " · nur am Rand" : ""}`,
        12,
        T.muted,
      );
      line(spec.text, 14, T.body, FONT_BODY, 10);
      line(moduleStats(offer, 1), 13, T.cyan, FONT_BODY, 12);
      if (s.bank >= spec.cost) {
        line(`Kostet ${spec.cost} Schrott. Tippe auf ein grünes Feld.`, 13, T.good);
      } else {
        line(`Kostet ${spec.cost} Schrott – zu wenig.`, 13, T.bad);
      }
      return;
    }
    if (module) {
      this.drawModuleInfo(s, module, line, x, y + height);
      return;
    }
    line("FESTUNG AUSBAUEN", 28, T.gold, FONT_TITLE, 6);
    line("Wähle unten ein Modul und tippe dann auf ein freies Feld.", 14, T.body, FONT_BODY, 8);
    line("Gebaute Module antippen: aufrüsten oder abbauen.", 14, T.body, FONT_BODY, 8);
    line("Das Angebot ist bei jeder Rast neu.", 14, T.muted, FONT_BODY, 12);
    line(`Rumpf ${Math.ceil(s.fort.hull)} / ${s.fort.hullMax}`, 15, T.light);
    const repair = this.keep(
      new Button(
        this,
        x + PANEL_W / 2,
        y + height - 36,
        `REPARIEREN +${REPAIR_AMOUNT} · ${REPAIR_COST}`,
        () => this.session.send({ kind: "repair" }),
        {
          width: PANEL_W - 28,
          height: 44,
          fontSize: 16,
          variant: "secondary",
        },
      ),
    );
    repair.setEnabled(s.bank >= REPAIR_COST && s.fort.hull < s.fort.hullMax);
  }

  private drawModuleInfo(
    s: GameState,
    m: ModuleState,
    line: (text: string, size: number, color: string, font?: string, gap?: number) => void,
    x: number,
    bottom: number,
  ): void {
    const spec = MODULES[m.type];
    line(`${spec.name.toUpperCase()} ${levelName(m.level)}`, 28, T.gold, FONT_TITLE, 4);
    line(spec.text, 14, T.body, FONT_BODY, 10);
    line(moduleStats(m.type, m.level), 13, T.cyan, FONT_BODY, 10);
    const cost = upgradeCost(m.type, m.level);
    if (cost !== null) {
      line(
        `Stufe ${levelName(m.level + 1)}: ${moduleStats(m.type, m.level + 1)}`,
        12,
        T.muted,
        FONT_BODY,
        6,
      );
    } else {
      line("Höchste Stufe erreicht.", 12, T.muted);
    }
    const upgrade = this.keep(
      new Button(
        this,
        x + PANEL_W / 2,
        bottom - 88,
        cost !== null ? `AUFRÜSTEN · ${cost}` : "STUFE III",
        () => this.session.send({ kind: "upgrade", uid: m.uid }),
        {
          width: PANEL_W - 28,
          height: 46,
          fontSize: 18,
        },
      ),
    );
    upgrade.setEnabled(cost !== null && s.bank >= cost);
    this.keep(
      new Button(
        this,
        x + PANEL_W / 2,
        bottom - 36,
        `ABBAUEN +${sellValue(m.type, m.level)}`,
        () => {
          this.session.send({ kind: "sell", uid: m.uid });
          this.selectedModule = null;
        },
        { width: PANEL_W - 28, height: 40, fontSize: 16, variant: "secondary" },
      ),
    );
  }

  /** Unten: das Angebot, Neu wuerfeln, Weiterziehen, Schrott. */
  private drawOffer(s: GameState): void {
    const w = VIEWPORT.width;
    const top = VIEWPORT.height - SAFE.bottom - 98;
    // Beim Haendler gibt es mehr Karten - dann werden sie schmaler.
    const room = w - SAFE.left - SAFE.right - 20 - 140 - 200;
    const cardW = Math.min(128, Math.floor(room / Math.max(1, s.offer.length)) - 8);
    const cardH = 90;
    let x = SAFE.left + 10;
    for (const type of s.offer) {
      const spec = MODULES[type];
      const selected = this.selectedOffer === type;
      const affordable = s.bank >= spec.cost;
      this.keep(
        new ComicBox(
          this,
          selected ? BOX.primary : BOX.panel,
          x + cardW / 2,
          top + cardH / 2,
          cardW,
          cardH,
        ),
      );
      const icon = this.keep(
        this.add
          .image(x + cardW / 2, top + 58, moduleKey(type))
          .setOrigin(0.5, 1)
          .setScale((spec.width === 2 ? 0.85 : 1) * Math.min(1, cardW / 128)),
      );
      icon.setAlpha(affordable ? 1 : 0.5);
      this.keep(
        this.label(spec.name, x + cardW / 2, top + 64, 12, selected ? T.dark : T.light)
          .setOrigin(0.5, 0)
          .setStroke(T.outline, selected ? 0 : 3),
      );
      this.keep(this.add.image(x + cardW / 2 - 16, top + 18, TEX.gear).setScale(0.8));
      this.keep(
        this.label(
          `${spec.cost}`,
          x + cardW / 2 + 2,
          top + 18,
          18,
          affordable ? (selected ? T.dark : "#e6eaf2") : T.bad,
          FONT_TITLE,
        )
          .setOrigin(0, 0.5)
          .setStroke(T.outline, selected ? 0 : 4),
      );
      const hit = this.keep(
        this.add.rectangle(x, top, cardW, cardH, 0x000000, 0).setOrigin(0, 0).setInteractive(),
      );
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.selectOffer(type));
      x += cardW + 8;
    }
    if (s.offer.length === 0) {
      this.keep(
        this.label("Angebot ausverkauft", x + 12, top + cardH / 2, 15, T.muted).setOrigin(0, 0.5),
      );
      x += 200;
    }
    const rerollCost = rerollPrice(s);
    const reroll = this.keep(
      new Button(
        this,
        x + 66,
        top + cardH / 2,
        `NEU · ${rerollCost}`,
        () => {
          audio.play("pickup");
          this.selectedOffer = null;
          this.session.send({ kind: "reroll" });
        },
        { width: 124, height: 50, fontSize: 17, variant: "secondary" },
      ),
    );
    reroll.setEnabled(s.bank >= rerollCost);
    // Schrott und Weiterziehen rechts
    const right = w - SAFE.right - 10;
    this.keep(new ComicBox(this, BOX.panel, right - 90, top + 22, 180, 44));
    this.keep(this.add.image(right - 160, top + 22, TEX.gear));
    this.keep(this.label("Schrott", right - 142, top + 22, 12, T.muted).setOrigin(0, 0.5));
    this.keep(
      this.label(`${s.bank}`, right - 14, top + 21, 30, "#e6eaf2", FONT_TITLE).setOrigin(1, 0.5),
    );
    this.keep(
      new Button(
        this,
        right - 90,
        top + 72,
        "WEITERZIEHEN ▶",
        () => {
          this.close();
          this.onDepart();
        },
        { width: 180, height: 46, fontSize: 18 },
      ),
    );
  }
}
