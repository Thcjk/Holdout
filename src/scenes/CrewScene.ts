/**
 * Vor dem Lauf: Welcher Mech zieht los, und auf welcher Hitze?
 *
 * Oben die sechs Mechs (gesperrte dunkel, mit Preis in der Werft), darunter
 * alles ueber den gewaehlten: Waffe, Faehigkeit, Eigenheit. Unten links die
 * Hitze (erst nach dem ersten Sieg), rechts Losziehen.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { SAFE, VIEWPORT } from "../config/constants";
import { CREW, CREW_IDS } from "../game/data/crew";
import { heatEffects } from "../game/Simulation";
import type { CrewId } from "../game/types";
import { loadProfile, saveProfile } from "../platform/profileStore";
import { setReloadSafe } from "../platform/update";
import { Button } from "../ui/Button";
import { BOX, ComicBox } from "../ui/ComicBox";
import { label, menuBackdrop } from "../ui/menu";
import { crewKey } from "../ui/pixel/textures";
import { FONT_TITLE, T } from "../ui/theme";

export class CrewScene extends Phaser.Scene {
  private dynamic: { destroy(): void }[] = [];

  constructor() {
    super("Crew");
  }

  create(): void {
    setReloadSafe(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setReloadSafe(false));
    this.dynamic = [];
    menuBackdrop(this, "CREW WÄHLEN", () => this.scene.start("Title"));
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
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    const left = SAFE.left + 16;
    const room = w - SAFE.left - SAFE.right - 32;
    const cardW = Math.min(150, Math.floor(room / CREW_IDS.length) - 8);
    const total = CREW_IDS.length * (cardW + 8) - 8;
    const startX = left + (room - total) / 2;

    // Die sechs Mechs
    CREW_IDS.forEach((id, i) => {
      const spec = CREW[id];
      const x = startX + i * (cardW + 8) + cardW / 2;
      const y = 140;
      const unlocked = profile.crew.includes(id);
      const selected = profile.selected === id;
      this.keep(new ComicBox(this, selected ? BOX.primary : BOX.panel, x, y, cardW, 128));
      const portrait = this.keep(this.add.image(x, y - 10, crewKey(id)).setScale(1.3));
      if (!unlocked) {
        portrait.setTint(0x2a2636);
      }
      this.keep(
        label(this, spec.name.toUpperCase(), x, y + 44, 12, selected ? T.dark : T.light, {
          align: "center",
        })
          .setOrigin(0.5)
          .setStroke(T.outline, selected ? 0 : 3),
      );
      if (!unlocked) {
        this.keep(
          label(this, `Werft: ${spec.unlock}`, x, y - 10, 13, T.gold, {
            align: "center",
          }).setOrigin(0.5),
        );
      }
      const hit = this.keep(
        this.add
          .rectangle(x - cardW / 2, y - 64, cardW, 128, 0, 0)
          .setOrigin(0, 0)
          .setInteractive(),
      );
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.select(id));
    });

    // Der gewaehlte Mech im Detail
    const spec = CREW[profile.selected];
    const infoTop = 222;
    const infoH = h - infoTop - SAFE.bottom - 84;
    this.keep(new ComicBox(this, BOX.panel, w / 2, infoTop + infoH / 2, room, infoH));
    const tx = left + 24;
    this.keep(
      label(this, spec.name.toUpperCase(), tx, infoTop + 14, 28, T.gold, { font: FONT_TITLE }),
    );
    this.keep(
      label(this, `Leben ${spec.hp} · Tempo ${spec.speed}`, tx + 260, infoTop + 22, 13, T.muted),
    );
    const weapon = spec.weapon;
    const weaponText =
      weapon.kind === "melee"
        ? `${weapon.name}: Nahkampf, ${weapon.damage} Schaden auf alle vor ihm`
        : `${weapon.name}: ${weapon.damage} Schaden, ${Math.round(1 / weapon.cooldown)} Schuss je Sekunde` +
          (weapon.splash ? ", Splitter" : "") +
          (weapon.pierce ? ", durchschlägt" : "");
    const lines: [string, string][] = [
      ["WAFFE", weaponText],
      ["FÄHIGKEIT", `${spec.ability.name} (alle ${spec.ability.cooldown} s): ${spec.ability.text}`],
      ["EIGENHEIT", spec.passive],
    ];
    lines.forEach(([title, text], i) => {
      const y = infoTop + 54 + i * 34;
      this.keep(label(this, title, tx, y, 12, T.cyan));
      this.keep(label(this, text, tx + 100, y - 1, 14, T.body, { width: room - 150 }));
    });

    // Hitze (erst nach dem ersten Sieg)
    const bottom = h - SAFE.bottom - 40;
    if (profile.heatUnlocked > 0) {
      const effects = heatEffects(profile.heat);
      this.keep(
        label(this, `HITZE ${profile.heat}`, left, bottom - 12, 24, T.bad, { font: FONT_TITLE }),
      );
      const minus = this.keep(
        new Button(this, left + 136, bottom, "−", () => this.setHeat(profile.heat - 1), {
          width: 44,
          height: 40,
          fontSize: 22,
          variant: "secondary",
        }),
      );
      const plus = this.keep(
        new Button(this, left + 186, bottom, "+", () => this.setHeat(profile.heat + 1), {
          width: 44,
          height: 40,
          fontSize: 22,
          variant: "secondary",
        }),
      );
      minus.setEnabled(profile.heat > 0);
      plus.setEnabled(profile.heat < profile.heatUnlocked);
      const text =
        profile.heat === 0
          ? `Bis Hitze ${profile.heatUnlocked} freigeschaltet: zähere Gegner, mehr Altgold.`
          : `Gegner +${Math.round((effects.hp - 1) * 100)} % Leben, +${Math.round((effects.rate - 1) * 100)} % mehr` +
            (effects.lead < 0 ? ", weniger Vorsprung" : "") +
            (effects.chests < 0 ? ", weniger Truhen" : "") +
            (effects.startScrap < 0 ? ", weniger Startschrott" : "") +
            ` · Altgold +${profile.heat * 15} %`;
      this.keep(label(this, text, left + 220, bottom - 9, 13, T.body, { width: w - left - 480 }));
    }
    const start = this.keep(
      new Button(this, w - SAFE.right - 120, bottom, "LOSZIEHEN ▶", () => this.start(), {
        width: 210,
        height: 54,
        fontSize: 22,
      }),
    );
    start.setEnabled(profile.crew.includes(profile.selected));
  }

  private select(id: CrewId): void {
    const profile = loadProfile();
    if (!profile.crew.includes(id)) {
      audio.play("playerHit");
      return;
    }
    audio.play("pickup");
    profile.selected = id;
    saveProfile(profile);
    this.render();
  }

  private setHeat(heat: number): void {
    const profile = loadProfile();
    profile.heat = Math.max(0, Math.min(profile.heatUnlocked, heat));
    saveProfile(profile);
    audio.play("pickup");
    this.render();
  }

  private start(): void {
    audio.unlock();
    this.scene.start("Game");
  }
}
