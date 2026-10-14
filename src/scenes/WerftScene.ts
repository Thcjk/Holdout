/**
 * Die Werft: Altgold aus den Laeufen ausgeben.
 *
 * Drei Spalten: neue Mechs, Bauplaene (Module, die dann im Angebot auftauchen
 * koennen) und Verbesserungen der Festung. Alles bleibt fuer immer.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { SAFE, VIEWPORT } from "../config/constants";
import { CREW, CREW_IDS } from "../game/data/crew";
import { MODULES } from "../game/data/modules";
import {
  BLUEPRINT_COST,
  UPGRADES,
  UPGRADE_IDS,
  buyUpgrade,
  checkProfileAchievements,
  unlockBlueprint,
  unlockCrew,
  upgradePrice,
} from "../game/meta";
import type { ModuleId } from "../game/types";
import { loadProfile, saveProfile } from "../platform/profileStore";
import { setReloadSafe } from "../platform/update";
import { Button } from "../ui/Button";
import { BOX, ComicBox } from "../ui/ComicBox";
import { altgoldBadge, label, menuBackdrop } from "../ui/menu";
import { crewKey, moduleKey } from "../ui/pixel/textures";
import { FONT_TITLE, T } from "../ui/theme";

interface Row {
  icon: string;
  iconScale: number;
  name: string;
  text: string;
  /** Preis, oder null = schon gekauft / voll. */
  price: number | null;
  done: string;
  buy: () => boolean;
}

export class WerftScene extends Phaser.Scene {
  private dynamic: { destroy(): void }[] = [];
  private gold!: Phaser.GameObjects.Text;

  constructor() {
    super("Werft");
  }

  create(): void {
    setReloadSafe(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setReloadSafe(false));
    this.dynamic = [];
    menuBackdrop(this, "WERFT", () => this.scene.start("Title"));
    this.gold = altgoldBadge(this, loadProfile().altgold);
    this.render();
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
    const profile = loadProfile();
    this.gold.setText(`${profile.altgold}`);

    const crewRows: Row[] = CREW_IDS.filter((id) => CREW[id].unlock > 0).map((id) => ({
      icon: crewKey(id),
      iconScale: 0.6,
      name: CREW[id].name,
      text: CREW[id].passive,
      price: profile.crew.includes(id) ? null : CREW[id].unlock,
      done: "dabei",
      buy: () => unlockCrew(profile, id),
    }));
    const blueprintRows: Row[] = (Object.keys(BLUEPRINT_COST) as ModuleId[]).map((id) => ({
      icon: moduleKey(id),
      iconScale: MODULES[id].width === 2 ? 0.5 : 0.7,
      name: MODULES[id].name,
      text: MODULES[id].text,
      price: profile.blueprints.includes(id) ? null : (BLUEPRINT_COST[id] ?? 0),
      done: "im Angebot",
      buy: () => unlockBlueprint(profile, id),
    }));
    const upgradeRows: Row[] = UPGRADE_IDS.map((id) => {
      const level = profile.upgrades[id];
      const spec = UPGRADES[id];
      return {
        icon: "",
        iconScale: 1,
        name: `${spec.name} ${level}/${spec.max}`,
        text: `${spec.text} je Stufe`,
        price: upgradePrice(id, level),
        done: "voll",
        buy: () => buyUpgrade(profile, id),
      };
    });

    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    const left = SAFE.left + 12;
    const room = w - SAFE.left - SAFE.right - 24;
    const colW = Math.floor((room - 16) / 3);
    const columns: [string, Row[]][] = [
      ["MECHS", crewRows],
      ["BAUPLÄNE", blueprintRows],
      ["FESTUNG", upgradeRows],
    ];
    columns.forEach(([title, rows], c) => {
      const x = left + c * (colW + 8);
      const top = 70;
      const height = h - top - SAFE.bottom - 12;
      this.keep(new ComicBox(this, BOX.inset, x + colW / 2, top + height / 2, colW, height));
      this.keep(label(this, title, x + 12, top + 6, 24, T.cyan, { font: FONT_TITLE }));
      const rowH = Math.min(74, Math.floor((height - 44) / Math.max(1, rows.length)));
      rows.forEach((row, i) => {
        const y = top + 40 + i * rowH;
        if (row.icon) {
          this.keep(this.add.image(x + 30, y + rowH / 2 - 4, row.icon).setScale(row.iconScale));
        }
        const textX = row.icon ? x + 58 : x + 14;
        this.keep(label(this, row.name, textX, y + 2, 14, T.light));
        this.keep(
          label(this, row.text, textX, y + 20, 11, T.muted, { width: colW - (textX - x) - 92 }),
        );
        if (row.price === null) {
          this.keep(label(this, row.done, x + colW - 12, y + 12, 13, T.good).setOrigin(1, 0));
          return;
        }
        const button = this.keep(
          new Button(this, x + colW - 48, y + rowH / 2 - 6, `${row.price}`, () => this.buy(row), {
            width: 76,
            height: 38,
            fontSize: 18,
          }),
        );
        button.setEnabled(profile.altgold >= row.price);
      });
    });
  }

  private buy(row: Row): void {
    const profile = loadProfile();
    if (!row.buy()) {
      audio.play("playerHit");
      return;
    }
    checkProfileAchievements(profile);
    saveProfile(profile);
    audio.play("superReady");
    this.render();
  }
}
