/**
 * Das Three.js-Grundgeruest: Renderer, Szene, Licht, Canvas (3D-Umbau).
 *
 * ================================================================
 * ZWEI CANVAS UEBEREINANDER
 * ================================================================
 *
 *   oben   Phaser (durchsichtig)  Menues, HUD, Joystick, Knoepfe, Inventar
 *   unten  Three.js               die Welt: Boden, Waende, Figuren
 *
 * Phaser behaelt alles, was es gut kann und was erprobt ist: Szenenwechsel,
 * Touch mit mehreren Fingern, Anpassung an die Bildschirmgroesse, Text. Die
 * Welt zeichnet Three.js. Warum das so aufgeteilt ist statt Phaser ganz zu
 * ersetzen, steht in CLAUDE.md ("3D-Umbau").
 *
 * Die Beruehrungen gehen an Phaser: Das Three-Canvas liegt darunter und hat
 * `pointer-events: none`. Die Welt muss nichts anfassen koennen - sie wird
 * nur angezeigt.
 *
 * ================================================================
 * DECKUNGSGLEICH MIT DEM PHASER-CANVAS
 * ================================================================
 *
 * Phaser rechnet mit einer Entwurfsflaeche (Hoehe 540) und skaliert sie per
 * CSS auf den Bildschirm. Das Three-Canvas uebernimmt genau das Rechteck,
 * das Phaser am Ende auf dem Bildschirm belegt (`getBoundingClientRect`),
 * zeichnet darin aber in voller Geraeteaufloesung. So liegen HUD und Welt
 * immer deckungsgleich - auch nach einer Drehung oder wenn Safari die
 * Adressleiste einklappt.
 *
 * ================================================================
 * EIN RENDERER FUER DAS GANZE APP-LEBEN
 * ================================================================
 *
 * Nicht einer je Run. Ein WebGL-Kontext ist auf dem Handy ein knappes Gut;
 * iOS gibt alte Kontexte nicht zuverlaessig frei, und nach einer Handvoll
 * Runs waere das Bild schwarz. Jeder Run leert nur die Szene.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Scene,
  WebGLRenderer,
} from "three";
import type { Camera } from "three";
import { COLORS, VIEW3D } from "../config/constants";

export class SceneSetup {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly canvas: HTMLCanvasElement;

  /** Zuletzt gesetzte Groesse in CSS-Pixeln - nur bei Aenderung neu setzen. */
  private cssWidth = 0;
  private cssHeight = 0;
  private pixelRatio = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "world-3d";
    // Unter dem Phaser-Canvas, ohne Beruehrung (siehe oben).
    Object.assign(this.canvas.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      zIndex: "0",
      pointerEvents: "none",
      display: "none",
    });
    document.body.prepend(this.canvas);

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      // Auf dem Handy lieber die schnelle GPU, auch wenn es Akku kostet.
      powerPreference: "high-performance",
    });

    this.scene = new Scene();
    this.scene.background = new Color(COLORS.background);

    /*
     * Licht: Umgebungslicht plus ein Richtungslicht.
     *
     * Das Umgebungslicht hellt alles gleichmaessig auf, damit keine Seite
     * ganz schwarz wird. Das Richtungslicht ist die "Sonne": Es gibt jeder
     * Form eine helle und eine dunkle Seite, und genau daran liest man sie
     * als Koerper statt als Flaeche. Fuer den Toon-Look der spaeteren Modelle
     * reicht das - Toon-Materialien teilen das Licht ohnehin in wenige Stufen.
     *
     * Die Sonne steht links oben hinter der Kamera: Die Seiten, die man sieht,
     * sind beleuchtet, und die Schatten fallen nach rechts unten weg.
     */
    this.scene.add(new AmbientLight(0xffffff, 1.1));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(-6, 14, 8);
    this.scene.add(sun);
  }

  /** Einblenden, wenn eine Runde beginnt; im Menue ist die Welt weg. */
  setVisible(visible: boolean): void {
    this.canvas.style.display = visible ? "block" : "none";
  }

  /**
   * Groesse und Lage an das Phaser-Canvas angleichen. Jedes Bild gerufen,
   * setzt aber nur bei einer Aenderung wirklich etwas um.
   *
   * @returns das Seitenverhaeltnis (Breite / Hoehe) fuer die Kamera.
   */
  matchOverlay(overlay: HTMLCanvasElement): number {
    const rect = overlay.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const ratio = Math.min(window.devicePixelRatio || 1, VIEW3D.maxPixelRatio);

    this.canvas.style.left = `${Math.round(rect.left)}px`;
    this.canvas.style.top = `${Math.round(rect.top)}px`;

    if (width !== this.cssWidth || height !== this.cssHeight || ratio !== this.pixelRatio) {
      this.cssWidth = width;
      this.cssHeight = height;
      this.pixelRatio = ratio;
      this.renderer.setPixelRatio(ratio);
      // Setzt die Zeichenflaeche (CSS-Groesse x Pixelverhaeltnis) UND die
      // CSS-Groesse - beides genau passend zum Phaser-Canvas.
      this.renderer.setSize(width, height, true);
    }
    return width / height;
  }

  render(camera: Camera): void {
    this.renderer.render(this.scene, camera);
  }

  /**
   * Die Szene leeren - am Ende eines Runs. Geometrien und Materialien raeumen
   * die jeweiligen Ansichten selbst ab; hier werden nur die Objekte
   * ausgehaengt, die sie hinzugefuegt haben. Licht bleibt.
   */
  clearWorld(): void {
    for (const child of [...this.scene.children]) {
      if (!(child instanceof AmbientLight) && !(child instanceof DirectionalLight)) {
        this.scene.remove(child);
      }
    }
  }
}

let shared: SceneSetup | null = null;

/** Der eine Renderer der App, beim ersten Gebrauch angelegt. */
export function sceneSetup(): SceneSetup {
  shared ??= new SceneSetup();
  return shared;
}
