/**
 * Beute am Boden als 3D-Objekte (Anschluss an das bestehende Loot-System).
 *
 * Die Simulation kennt Beute als Punkt mit Gegenstandsnummer
 * (`state.groundItems`) und hebt sie auf, sobald ein Spieler nah genug ist
 * (`systems/loot.ts`, Radius flach auf dem Boden). Daran aendert sich nichts.
 * Hier wird nur gezeigt:
 *
 *   - ein kleines Modell, wo das Paket eines hat (Waffen, Munition, Schrott),
 *     sonst das Pixel-Symbol aus dem Rucksack als Aufsteller - Uebergang,
 *     bis es Modelle fuer Zelle, Platine usw. gibt
 *   - ein Ring in der Farbe der Seltenheit, wie im Rucksack
 *   - leichtes Schweben und Drehen: Beute soll auffallen, nicht wie Muell
 *     herumliegen
 *   - beim Aufheben ein kurzes "Hochspringen und Verschwinden" statt eines
 *     harten Verschwindens - die sichtbare Rueckmeldung, dass es geklappt hat
 *
 * ================================================================
 * OBJECT POOLING
 * ================================================================
 *
 * Gegner lassen laufend etwas fallen, Spieler heben laufend auf. Jedes Mal
 * ein Modell zu klonen und wegzuwerfen, erzeugt Muell, den der Browser
 * irgendwann wegraeumt - mitten im Gefecht, als Ruckler. Deshalb: Was
 * verschwindet, kommt in einen Vorrat je Modell und wird fuer den naechsten
 * Gegenstand derselben Art wiederverwendet.
 */

import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  Box3,
  Vector3,
} from "three";
import type { Material, Object3D, Scene, Texture } from "three";
import { COLUMNS, ITEM_TILES, SHEET_PATH, SPACING, TILE } from "../config/assets";
import { ITEMS, RARITY_COLORS } from "../config/items";
import { ITEM_MODEL_SIZE, ITEM_MODEL_URLS } from "../config/models";
import type { GroundItem, WorldState } from "../systems/types";
import { toonFrom } from "./FigureModel";
import { modelLoader } from "./ModelLoader";
import { toThree } from "./space3d";

/** Schwebehoehe ueber dem Boden (Meter). */
const HOVER = 0.45;
/** Dauer der Aufheben-Rueckmeldung (Sekunden). */
const POP_TIME = 0.28;
/** Groesse des Pixel-Aufstellers (Meter). */
const SPRITE_SIZE = 0.8;

/** Masse des Pixel-Sheets: 34 x 20 Kacheln a 16 px mit 1 px Abstand. */
const SHEET_WIDTH = COLUMNS * (TILE + SPACING) - SPACING;
const SHEET_HEIGHT = 20 * (TILE + SPACING) - SPACING;

interface Pickup {
  key: string;
  root: Group;
  ring: Mesh;
  /** > 0 waehrend der Aufheben-Rueckmeldung. */
  popping: number;
  phase: number;
}

export class LootView {
  private readonly items = new Map<number, Pickup>();
  private readonly pool = new Map<string, Pickup[]>();
  private readonly popping: Pickup[] = [];
  private readonly ringGeometry: RingGeometry;
  private readonly ringMaterials = new Map<number, MeshBasicMaterial>();
  private readonly modelTemplates = new Map<string, Object3D>();
  private readonly spriteMaterials = new Map<number, SpriteMaterial>();
  private sheet: Texture | null = null;
  private time = 0;
  private readonly seen = new Set<number>();

  constructor(private readonly scene: Scene) {
    this.ringGeometry = new RingGeometry(0.38, 0.48, 32);
    this.ringGeometry.rotateX(-Math.PI / 2);
    // Eigene Ladung des Pixel-Sheets: Aufsteller brauchen es mit normaler
    // Bildausrichtung (flipY), anders als glTF-Texturen.
    new TextureLoader().load(SHEET_PATH, (texture) => {
      texture.magFilter = NearestFilter;
      texture.minFilter = NearestFilter;
      texture.colorSpace = SRGBColorSpace;
      this.sheet = texture;
    });
  }

  sync(state: WorldState, seconds: number): void {
    this.time += seconds;
    this.seen.clear();

    for (const item of state.groundItems) {
      this.seen.add(item.id);
      let pickup = this.items.get(item.id) ?? null;
      if (!pickup) {
        pickup = this.take(item);
        if (!pickup) {
          continue;
        }
        this.items.set(item.id, pickup);
      }
      const bob = Math.sin(this.time * 2.4 + pickup.phase) * 0.08;
      toThree(item.position, 0, pickup.root.position);
      const content = pickup.root.children[0] as Object3D;
      content.position.y = HOVER + bob;
      if (!(content instanceof Sprite)) {
        content.rotation.y = this.time * 1.3 + pickup.phase;
      }
    }

    // Verschwunden = aufgehoben (oder verfallen): kurze Rueckmeldung, dann
    // zurueck in den Vorrat.
    for (const [id, pickup] of this.items) {
      if (!this.seen.has(id)) {
        this.items.delete(id);
        pickup.popping = POP_TIME;
        this.popping.push(pickup);
      }
    }

    for (let i = this.popping.length - 1; i >= 0; i -= 1) {
      const pickup = this.popping[i] as Pickup;
      pickup.popping -= seconds;
      const progress = 1 - Math.max(0, pickup.popping) / POP_TIME;
      const content = pickup.root.children[0] as Object3D;
      content.position.y = HOVER + progress * 1.2;
      pickup.root.scale.setScalar(Math.max(0.001, 1 - progress));
      if (pickup.popping <= 0) {
        this.popping.splice(i, 1);
        this.release(pickup);
      }
    }
  }

  /** Wie viele Beute-Objekte gerade stehen (fuer die Leistungsanzeige). */
  get count(): number {
    return this.items.size;
  }

  dispose(): void {
    const all = [...this.items.values(), ...this.popping, ...[...this.pool.values()].flat()];
    for (const pickup of all) {
      pickup.root.removeFromParent();
    }
    this.items.clear();
    this.pool.clear();
    this.ringGeometry.dispose();
    for (const material of this.ringMaterials.values()) material.dispose();
    for (const material of this.spriteMaterials.values()) {
      material.map?.dispose();
      material.dispose();
    }
    for (const template of this.modelTemplates.values()) {
      template.traverse((node) => {
        const mesh = node as Mesh;
        if (mesh.isMesh) (mesh.material as Material).dispose();
      });
    }
    this.sheet?.dispose();
  }

  /** Ein Objekt fuer diesen Gegenstand - aus dem Vorrat oder neu. */
  private take(item: GroundItem): Pickup | null {
    const def = ITEMS[item.def];
    if (!def) {
      return null;
    }
    const url = ITEM_MODEL_URLS[def.id];
    const key = url && modelLoader.model(url) ? `model:${url}` : `sprite:${item.def}`;

    const reused = this.pool.get(key)?.pop();
    const pickup = reused ?? this.create(key, item.def, url);
    if (!pickup) {
      return null;
    }
    pickup.ring.material = this.ringMaterial(def.rarity);
    pickup.root.scale.setScalar(1);
    pickup.popping = 0;
    pickup.root.visible = true;
    return pickup;
  }

  private create(key: string, defIndex: number, url: string | undefined): Pickup | null {
    let content: Object3D | null = null;
    if (key.startsWith("model:") && url) {
      content = this.modelTemplate(url).clone();
    } else {
      const material = this.spriteMaterial(defIndex);
      if (!material) {
        // Das Sheet laedt noch - im naechsten Bild noch einmal versuchen.
        return null;
      }
      const sprite = new Sprite(material);
      sprite.scale.set(SPRITE_SIZE, SPRITE_SIZE, 1);
      content = sprite;
    }

    const ring = new Mesh(this.ringGeometry, this.ringMaterial(1));
    ring.position.y = 0.04;
    const root = new Group();
    root.add(content, ring);
    this.scene.add(root);
    return { key, root, ring, popping: 0, phase: Math.random() * Math.PI * 2 };
  }

  private release(pickup: Pickup): void {
    pickup.root.visible = false;
    let list = this.pool.get(pickup.key);
    if (!list) {
      list = [];
      this.pool.set(pickup.key, list);
    }
    list.push(pickup);
  }

  /** Das Beute-Modell, eingepasst auf `ITEM_MODEL_SIZE`, mit Toon-Material. */
  private modelTemplate(url: string): Object3D {
    let template = this.modelTemplates.get(url);
    if (!template) {
      const source = (modelLoader.model(url) as { scene: Object3D }).scene.clone();
      source.traverse((node) => {
        const mesh = node as Mesh;
        if (mesh.isMesh) mesh.material = toonFrom(mesh.material as Material);
      });
      const box = new Box3().setFromObject(source);
      const size = box.getSize(new Vector3());
      const center = box.getCenter(new Vector3());
      const scale = ITEM_MODEL_SIZE / Math.max(size.x, size.y, size.z, 1e-6);
      const wrapper = new Group();
      source.position.sub(center);
      wrapper.add(source);
      wrapper.scale.setScalar(scale);
      template = wrapper;
      this.modelTemplates.set(url, template);
    }
    return template;
  }

  /** Ein Aufsteller mit dem Pixel-Symbol aus dem Rucksack. */
  private spriteMaterial(defIndex: number): SpriteMaterial | null {
    let material = this.spriteMaterials.get(defIndex);
    if (!material) {
      if (!this.sheet) {
        return null;
      }
      const id = ITEMS[defIndex]?.id ?? "";
      const frame = ITEM_TILES[id] ?? 0;
      const column = frame % COLUMNS;
      const row = Math.floor(frame / COLUMNS);
      const texture = this.sheet.clone();
      texture.repeat.set(TILE / SHEET_WIDTH, TILE / SHEET_HEIGHT);
      texture.offset.set(
        (column * (TILE + SPACING)) / SHEET_WIDTH,
        1 - (row * (TILE + SPACING) + TILE) / SHEET_HEIGHT,
      );
      texture.needsUpdate = true;
      material = new SpriteMaterial({ map: texture, transparent: true });
      this.spriteMaterials.set(defIndex, material);
    }
    return material;
  }

  private ringMaterial(rarity: number): MeshBasicMaterial {
    let material = this.ringMaterials.get(rarity);
    if (!material) {
      material = new MeshBasicMaterial({
        color: RARITY_COLORS[rarity] ?? 0xffffff,
        transparent: true,
        opacity: 0.85,
        side: DoubleSide,
        depthWrite: false,
      });
      this.ringMaterials.set(rarity, material);
    }
    return material;
  }
}
