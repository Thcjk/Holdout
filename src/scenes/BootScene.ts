/**
 * Erste Szene. "Scene" ist in Phaser ein abgeschlossener Abschnitt des Spiels -
 * Menue, Spiel, Game Over sind je eine eigene Szene mit eigenem `create()` und `update()`.
 *
 * Hier werden das Kenney-Sheet und das UI-Paket geladen und anschliessend
 * ins Menue gewechselt.
 */

import Phaser from "phaser";
import { SHEET_KEY, SHEET_PATH, SPACING, TILE } from "../config/assets";
import { COLORS } from "../config/constants";
import { UI_ATLAS, UI_ATLAS_IMAGE, UI_ATLAS_XML } from "../config/ui";
import { padAtlas } from "../ui/padAtlas";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    /*
     * Das Pixel-Art-Sheet von Kenney.
     *
     * `spritesheet` und nicht `atlas`/`atlasXML`: Das Paket bringt keine Datei
     * mit Koordinaten mit, dafuer ein gleichmaessiges Raster. Die Masse stehen
     * in `config/assets.ts` und sind dort nachgerechnet.
     */
    this.load.spritesheet(SHEET_KEY, SHEET_PATH, {
      frameWidth: TILE,
      frameHeight: TILE,
      spacing: SPACING,
    });

    /*
     * Das UI-Paket (Knoepfe, Panels, Balken). Hier gibt es eine
     * Koordinatendatei, also `atlasXML` - Einzelheiten in `config/ui.ts`.
     */
    this.load.atlasXML(UI_ATLAS, UI_ATLAS_IMAGE, UI_ATLAS_XML);
  }

  create(): void {
    // Teile des UI-Pakets mit Abstand neu auslegen - sonst blutet beim
    // Strecken der Nachbar hinein (Begruendung in `ui/padAtlas.ts`).
    padAtlas(this.textures, UI_ATLAS);

    // Bis Etappe 5 wurde hier ein zweiter, selbst GEZEICHNETER Atlas gebaut
    // (Projektile, Funken, Punkte). Seitdem kommt alles aus dem Sheet - auch
    // Geschosse und Partikel (`BULLET_TILE`, `PARTICLE_TILES`).
    this.scene.start("Menu");
  }
}
