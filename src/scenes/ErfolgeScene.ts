/**
 * Erfolge: was man schon geschafft hat (und was noch fehlt). Jeder Erfolg gibt
 * beim ersten Mal Altgold. Darunter ein paar Zahlen ueber alle Laeufe.
 */

import Phaser from "phaser";
import { SAFE, VIEWPORT } from "../config/constants";
import { ACHIEVEMENTS } from "../game/meta";
import { loadProfile } from "../platform/profileStore";
import { setReloadSafe } from "../platform/update";
import { BOX, ComicBox } from "../ui/ComicBox";
import { altgoldBadge, label, menuBackdrop } from "../ui/menu";
import { T } from "../ui/theme";

export class ErfolgeScene extends Phaser.Scene {
  constructor() {
    super("Erfolge");
  }

  create(): void {
    setReloadSafe(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setReloadSafe(false));
    const profile = loadProfile();
    menuBackdrop(this, `ERFOLGE ${profile.achievements.length} / ${ACHIEVEMENTS.length}`, () =>
      this.scene.start("Title"),
    );
    altgoldBadge(this, profile.altgold);
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    const left = SAFE.left + 12;
    const room = w - SAFE.left - SAFE.right - 24;
    const colW = Math.floor((room - 8) / 2);
    const perColumn = Math.ceil(ACHIEVEMENTS.length / 2);
    const top = 66;
    const rowH = Math.floor((h - top - SAFE.bottom - 40) / perColumn);
    ACHIEVEMENTS.forEach((a, i) => {
      const done = profile.achievements.includes(a.id);
      const x = left + Math.floor(i / perColumn) * (colW + 8);
      const y = top + (i % perColumn) * rowH;
      new ComicBox(this, done ? BOX.panel : BOX.inset, x + colW / 2, y + rowH / 2, colW, rowH - 4);
      // Gruener Punkt = geschafft.
      this.add
        .circle(x + 22, y + rowH / 2 - 2, 7, done ? 0x6cd26a : 0x2a2636)
        .setStrokeStyle(2, 0x120f1e);
      label(this, a.name, x + 40, y + 6, 14, done ? T.gold : T.light);
      label(this, a.text, x + 40, y + 24, 11, T.muted, { width: colW - 130 });
      label(
        this,
        `${a.reward} Altgold`,
        x + colW - 12,
        y + rowH / 2 - 9,
        12,
        done ? T.muted : T.gold,
      ).setOrigin(1, 0);
    });
    const s = profile.stats;
    label(
      this,
      `Läufe ${s.runs} · Siege ${s.wins} · weiteste Station ${s.bestLayer} · Gegner insgesamt ${s.kills} · Hitze bis ${profile.heatUnlocked}`,
      w / 2,
      h - SAFE.bottom - 20,
      13,
      T.body,
      { align: "center" },
    ).setOrigin(0.5);
  }
}
