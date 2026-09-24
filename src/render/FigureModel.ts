/**
 * Eine animierte Figur: Koerper + Haut + Animationen (fuer Spieler UND Gegner).
 *
 * ================================================================
 * WAS EINE FIGUR BRAUCHT
 * ================================================================
 *
 *   Koerper     geteilte Geometrie aus der GLB-Vorlage, EIGENES Skelett
 *   Haut        geteilte Textur + geteiltes Toon-Material je Haut
 *   Animation   eigener AnimationMixer, die Clips selbst sind geteilt
 *
 * Der Mixer ist das, was eine Animation abspielt: Er nimmt einen Clip
 * ("rennen") und setzt Bild fuer Bild die Knochen dieser einen Figur. Zwei
 * Figuren mit demselben Clip teilen sich die Daten, aber jede hat ihre eigene
 * Abspielposition - sonst liefen alle Zombies im Gleichschritt.
 *
 * ================================================================
 * TOON-LOOK
 * ================================================================
 *
 * `MeshToonMaterial` teilt das Licht in wenige harte Stufen statt in einen
 * weichen Verlauf. Das ergibt den flachen Comic-Look der Referenz und ist
 * nebenbei billig zu rechnen. Die Stufen legt eine winzige Verlaufstextur
 * fest (`TOON_STEPS`): drei Helligkeiten, hart gegeneinander gesetzt.
 */

import {
  AnimationMixer,
  DataTexture,
  Group,
  LoopOnce,
  LoopRepeat,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  Box3,
} from "three";
import type { AnimationAction, Material, Object3D, SkinnedMesh } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BODY_URLS, skinUrl } from "../config/models";
import type { ClipId, FigureLook } from "../config/models";
import { modelLoader } from "./ModelLoader";

/** Drei Lichtstufen fuer den Toon-Look: Schatten, Halbschatten, Licht. */
export const TOON_STEPS = (() => {
  const data = new Uint8Array([110, 190, 255]);
  const texture = new DataTexture(data, data.length, 1, RedFormat);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
})();

/** Ein Toon-Material je Haut, geteilt von allen Figuren mit dieser Haut. */
const skinMaterials = new Map<string, MeshToonMaterial>();
/** Hoehe jedes Koerpers in Modelleinheiten (aus der Vorlage gemessen). */
const bodyHeights = new Map<string, number>();

/**
 * Ein Toon-Material mit denselben Stufen, aus dem Material einer GLB-Datei
 * (GLTFLoader liefert `MeshStandardMaterial`) - fuer Requisiten und Beute.
 * Farbe und Textur bleiben, nur die Beleuchtung wird stufig.
 */
export function toonFrom(source: Material): MeshToonMaterial {
  const material = new MeshToonMaterial({ gradientMap: TOON_STEPS });
  if (source instanceof MeshStandardMaterial) {
    material.map = source.map;
    material.color.copy(source.color);
    material.name = source.name;
  }
  return material;
}

function materialForSkin(skin: string): MeshToonMaterial | null {
  let material = skinMaterials.get(skin);
  if (!material) {
    const texture = modelLoader.texture(skinUrl(skin));
    if (!texture) {
      return null;
    }
    material = new MeshToonMaterial({ map: texture, gradientMap: TOON_STEPS });
    skinMaterials.set(skin, material);
  }
  return material;
}

export class FigureModel {
  /** Wird von aussen positioniert und gedreht. */
  readonly root = new Group();
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<ClipId, AnimationAction>();
  private current: ClipId | null = null;

  /**
   * Eine neue Figur - oder `null`, solange Koerper, Haut oder Clips noch
   * laden. Der Aufrufer zeigt dann den Platzhalter und fragt spaeter noch
   * einmal.
   *
   * @param height Hoehe in Metern (aus dem Trefferkreis, siehe
   *               `FIGURE_HEIGHT_PER_DIAMETER`).
   */
  static create(look: FigureLook, height: number): FigureModel | null {
    const bodyUrl = BODY_URLS[look.body];
    const template = modelLoader.model(bodyUrl);
    const material = materialForSkin(look.skin);
    if (!template || !material) {
      return null;
    }
    return new FigureModel(template.scene, bodyUrl, material, height);
  }

  private constructor(template: Object3D, bodyUrl: string, material: MeshToonMaterial, height: number) {
    const model = cloneSkinned(template);
    model.traverse((node) => {
      const mesh = node as SkinnedMesh;
      if (mesh.isMesh) {
        mesh.material = material;
      }
    });

    // Auf die gewuenschte Hoehe bringen. Gemessen wird einmal je Koerper an
    // der Vorlage (Ruhepose), nicht je Figur.
    let bodyHeight = bodyHeights.get(bodyUrl);
    if (bodyHeight === undefined) {
      bodyHeight = new Box3().setFromObject(template).max.y || 1;
      bodyHeights.set(bodyUrl, bodyHeight);
    }
    model.scale.setScalar(height / bodyHeight);

    this.root.add(model);
    this.mixer = new AnimationMixer(model);
  }

  /**
   * Einen Clip abspielen, mit kurzer Ueberblendung vom vorigen.
   *
   * @param timeScale Abspieltempo - beim Laufen an die echte Geschwindigkeit
   *                  angepasst, sonst "rutschen" die Fuesse ueber den Boden.
   * @param once      Nur einmal abspielen und in der letzten Pose stehen
   *                  bleiben (Tod).
   */
  play(id: ClipId, timeScale = 1, once = false): void {
    const action = this.action(id, once);
    if (!action) {
      return;
    }
    action.timeScale = timeScale;
    if (this.current === id) {
      return;
    }
    const previous = this.current ? this.actions.get(this.current) : undefined;
    action.reset().play();
    if (previous) {
      action.crossFadeFrom(previous, 0.15, false);
    }
    this.current = id;
  }

  /** Zeit weiterlaufen lassen (Sekunden). */
  update(seconds: number): void {
    this.mixer.update(seconds);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.root.removeFromParent();
    // Geometrie, Haut und Material gehoeren der Vorlage und bleiben.
  }

  private action(id: ClipId, once: boolean): AnimationAction | null {
    let action = this.actions.get(id);
    if (!action) {
      const clip = modelLoader.clip(id);
      if (!clip) {
        return null;
      }
      action = this.mixer.clipAction(clip);
      if (once) {
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(LoopRepeat, Infinity);
      }
      this.actions.set(id, action);
    }
    return action;
  }
}
