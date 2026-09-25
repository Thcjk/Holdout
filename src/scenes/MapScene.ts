/**
 * Die Knoten-Karte: hier waehlt das Team, wohin es als Naechstes zieht.
 *
 * Vorbild ist die Karte aus "Deadly Days: Roadtrip" (Bild vom Nutzer,
 * 2026-09-25): Regionen als Streifen von links nach rechts, Knoten mit
 * gepunkteten Wegen, und vor der Wahl eine Tafel mit den Eckdaten
 * (Kartengroesse, Gefahr, Beute).
 *
 * ================================================================
 * WAS HIER ENTSCHIEDEN WIRD - UND WAS NICHT
 * ================================================================
 *
 * Die Szene zeichnet nur und nimmt die Wahl entgegen. Was eine Wahl bewirkt
 * (Rast heilt, Gebiet wird gespielt, erreichbar ist nur ein Nachfolger),
 * steht phaserfrei in `systems/run.ts`.
 *
 * ================================================================
 * IM KOOP
 * ================================================================
 *
 * Der Host waehlt (Briefing Abschnitt 2: "bei Uneinigkeit entscheidet der
 * Host"). Er schickt ein `move`-Paket mit der Knotennummer und dem Stand
 * aller Spieler. Jeder Client zieht mit, baut dasselbe Gebiet aus dem Seed
 * und startet seine Sitzung.
 *
 * Damit kein Client die Wahl verpasst, meldet sich jeder mit `ready`, sobald
 * er auf der Karte ist. Der Host kann erst losziehen, wenn alle da sind -
 * sonst kaeme ein Nachzuegler nie im naechsten Gebiet an (dieselbe Falle wie
 * beim Neustart eines Runs, siehe CLAUDE.md Etappe 7).
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { CHARACTER_TILES, SHEET_KEY } from "../config/assets";
import { SAFE, VIEWPORT } from "../config/constants";
import { REGIONS, STORY, placeName, regionIndexOfLayer, regionOfLayer } from "../config/story";
import { UI } from "../config/ui";
import { ClientSession } from "../net/ClientSession";
import type { GameSession } from "../net/GameSession";
import { HostSession } from "../net/HostSession";
import { toNetPlayers, toSetups } from "../net/Lobby";
import { SoloSession } from "../net/SoloSession";
import type { Transport } from "../net/Transport";
import { setReloadSafe } from "../platform/update";
import type { MapNode } from "../systems/NodeMapGenerator";
import { canEnter, carriedCount, currentNode, enterNode, nodeTypeLabel } from "../systems/run";
import type { RunState } from "../systems/run";
import type { CharacterId } from "../systems/types";
import type { PlayerSetup } from "../systems/world";
import { Button } from "../ui/Button";
import { UiBar, UiNineSlice } from "../ui/UiNineSlice";

export interface MapSceneData {
  run: RunState;
  character: CharacterId;
  /** Im Koop die offene Verbindung. Solo `undefined`. */
  transport?: Transport;
  /** Kurze Meldung oben, etwa "Gebiet geschafft". */
  message?: string;
}

/** Farben der Knoten nach Typ - eine Farbe je Bedeutung. */
const NODE_COLORS: Record<MapNode["type"], number> = {
  start: 0xf6ead2,
  combat: 0xd9b784,
  elite: 0xd0643c,
  rest: 0x7fb069,
  extraction: 0x6ec8f0,
  boss: 0x8e5bd6,
};

/** Kurzzeichen im Knoten - Buchstaben statt Symbolen, die nicht jede Schrift hat. */
const NODE_SYMBOLS: Record<MapNode["type"], string> = {
  start: "S",
  combat: "",
  elite: "!",
  rest: "+",
  extraction: "X",
  boss: "B",
};

const NODE_RADIUS = 19;
const HEADER = 64;
const FOOTER = 112;

export class MapScene extends Phaser.Scene {
  private run!: RunState;
  private character: CharacterId = "scout";
  private transport?: Transport;
  private message = "";
  private selected: number | null = null;
  /** Clients, die auf der Karte angekommen sind (nur Host). */
  private readyPeers = new Set<string>();

  private info!: Phaser.GameObjects.Container;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private bars: UiBar[] = [];
  private goButton!: Button;
  private statusText!: Phaser.GameObjects.Text;
  private leaving = false;

  constructor() {
    super("Map");
  }

  init(data: MapSceneData): void {
    this.run = data.run;
    this.character = data.character;
    this.transport = data.transport;
    this.message = data.message ?? "";
    this.selected = null;
    this.readyPeers = new Set();
    this.bars = [];
    this.leaving = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x11161f);
    audio.setMusic("menu");
    // Auf der Karte darf eine neue Version noch nicht greifen - der Run laeuft.
    setReloadSafe(false);

    this.drawRegions();
    this.drawEdges();
    this.drawNodes();
    this.drawHeader();
    this.buildInfoPanel();
    this.listen();
    this.updateStatus();
  }

  // ----------------------------------------------------------------
  // Lage
  // ----------------------------------------------------------------

  private get mapLeft(): number {
    return SAFE.left + 40;
  }
  private get mapRight(): number {
    return VIEWPORT.width - SAFE.right - 40;
  }
  private get mapTop(): number {
    return SAFE.top + HEADER + 24;
  }
  private get mapBottom(): number {
    return VIEWPORT.height - SAFE.bottom - FOOTER - 8;
  }

  /** Bildschirmlage eines Knotens: Schicht = x, Spalte = y. */
  private nodePosition(node: MapNode): { x: number; y: number } {
    const { depth, columns } = this.run.map;
    const x = this.mapLeft + ((this.mapRight - this.mapLeft) * node.layer) / (depth - 1);
    // Start und Boss stehen mittig, die anderen auf ihrer Spalte.
    const row =
      node.type === "start" || node.type === "boss" ? (columns - 1) / 2 : node.column;
    const y = this.mapTop + ((this.mapBottom - this.mapTop) * (row + 0.5)) / columns;
    return { x, y };
  }

  // ----------------------------------------------------------------
  // Zeichnen
  // ----------------------------------------------------------------

  /** Vier Streifen, je Region einer, mit Namen oben. */
  private drawRegions(): void {
    const { depth } = this.run.map;
    const g = this.add.graphics();
    const step = (this.mapRight - this.mapLeft) / (depth - 1);
    REGIONS.forEach((region, index) => {
      const layers = Array.from({ length: depth }, (_, layer) => layer).filter(
        (layer) => regionIndexOfLayer(layer, depth) === index,
      );
      if (layers.length === 0) return;
      const left = index === 0 ? 0 : this.mapLeft + step * ((layers[0] as number) - 0.5);
      const right =
        index === REGIONS.length - 1
          ? VIEWPORT.width
          : this.mapLeft + step * ((layers[layers.length - 1] as number) + 0.5);
      g.fillStyle(region.mapColor, 0.55);
      g.fillRect(left, this.mapTop - 22, right - left, this.mapBottom - this.mapTop + 30);
      this.add
        .text((left + right) / 2, this.mapTop - 12, region.name.toUpperCase(), {
          fontFamily: UI.font,
          fontSize: "13px",
          color: "#f6ead2",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setAlpha(0.85);
    });
  }

  /** Gepunktete Wege; schon gegangene hell und durchgezogen. */
  private drawEdges(): void {
    const g = this.add.graphics();
    const walked = new Set<string>();
    for (let i = 1; i < this.run.visited.length; i += 1) {
      walked.add(`${this.run.visited[i - 1]}>${this.run.visited[i]}`);
    }
    for (const node of this.run.map.nodes) {
      const from = this.nodePosition(node);
      for (const nextId of node.next) {
        const next = this.run.map.nodes[nextId] as MapNode;
        const to = this.nodePosition(next);
        if (walked.has(`${node.id}>${nextId}`)) {
          g.lineStyle(4, 0xffd166, 0.95);
          g.lineBetween(from.x, from.y, to.x, to.y);
          continue;
        }
        // Punkte alle 11 Einheiten, wie auf dem Vorbild.
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        const dots = Math.floor(length / 11);
        g.fillStyle(0xf6ead2, 0.75);
        for (let d = 1; d < dots; d += 1) {
          const t = d / dots;
          g.fillCircle(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 2);
        }
      }
    }
  }

  private drawNodes(): void {
    const current = currentNode(this.run);
    for (const node of this.run.map.nodes) {
      const { x, y } = this.nodePosition(node);
      const reachable = canEnter(this.run, node.id);
      const visited = this.run.visited.includes(node.id);
      const past = node.layer < current.layer && !visited;

      const g = this.add.graphics();
      const radius = node.type === "boss" ? NODE_RADIUS + 7 : NODE_RADIUS;
      g.fillStyle(0x11161f, 0.6);
      g.fillCircle(x + 2, y + 3, radius);
      g.fillStyle(NODE_COLORS[node.type], past ? 0.35 : 1);
      g.fillCircle(x, y, radius);
      g.lineStyle(3, visited ? 0xffd166 : 0x3b2a1a, past ? 0.4 : 1);
      g.strokeCircle(x, y, radius);

      // Gefahr als Punkte unter dem Knoten (Kampf, Elite, Boss).
      if (node.type === "combat" || node.type === "elite" || node.type === "boss") {
        const pips = Math.min(5, Math.ceil(node.danger / 2));
        for (let i = 0; i < pips; i += 1) {
          g.fillStyle(0xe4572e, past ? 0.35 : 1);
          g.fillCircle(x - (pips - 1) * 4 + i * 8, y + radius + 7, 3);
        }
      }

      const symbol = NODE_SYMBOLS[node.type];
      if (symbol) {
        this.add
          .text(x, y, symbol, {
            fontFamily: UI.font,
            fontSize: "18px",
            color: "#3b2a1a",
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setAlpha(past ? 0.4 : 1);
      }

      if (reachable) {
        // Erreichbare Knoten pulsieren - so sieht man ohne Erklaerung, wo es
        // weitergeht.
        const ring = this.add.circle(x, y, radius + 6).setStrokeStyle(3, 0xffffff, 0.9);
        this.tweens.add({
          targets: ring,
          scale: 1.25,
          alpha: 0.2,
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
        const hit = this.add.circle(x, y, radius + 12, 0x000000, 0).setInteractive();
        hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.select(node.id));
      }
    }

    // Das Team steht auf dem aktuellen Knoten - als Figur aus dem Pixel-Sheet.
    const here = this.nodePosition(current);
    const marker = this.add
      .image(here.x, here.y - NODE_RADIUS - 16, SHEET_KEY, CHARACTER_TILES[this.character])
      .setScale(2.4);
    this.tweens.add({ targets: marker, y: marker.y - 4, duration: 600, yoyo: true, repeat: -1 });
  }

  private drawHeader(): void {
    const left = SAFE.left + 16;
    const current = currentNode(this.run);
    const region = regionOfLayer(Math.max(1, current.layer + 1), this.run.map.depth);
    this.add.text(left, SAFE.top + 10, `Tag ${this.run.day + 1} · ${STORY.title}`, {
      fontFamily: UI.font,
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold",
    });
    const line =
      this.message ||
      (this.run.day === 0 ? STORY.intro : `${region.name}: ${region.intro}`);
    this.add.text(left, SAFE.top + 40, line, {
      fontFamily: UI.font,
      fontSize: "13px",
      color: "#c9d6e6",
      wordWrap: { width: VIEWPORT.width - SAFE.left - SAFE.right - 32 },
    });
  }

  /** Die Tafel unten: was der gewaehlte Knoten bietet, und Losziehen. */
  private buildInfoPanel(): void {
    const left = SAFE.left + 14;
    const right = VIEWPORT.width - SAFE.right - 14;
    const top = VIEWPORT.height - SAFE.bottom - FOOTER;
    const width = right - left;

    const panel = new UiNineSlice(
      this,
      UI.panel.frame,
      UI.panel.slice,
      left + width / 2,
      top + FOOTER / 2 - 4,
      width,
      FOOTER - 8,
    );
    this.infoTitle = this.add.text(left + 18, top + 8, "", {
      fontFamily: UI.font,
      fontSize: "18px",
      color: "#fff4dc",
      fontStyle: "bold",
    });
    this.infoText = this.add.text(left + 18, top + 34, "", {
      fontFamily: UI.font,
      fontSize: "13px",
      color: "#f6ead2",
      wordWrap: { width: 320 },
    });

    // Drei Eckdaten-Balken wie auf dem Vorbild.
    const labels = ["Kartengrösse", "Gefahr", "Beute"];
    const barLeft = left + 360;
    labels.forEach((label, index) => {
      const y = top + 14 + index * 26;
      this.add.text(barLeft, y, label, {
        fontFamily: UI.font,
        fontSize: "13px",
        color: "#f6ead2",
      });
      const look = index === 1 ? UI.bar.red : index === 2 ? UI.bar.yellow : UI.bar.blue;
      this.bars.push(new UiBar(this, barLeft + 100, y + 1, 150, 14, look).setFraction(0));
    });

    this.statusText = this.add.text(right - 18, top + 14, "", {
      fontFamily: UI.font,
      fontSize: "12px",
      color: "#f6ead2",
      align: "right",
    });
    this.statusText.setOrigin(1, 0);

    this.goButton = new Button(this, right - 100, top + FOOTER - 40, "Losziehen", () => this.go(), {
      width: 170,
      height: 44,
      fontSize: 18,
    });
    this.goButton.setEnabled(false);

    this.info = this.add.container(0, 0, [panel.container]);
    this.info.setDepth(-1);
    this.showInfo(null);
  }

  private showInfo(node: MapNode | null): void {
    const fraction = (value: number, max: number): number => Math.min(1, value / max);
    if (!node) {
      this.infoTitle.setText("Wähle einen Weg");
      this.infoText.setText(
        "Tippe einen leuchtenden Ort an. Gefährlicher heisst: bessere Beute – und mehr Gegner.",
      );
      this.bars.forEach((bar) => bar.setFraction(0));
      return;
    }
    const name = placeName(node, this.run.map.depth, this.run.seed);
    const region = regionOfLayer(node.layer, this.run.map.depth);
    this.infoTitle.setText(name);
    const note: Record<MapNode["type"], string> = {
      start: "",
      combat: "Durchqueren und den Ausgang erreichen. Unterwegs liegt Beute.",
      elite: "Ein Anführer wartet hier. Hart – aber was er fallen lässt, lohnt sich.",
      rest: "Kein Kampf. Alle heilen sich vollständig.",
      extraction: "Hier kommt ihr raus: Ausgang erreichen, und die Beute ist gesichert.",
      boss: "Der Wächter des Hafens. Besiegt ihn, und der Run ist gewonnen.",
    };
    this.infoText.setText(`${nodeTypeLabel(node)} · ${region.name}\n${note[node.type]}`);
    this.bars[0]?.setFraction(node.type === "rest" ? 0 : fraction(node.arenaSize, 3));
    this.bars[1]?.setFraction(fraction(node.danger, 13));
    this.bars[2]?.setFraction(fraction(node.loot, 14));
  }

  // ----------------------------------------------------------------
  // Wahl
  // ----------------------------------------------------------------

  private select(nodeId: number): void {
    if (this.leaving) return;
    this.selected = nodeId;
    this.showInfo(this.run.map.nodes[nodeId] as MapNode);
    this.updateStatus();
  }

  /** Koennen wir losziehen? Solo immer, im Koop nur der Host mit allen da. */
  private get othersReady(): boolean {
    if (!this.transport) return true;
    const others = this.run.players.filter((player) => player.id !== this.transport?.selfId);
    return others.every((player) => this.readyPeers.has(player.id));
  }

  private updateStatus(): void {
    const lines = this.run.players.map((player) => {
      const items = carriedCount(player.backpack);
      const hp = player.health === undefined ? "voll" : `${Math.round(player.health)}`;
      return `${player.name}: Leben ${hp} · ${items} Beute`;
    });
    if (this.transport && !this.transport.isHost) {
      lines.push("Der Host wählt den Weg.");
    } else if (!this.othersReady) {
      lines.push("Warte auf Mitspieler …");
    }
    this.statusText.setText(lines.join("\n"));

    const mayChoose = !this.transport || this.transport.isHost;
    this.goButton.setEnabled(mayChoose && this.selected !== null && this.othersReady);
    this.goButton.setVisible(mayChoose);
  }

  private go(): void {
    if (this.selected === null || this.leaving) return;
    if (this.transport?.isHost) {
      this.transport.broadcast({
        t: "move",
        node: this.selected,
        players: toNetPlayers(this.run.players, this.transport.selfId),
      });
    }
    this.moveTo(this.selected);
  }

  /** Auf den Knoten ziehen - fuer Host, Client und solo gleich. */
  private moveTo(nodeId: number): void {
    this.leaving = true;
    const action = enterNode(this.run, nodeId);
    if (action === "rest") {
      // Rast ist sofort erledigt - neu zeichnen mit Meldung.
      this.scene.restart({
        run: this.run,
        character: this.character,
        transport: this.transport,
        message: "Unterschlupf: Alle haben sich erholt und sind wieder bei vollem Leben.",
      } satisfies MapSceneData);
      return;
    }

    const place = { nodeId };
    let session: GameSession;
    if (!this.transport) {
      session = new SoloSession(this.run.players[0] as PlayerSetup, this.run.seed, place);
    } else if (this.transport.isHost) {
      session = new HostSession(
        this.transport,
        this.run.players,
        this.transport.selfId,
        this.run.seed,
        place,
      );
    } else {
      session = new ClientSession(
        this.transport,
        this.run.players,
        this.transport.selfId,
        this.run.seed,
        place,
      );
    }
    this.scene.start("Game", { character: this.character, session, run: this.run });
  }

  // ----------------------------------------------------------------
  // Koop
  // ----------------------------------------------------------------

  private listen(): void {
    const transport = this.transport;
    if (!transport) return;

    transport.onMessage((from, message) => {
      if (transport.isHost && message.t === "ready") {
        this.readyPeers.add(from);
        this.updateStatus();
      } else if (!transport.isHost && message.t === "move" && !this.leaving) {
        // Der Host hat gewaehlt: seinen Stand der Spieler uebernehmen.
        this.run.players = toSetups(message.players);
        this.moveTo(message.node);
      }
    });
    transport.onPeerLeave((peerId) => {
      if (transport.isHost) {
        this.run.players = this.run.players.filter((player) => player.id !== peerId);
        this.readyPeers.delete(peerId);
        this.updateStatus();
      } else {
        this.statusText.setText("Der Host hat die Runde verlassen.");
        this.goButton.setVisible(false);
      }
    });

    if (!transport.isHost) {
      // Dem Host sagen: Ich bin auf der Karte und hoere zu.
      transport.broadcast({ t: "ready" });
    }
  }
}
