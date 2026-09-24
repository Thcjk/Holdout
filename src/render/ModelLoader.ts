/**
 * Laedt GLB-Modelle und Texturen - genau einmal je Datei.
 *
 * ================================================================
 * LADEN IST TEUER, KOPIEREN IST BILLIG
 * ================================================================
 *
 * Eine GLB-Datei zu laden heisst: herunterladen, entpacken, Geometrie auf die
 * Grafikkarte schieben. Bei jedem Gegner-Spawn waere das ein Ruckler. Deshalb:
 *
 *   1. Beim Start eines Runs wird ALLES einmal geladen (`preloadGameModels`).
 *   2. Jede Datei landet im Zwischenspeicher, als Vorlage.
 *   3. Eine neue Figur ist eine KOPIE der Vorlage (`SkeletonUtils.clone`).
 *      Die Kopie teilt sich Geometrie und Textur mit der Vorlage - neu ist
 *      nur das Skelett, damit jede Figur ihre eigene Pose haben kann.
 *
 * Wer eine Datei zweimal anfragt, bekommt dasselbe Versprechen (Promise)
 * zurueck - auch wenn die erste Anfrage noch laeuft.
 *
 * ================================================================
 * WAS PASSIERT, WENN EINE DATEI FEHLT
 * ================================================================
 *
 * Nichts Schlimmes: Das Laden meldet den Fehler in der Konsole, und die
 * Darstellung bleibt beim Platzhalter (Kapsel, Quader). Ein Spiel mit
 * Kapseln ist spielbar; ein Spiel, das an einer fehlenden Datei haengt,
 * nicht. Genau so ein stiller Ausfall (falscher Pfad auf Pages) hat das
 * Projekt schon einmal lahmgelegt.
 */

import { SRGBColorSpace, TextureLoader } from "three";
import type { AnimationClip, Texture } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BODY_URLS,
  CHARACTER_LOOKS,
  CLIP_URLS,
  ENEMY_LOOKS,
  ITEM_MODEL_URLS,
  PROP_URLS,
  skinUrl,
} from "../config/models";
import type { ClipId } from "../config/models";

class ModelLoader {
  private readonly gltfLoader = new GLTFLoader();
  private readonly textureLoader = new TextureLoader();

  private readonly pendingModels = new Map<string, Promise<GLTF | null>>();
  private readonly models = new Map<string, GLTF>();
  private readonly pendingTextures = new Map<string, Promise<Texture | null>>();
  private readonly textures = new Map<string, Texture>();

  /** Laedt ein Modell (oder gibt das laufende/fertige Laden zurueck). */
  load(url: string): Promise<GLTF | null> {
    let pending = this.pendingModels.get(url);
    if (!pending) {
      pending = this.gltfLoader
        .loadAsync(url)
        .then((gltf) => {
          this.models.set(url, gltf);
          return gltf;
        })
        .catch((error: unknown) => {
          console.error(`Modell nicht geladen: ${url}`, error);
          return null;
        });
      this.pendingModels.set(url, pending);
    }
    return pending;
  }

  /**
   * Laedt eine Textur fuer ein glTF-Modell.
   *
   * `flipY = false` ist kein Detail: glTF legt Texturen mit dem Ursprung oben
   * links an, WebGL-Texturen standardmaessig unten links. Ohne diese Zeile
   * sitzt das Gesicht einer Figur auf ihren Schuhen.
   */
  loadTexture(url: string): Promise<Texture | null> {
    let pending = this.pendingTextures.get(url);
    if (!pending) {
      pending = this.textureLoader
        .loadAsync(url)
        .then((texture) => {
          texture.flipY = false;
          texture.colorSpace = SRGBColorSpace;
          this.textures.set(url, texture);
          return texture;
        })
        .catch((error: unknown) => {
          console.error(`Textur nicht geladen: ${url}`, error);
          return null;
        });
      this.pendingTextures.set(url, pending);
    }
    return pending;
  }

  /** Das fertig geladene Modell, oder `undefined`, solange es noch laedt. */
  model(url: string): GLTF | undefined {
    return this.models.get(url);
  }

  texture(url: string): Texture | undefined {
    return this.textures.get(url);
  }

  /** Der Animationsclip einer Animationsdatei, wenn geladen. */
  clip(id: ClipId): AnimationClip | undefined {
    return this.models.get(CLIP_URLS[id])?.animations[0];
  }
}

/** Der eine Lader der App. */
export const modelLoader = new ModelLoader();

let preload: Promise<void> | null = null;

/**
 * Alles laden, was ein Run braucht. Mehrfach aufrufbar - geladen wird nur
 * beim ersten Mal. Wird vom Menue angestossen, damit es bei Rundenbeginn
 * meist schon fertig ist; bis dahin zeigt die Welt Platzhalter.
 */
export function preloadGameModels(): Promise<void> {
  preload ??= (async () => {
    const looks = [...Object.values(CHARACTER_LOOKS), ...Object.values(ENEMY_LOOKS)];
    const models = [
      ...Object.values(BODY_URLS),
      ...Object.values(CLIP_URLS),
      ...Object.values(PROP_URLS),
      ...Object.values(ITEM_MODEL_URLS).filter((url): url is string => url !== undefined),
    ];
    const skins = [...new Set(looks.map((look) => skinUrl(look.skin)))];
    await Promise.all([
      ...models.map((url) => modelLoader.load(url)),
      ...skins.map((url) => modelLoader.loadTexture(url)),
    ]);
  })();
  return preload;
}
