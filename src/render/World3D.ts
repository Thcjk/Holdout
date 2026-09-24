/**
 * Die 3D-Welt eines Runs: Boden, Figuren, Kamera, Zielvorschau (3D-Umbau).
 *
 * Die Spielszene haelt genau EIN solches Objekt und ruft jedes Bild
 * `update()`. Sie muss dafuer nichts ueber Three.js wissen - nur, dass es
 * eine Welt gibt, die sich zeichnet.
 *
 * Reihenfolge je Bild:
 *   1. Canvas an Phaser angleichen (Groesse kann sich jederzeit aendern)
 *   2. Meshes aus dem Zustand setzen (`EntityView`)
 *   3. Kamera der eigenen Figur nachziehen
 *   4. zeichnen
 *
 * Gezeichnet wird im selben Bild wie Phaser (aus `GameScene.update`), nicht
 * in einer eigenen Schleife. Zwei Schleifen liefen um ein Bild versetzt, und
 * das HUD saesse dann sichtbar neben der Welt.
 */

import type { WorldView } from "../net/GameSession";
import type { ViewOrientation } from "../input/viewMapping";
import type { Vec2, WorldState } from "../systems/types";
import { AimView3D } from "./AimView3D";
import { DecorView } from "./DecorView";
import { EntityView } from "./EntityView";
import { FollowCamera } from "./FollowCamera";
import { GroundView } from "./GroundView";
import { LootView } from "./LootView";
import { preloadGameModels } from "./ModelLoader";
import { PropView } from "./PropView";
import { ZoneView } from "./ZoneView";
import { sceneSetup } from "./SceneSetup";

export class World3D {
  private readonly setup = sceneSetup();
  private readonly followCamera = new FollowCamera();
  private readonly ground: GroundView;
  private readonly entities: EntityView;
  private readonly props: PropView;
  private readonly decor: DecorView;
  private readonly loot: LootView;
  private readonly zones: ZoneView;
  readonly aim: AimView3D;

  constructor(state: WorldState) {
    // Falls ein vorheriger Run nicht sauber abgeraeumt hat: lieber leer
    // anfangen als zwei Welten uebereinander.
    this.setup.clearWorld();
    // Meist laengst fertig (angestossen beim App-Start). Falls nicht: Die
    // Welt zeigt Platzhalter, bis die Modelle da sind.
    void preloadGameModels();
    this.ground = new GroundView(this.setup.scene, this.setup.renderer, state);
    this.decor = new DecorView(this.setup.scene, state.props ?? []);
    this.props = new PropView(this.setup.scene, state.props ?? [], state.buildings);
    this.zones = new ZoneView(this.setup.scene, state);
    this.loot = new LootView(this.setup.scene);
    this.entities = new EntityView(this.setup.scene);
    this.aim = new AimView3D(this.setup.scene);
    this.setup.setVisible(true);
  }

  /** Wie die Kamera gerade blickt - fuer die Joystick-Umrechnung. */
  get orientation(): ViewOrientation {
    return this.followCamera.orientation;
  }

  /**
   * Ein Bild zeichnen.
   *
   * @param overlay Das Phaser-Canvas, mit dem die Welt deckungsgleich liegt.
   */
  update(view: WorldView, selfId: string, deltaMs: number, overlay: HTMLCanvasElement): void {
    const aspect = this.setup.matchOverlay(overlay);
    const seconds = Math.min(deltaMs, 100) / 1000;
    this.decor.update(seconds);
    this.props.update(view.state, seconds);
    this.zones.update(view.state, seconds);
    this.loot.sync(view.state, seconds);
    this.entities.sync(view, seconds);
    this.followCamera.follow(view.renderPlayerPosition(selfId), deltaMs, aspect);
    this.setup.render(this.followCamera.camera);
  }

  /** Liegt ein Bodenpunkt (Simulationspixel) sichtbar im Bild? */
  isOnScreen(position: Vec2): boolean {
    return this.followCamera.isOnScreen(position, 0.1);
  }

  /**
   * Was das letzte Bild gekostet hat - fuer `?debug=werte`. Dreiecke und
   * Zeichenaufrufe haengen nicht am Geraet: Was hier im Emulator steht, steht
   * auch auf dem Handy. Die Bildrate dagegen nicht.
   */
  get stats(): { triangles: number; calls: number; figures: number; loot: number } {
    const info = this.setup.renderer.info.render;
    return {
      triangles: info.triangles,
      calls: info.calls,
      figures: this.entities.figureCount,
      loot: this.loot.count,
    };
  }

  destroy(): void {
    this.decor.dispose();
    this.props.dispose();
    this.zones.dispose();
    this.loot.dispose();
    this.entities.dispose();
    this.ground.dispose();
    this.aim.dispose();
    this.setup.clearWorld();
    this.setup.setVisible(false);
  }
}
