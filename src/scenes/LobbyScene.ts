/**
 * Koop: Raum eroeffnen oder beitreten, auf Mitspieler warten, gemeinsam losziehen.
 *
 * Bis zu vier Mechs auf einer Festung. Der Host gibt einen Raumcode weiter,
 * die anderen tippen ihn ein. Jeder bringt den Mech mit, den er zuletzt in der
 * Crew-Wahl ausgesucht hat. Hitze und Werft-Verbesserungen kommen vom Host.
 *
 * Mit `?debug=lokal` laeuft alles ueber `BroadcastChannel` zwischen zwei Tabs
 * desselben Browsers - ohne Server, zum Entwickeln.
 */

import Phaser from "phaser";
import { playerName } from "../app";
import { audio } from "../audio/AudioEngine";
import { SAFE, VIEWPORT } from "../config/constants";
import { CREW } from "../game/data/crew";
import { runOptions } from "../game/meta";
import { Simulation } from "../game/Simulation";
import type { PlayerSetup } from "../game/types";
import { ClientSession } from "../net/ClientSession";
import { HostSession } from "../net/HostSession";
import { Lobby } from "../net/Lobby";
import { LocalTransport } from "../net/LocalTransport";
import { ConnectError, PeerTransport } from "../net/PeerTransport";
import { MAX_PLAYERS, type NetPlayerInfo, type RunOptions } from "../net/protocol";
import { createRoomCode, isValidRoomCode, normalizeRoomCode } from "../net/roomCode";
import type { Transport } from "../net/Transport";
import { LOCAL_NET, SHORT_ROUTE } from "../platform/debugFlags";
import { loadProfile } from "../platform/profileStore";
import { Button } from "../ui/Button";
import { BOX, ComicBox } from "../ui/ComicBox";
import { label, menuBackdrop } from "../ui/menu";
import { crewKey } from "../ui/pixel/textures";
import { FONT_TITLE, T } from "../ui/theme";

const LOCAL_ROOM_CODE = "LOCAL1";
/** So lange wartet der Host nach dem Start, damit `start` bei allen ankommt. */
const START_GRACE_MS = 1200;

type Mode = "menu" | "host" | "join";

export class LobbyScene extends Phaser.Scene {
  private mode: Mode = "menu";
  private lobby: Lobby | null = null;
  private transport: Transport | null = null;
  private handedOver = false;
  private gone = false;
  private status!: Phaser.GameObjects.Text;
  private code!: Phaser.GameObjects.Text;
  private list: { destroy(): void }[] = [];
  private startButton: Button | null = null;
  private joinButton: Button | null = null;
  private codeField: Phaser.GameObjects.DOMElement | null = null;

  constructor() {
    super("Lobby");
  }

  init(data: { mode?: Mode }): void {
    this.mode = data.mode ?? "menu";
    this.lobby = null;
    this.transport = null;
    this.handedOver = false;
    this.gone = false;
    this.list = [];
    this.startButton = null;
    this.joinButton = null;
    this.codeField = null;
  }

  create(): void {
    const w = VIEWPORT.width;
    const cx = w / 2;
    menuBackdrop(this, "KOOP", () => this.back());
    this.code = label(this, "", cx, 112, 56, T.gold, {
      font: FONT_TITLE,
      align: "center",
    }).setOrigin(0.5);
    this.status = label(this, "", cx, 160, 15, T.body, {
      align: "center",
      width: w - 200,
    }).setOrigin(0.5, 0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.gone = true;
      this.lobby?.destroy();
      if (!this.handedOver) {
        this.transport?.close();
      }
    });
    if (this.mode === "menu") {
      this.showMenu();
    } else if (this.mode === "host") {
      void this.hostRoom();
    } else if (LOCAL_NET) {
      void this.joinRoom(LOCAL_ROOM_CODE);
    } else {
      this.buildJoinForm();
    }
  }

  private showMenu(): void {
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    const profile = loadProfile();
    this.status.setText(
      `Bis zu ${MAX_PLAYERS} Mechs auf einer Festung. Schrott und Rumpf gehören allen, der Host wählt den Weg.\nDu ziehst mit: ${CREW[profile.selected].name} (ändern unter „Losziehen“).`,
    );
    new Button(
      this,
      w / 2 - 140,
      h / 2 + 50,
      "RAUM ERÖFFNEN",
      () => this.scene.restart({ mode: "host" }),
      {
        width: 250,
        height: 60,
        fontSize: 22,
      },
    );
    new Button(
      this,
      w / 2 + 140,
      h / 2 + 50,
      "BEITRETEN",
      () => this.scene.restart({ mode: "join" }),
      {
        width: 250,
        height: 60,
        fontSize: 22,
        variant: "secondary",
      },
    );
  }

  // --- Verbinden ---------------------------------------------------------------------------

  private async hostRoom(): Promise<void> {
    audio.unlock();
    this.status.setText("Raum wird geöffnet …");
    try {
      const transport = LOCAL_NET
        ? new LocalTransport(LOCAL_ROOM_CODE, true)
        : await PeerTransport.host(createRoomCode());
      this.attach(transport);
    } catch (error) {
      this.showError(error);
    }
  }

  private async joinRoom(raw: string): Promise<void> {
    audio.unlock();
    const code = normalizeRoomCode(raw);
    if (!LOCAL_NET && !isValidRoomCode(code)) {
      this.status.setText("Bitte den ganzen Raumcode eingeben (6 Zeichen).");
      return;
    }
    this.joinButton?.setEnabled(false);
    this.status.setText("Verbinde …");
    try {
      const transport = LOCAL_NET
        ? new LocalTransport(LOCAL_ROOM_CODE, false)
        : await PeerTransport.join(code);
      this.codeField?.setVisible(false);
      this.joinButton?.setVisible(false);
      this.attach(transport);
    } catch (error) {
      this.joinButton?.setEnabled(true);
      this.showError(error);
    }
  }

  private attach(transport: Transport): void {
    if (this.gone) {
      transport.close();
      return;
    }
    this.transport = transport;
    this.code.setText(transport.isHost ? transport.roomCode : "");
    this.status.setText(
      transport.isHost
        ? "Gib den Code weiter. Mitspieler tippen ihn unter „Koop → Beitreten“ ein."
        : "Verbunden. Warte, bis der Host losfährt …",
    );
    const profile = loadProfile();
    const lobby = new Lobby(transport, { name: playerName(), crew: profile.selected });
    this.lobby = lobby;
    lobby.onError((message) => {
      this.status.setText(message);
      this.startButton?.setEnabled(false);
    });
    lobby.onPlayersChanged((players) => this.renderPlayers(players));
    lobby.onStart((setups, seed, options) => this.begin(lobby, transport, setups, seed, options));
    if (transport.isHost) {
      this.startButton = new Button(
        this,
        VIEWPORT.width / 2,
        VIEWPORT.height - SAFE.bottom - 44,
        "LOSZIEHEN ▶",
        () => lobby.start(this.hostOptions()),
        { width: 260, height: 56, fontSize: 22 },
      );
    }
    this.watchPath(transport);
  }

  /** Der Host bringt sein Profil mit: Hitze, Bauplaene, Verbesserungen. */
  private hostOptions(): RunOptions {
    return { ...runOptions(loadProfile()), lengthFactor: SHORT_ROUTE ? 0.1 : 1 };
  }

  private begin(
    lobby: Lobby,
    transport: Transport,
    setups: PlayerSetup[],
    seed: number,
    options: RunOptions,
  ): void {
    this.startButton?.setEnabled(false);
    this.status.setText("Los geht's …");
    const selfId = lobby.selfId;
    const go = (): void => {
      if (this.handedOver) {
        return;
      }
      this.handedOver = true;
      lobby.destroy();
      const session = transport.isHost
        ? new HostSession(transport, setups, selfId, seed, options)
        : new ClientSession(transport, selfId, new Simulation(setups, seed, options).state);
      this.scene.start("Game", { session });
    };
    if (transport.isHost) {
      // In dieser Zeit wiederholt die Lobby das `start`, bis jeder sich meldet.
      // (Echter Zeitgeber statt Phaser-Uhr: laeuft auch, wenn der Tab im Hintergrund liegt.)
      window.setTimeout(() => {
        if (!this.gone) {
          go();
        }
      }, START_GRACE_MS);
    } else {
      go();
    }
  }

  // --- Anzeige ------------------------------------------------------------------------------

  private renderPlayers(players: NetPlayerInfo[]): void {
    for (const o of this.list) {
      o.destroy();
    }
    this.list = [];
    const w = VIEWPORT.width;
    const rowW = Math.min(520, w - 160);
    players.forEach((player, i) => {
      const y = 232 + i * 52;
      this.list.push(
        new ComicBox(this, BOX.panel, w / 2, y, rowW, 46),
        this.add.image(w / 2 - rowW / 2 + 30, y - 2, crewKey(player.crew)).setScale(0.6),
        label(
          this,
          `${player.name}${player.isHost ? "  (Host)" : ""}`,
          w / 2 - rowW / 2 + 60,
          y - 10,
          16,
          T.light,
        ),
        label(this, CREW[player.crew].name, w / 2 + rowW / 2 - 16, y - 9, 14, T.cyan).setOrigin(
          1,
          0,
        ),
      );
    });
    if (this.transport?.isHost) {
      this.startButton?.setEnabled(players.length >= 1 && players.length <= MAX_PLAYERS);
    }
  }

  private watchPath(transport: Transport): void {
    if (!(transport instanceof PeerTransport)) {
      return;
    }
    let tries = 0;
    const look = (): void => {
      tries += 1;
      const path = transport.connectionPath;
      if (path) {
        const text =
          path.kind === "relay"
            ? "Verbindung über TURN-Relay (direkt ging es nicht)"
            : path.kind === "direkt"
              ? "Verbindung direkt zwischen den Geräten"
              : "Verbindungsweg unbekannt";
        label(this, text, VIEWPORT.width / 2, VIEWPORT.height - SAFE.bottom - 92, 12, T.muted, {
          align: "center",
        }).setOrigin(0.5);
        return;
      }
      if (tries < 12 && !this.gone) {
        this.time.delayedCall(500, look);
      }
    };
    this.time.delayedCall(500, look);
  }

  private buildJoinForm(): void {
    const cx = VIEWPORT.width / 2;
    this.status.setText("Gib den Raumcode ein, den dir der Host nennt.");
    const field = document.createElement("input");
    field.type = "text";
    field.maxLength = 6;
    field.placeholder = "RAUMCODE";
    field.autocomplete = "off";
    field.setAttribute(
      "style",
      [
        "width:260px",
        "box-sizing:border-box",
        "padding:8px 10px",
        'font:400 34px "Jersey 10", monospace',
        "text-align:center",
        "letter-spacing:6px",
        "text-transform:uppercase",
        "border:3px solid #b8864a",
        "background:#18151f",
        "color:#f6c24c",
        "outline:none",
      ].join(";"),
    );
    this.codeField = this.add.dom(cx, 250, field);
    this.joinButton = new Button(
      this,
      cx,
      330,
      "BEITRETEN",
      () => void this.joinRoom(field.value),
      {
        width: 260,
        height: 56,
        fontSize: 22,
      },
    );
  }

  private showError(error: unknown): void {
    const message =
      error instanceof ConnectError || error instanceof Error
        ? error.message
        : "Verbindung fehlgeschlagen.";
    this.status.setText(message);
  }

  private back(): void {
    this.scene.start(this.mode === "menu" ? "Title" : "Lobby", { mode: "menu" });
  }
}
