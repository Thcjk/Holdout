/**
 * Die Schmiede: Kristalle gegen dauerhafte Verbesserungen tauschen.
 *
 * Zwoelf Karten, je eine Verbesserung: Symbol, Name, Stufe (Punkte), was sie
 * bringt und ein Knopf mit dem Preis der naechsten Stufe. Nach jedem Kauf wird
 * die Ansicht neu aufgebaut; neue Erfolge erscheinen kurz als Meldung.
 */

import Phaser from "phaser";
import { SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { FORGE, forgeCost, FORGE_MAX_TOTAL, forgeTotal, type ForgeDef } from "../meta/forge";
import { buyForge } from "../meta/goals";
import { loadProfile, saveProfile } from "../meta/profile";
import { Button } from "../ui/Button";
import { forgeIconKey } from "../ui/icons";
import { menuBackground, menuText, woodPanel } from "../ui/menuStyle";

const COLUMNS = 4;
const GAP = 10;

export class ForgeScene extends Phaser.Scene {
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private buttons: Button[] = [];
  private crystalText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("Forge");
  }

  create(): void {
    this.dynamic = [];
    this.buttons = [];
    menuBackground(this);
    const left = SAFE.left + 20;
    const right = VIEWPORT.width - SAFE.right - 20;
    menuText(this, VIEWPORT.width / 2, 32, "Die Schmiede", 32, UI.text.title, true);
    new Button(this, left + 50, 32, "‹ Zurück", () => this.scene.start("Title"), { width: 100, height: 44, fontSize: 18, variant: "secondary" });

    // Kristalle oben rechts
    woodPanel(this, right - 76, 32, 150, 46);
    this.add.image(right - 128, 32, "crystal").setDisplaySize(30, 30);
    this.crystalText = this.add
      .text(right - 18, 33, "", { fontFamily: UI.font, fontSize: "24px", color: "#2f6fa8", fontStyle: "bold" })
      .setOrigin(1, 0.5);

    this.build();
  }

  private build(): void {
    for (const object of this.dynamic) {
      object.destroy();
    }
    for (const button of this.buttons) {
      button.destroy();
    }
    this.dynamic = [];
    this.buttons = [];

    const profile = loadProfile();
    this.crystalText?.setText(String(profile.crystals));
    const left = SAFE.left + 20;
    const width = VIEWPORT.width - SAFE.left - SAFE.right - 40;
    const cardW = (width - GAP * (COLUMNS - 1)) / COLUMNS;
    const cardH = 132;
    const top = 66;

    FORGE.forEach((def, index) => {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = left + col * (cardW + GAP) + cardW / 2;
      const y = top + row * (cardH + GAP) + cardH / 2;
      this.card(def, x, y, cardW, cardH, profile.forge[def.id] ?? 0, profile.crystals);
    });

    const total = forgeTotal(profile.forge);
    this.dynamic.push(menuText(this, VIEWPORT.width / 2, 516, `Ausgebaut: ${total} von ${FORGE_MAX_TOTAL} Stufen · Kristalle gibt es für jeden Lauf und für Erfolge.`, 16, UI.text.body, true));
  }

  private card(def: ForgeDef, x: number, y: number, w: number, h: number, level: number, crystals: number): void {
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.dynamic.push(object);
      return object;
    };
    add(woodPanel(this, x, y, w, h) as unknown as Phaser.GameObjects.GameObject);
    const left = x - w / 2 + 14;
    add(this.add.image(left + 22, y - 32, forgeIconKey(def.id)).setDisplaySize(46, 46));
    add(
      this.add
        .text(left + 52, y - 46, def.name, { fontFamily: UI.font, fontSize: "18px", color: UI.text.dark, fontStyle: "bold" })
        .setOrigin(0, 0.5),
    );
    add(
      this.add.text(left + 52, y - 24, `${def.text} je Stufe`, { fontFamily: UI.font, fontSize: "13px", color: UI.text.body }).setOrigin(0, 0.5),
    );
    // Stufen als Punkte
    const pip = Math.min(14, (w - 40) / def.maxLevel);
    for (let i = 0; i < def.maxLevel; i += 1) {
      add(
        this.add
          .circle(left + 6 + i * pip + pip / 2, y + 2, pip * 0.36, i < level ? 0xf0b23e : 0xe2cc9c)
          .setStrokeStyle(1.5, 0x2a201b),
      );
    }
    add(
      this.add
        .text(x + w / 2 - 14, y + 2, `${level}/${def.maxLevel}`, { fontFamily: UI.font, fontSize: "14px", color: UI.text.muted, fontStyle: "bold" })
        .setOrigin(1, 0.5),
    );

    const cost = forgeCost(def.id, level);
    const label = cost === null ? "Ausgebaut" : `Kaufen · ${cost}`;
    const button = new Button(this, x, y + 38, label, () => this.buy(def), { width: w - 24, height: 40, fontSize: 18, variant: cost === null ? "secondary" : "primary" });
    button.setEnabled(cost !== null && crystals >= cost);
    this.buttons.push(button);
    if (cost !== null) {
      add(this.add.image(x + w / 2 - 34, y + 37, "crystal").setDisplaySize(20, 20).setAlpha(crystals >= cost ? 1 : 0.5));
    }
  }

  private buy(def: ForgeDef): void {
    const profile = loadProfile();
    const progress = buyForge(profile, def.id);
    if (!progress) {
      return;
    }
    saveProfile(profile);
    this.build();
    for (const [index, achievement] of progress.achievements.entries()) {
      this.toast(`Erfolg: ${achievement.name}  +${achievement.reward}`, index);
    }
  }

  private toast(text: string, index: number): void {
    const label = this.add
      .text(VIEWPORT.width / 2, 470 - index * 36, text, {
        fontFamily: UI.font,
        fontSize: "20px",
        color: "#3a2410",
        backgroundColor: "#f0b23e",
        padding: { x: 14, y: 6 },
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1000);
    this.tweens.add({ targets: label, alpha: 0, y: label.y - 20, delay: 1800, duration: 500, onComplete: () => label.destroy() });
  }
}
