/**
 * Legt einen geladenen Atlas mit Abstand zwischen den Teilen neu an.
 *
 * ================================================================
 * WARUM: DER GRUENE PIXEL AM KNOPFRAND
 * ================================================================
 *
 * Im Bild des UI-Pakets liegen die Teile Kante an Kante, ohne einen einzigen
 * Pixel Abstand: Rechts neben dem hellen Knopf beginnt sofort der gruene
 * Balken. Wird ein Teil gestreckt oder auf eine halbe Pixelposition gesetzt,
 * greift der Browser beim Zeichnen gelegentlich einen Pixel UEBER den Rand
 * hinaus - im Emulator sass dadurch unten rechts an jedem hellen Knopf ein
 * gruener Punkt.
 *
 * Abhilfe ohne das Paket anzufassen: Beim Start wird jedes Teil einmal in
 * eine neue Leinwand kopiert, mit 2 Pixeln durchsichtigem Rand drumherum.
 * Namen und Masse bleiben gleich, nur die Lage im Bild aendert sich - der
 * uebrige Code merkt davon nichts. Kostet einmalig ein paar Millisekunden.
 */

import type Phaser from "phaser";

const PADDING = 2;
/** Breite der neuen Leinwand; das Original ist 512 breit. */
const WIDTH = 1024;

export function padAtlas(textures: Phaser.Textures.TextureManager, key: string): void {
  const original = textures.get(key);
  const image = original.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const names = original.getFrameNames();
  const frames = names.map((name) => original.get(name));

  // Reihenweise auslegen, hoechstes Teil zuerst - einfach und reicht fuer 87.
  const order = frames
    .map((frame, index) => ({ frame, name: names[index] as string }))
    .sort((a, b) => b.frame.cutHeight - a.frame.cutHeight);
  const places: Array<{ name: string; frame: Phaser.Textures.Frame; x: number; y: number }> = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const { frame, name } of order) {
    const w = frame.cutWidth + 2 * PADDING;
    const h = frame.cutHeight + 2 * PADDING;
    if (x + w > WIDTH) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    places.push({ name, frame, x: x + PADDING, y: y + PADDING });
    x += w;
    rowHeight = Math.max(rowHeight, h);
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = y + rowHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return; // Ohne Leinwand bleibt der Atlas, wie er ist - lieber ein Pixel als gar nichts.
  }
  for (const place of places) {
    const f = place.frame;
    context.drawImage(image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, place.x, place.y, f.cutWidth, f.cutHeight);
  }

  textures.remove(key);
  const padded = textures.addCanvas(key, canvas);
  if (!padded) {
    return;
  }
  for (const place of places) {
    padded.add(place.name, 0, place.x, place.y, place.frame.cutWidth, place.frame.cutHeight);
  }
}
