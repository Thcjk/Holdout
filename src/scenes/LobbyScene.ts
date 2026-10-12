/**
 * Der Koop-Raum: Raum eroeffnen oder beitreten, auf Mitspieler warten, starten.
 *
 * Host: erzeugt einen Raumcode, zeigt die Spielerliste und hat den Startknopf.
 * Client: tippt den Code ein, wartet auf den Start des Hosts.
 *
 * Mit `?debug=lokal` laeuft alles ueber `BroadcastChannel` zwischen zwei Tabs
 * desselben Browsers - ohne Server, zum Entwickeln.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { characterKey, weaponIconKey } from "../config/assets";
import { SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { MAX_PLAYERS } from "../game/constants";
import { CHARACTERS } from "../game/data/characters";
import { Simulation } from "../game/Simulation";
import type { PlayerSetup, CharacterId, WeaponId } from "../game/types";
import { ClientSession } from "../net/ClientSession";
import { HostSession } from "../net/HostSession";
import { Lobby } from "../net/Lobby";
import { LocalTransport } from "../net/LocalTransport";
import { ConnectError, PeerTransport } from "../net/PeerTransport";
import { decodeState, encodeState } from "../net/protocol";
import type { NetPlayerInfo } from "../net/protocol";
import { createRoomCode, isValidRoomCode, normalizeRoomCode } from "../net/roomCode";
import type { Transport } from "../net/Transport";
import { LOCAL_NET } from "../platform/debugFlags";
import { setReloadSafe } from "../platform/update";
import { Button } from "../ui/Button";
import { insetPanel, menuBackground, menuText, woodPanel } from "../ui/menuStyle";
import { playerName } from "../app";
import type { PlayMode } from "../app";

const LOCAL_ROOM_CODE = "LOCAL1";
/** So lange laeuft der Host nach dem Start noch weiter, damit `start` bei allen ankommt. */
const START_GRACE_MS = 1200;

interface LobbyData {
  mode: PlayMode;
  character: CharacterId;
  weapon: WeaponId;
}

export class LobbyScene extends Phaser.Scene {
  private mode: PlayMode = "host";
  private character: CharacterId = "soeldner";
  private weapon: WeaponId = "pistol";

  private lobby: Lobby | null = null;
  private transport: Transport | null = null;
  private handedOver = false;
  private gone = false;

  private status!: Phaser.GameObjects.Text;
  private codeText!: Phaser.GameObjects.Text;
  private pathText!: Phaser.GameObjects.Text;
  private listObjects: Phaser.GameObjects.GameObject[] = [];
  private startButton: Button | null = null;
  private joinButton: Button | null = null;
  private inputDom: Phaser.GameObjects.DOMElement | null = null;

  constructor() {
    super("Lobby");
  }

  init(data: LobbyData): void {
    this.mode = data.mode;
    this.character = data.character;
    this.weapon = data.weapon;
    this.lobby = null;
    this.transport = null;
    this.handedOver = false;
    this.gone = false;
    this.listObjects = [];
    this.startButton = null;
    this.joinButton = null;
    this.inputDom = null;
  }

  create(): void {
    setReloadSafe(false);
    const cx = VIEWPORT.width / 2;
    menuBackground(this);
    const panelW = Math.min(720, VIEWPORT.width - SAFE.left - SAFE.right - 60);
    woodPanel(this, cx, 290, panelW, 450);
    menuText(this, cx, 62, this.mode === "host" ? "Koop-Raum" : "Raum beitreten", 34, UI.text.title, true);

    this.codeText = menuText(this, cx, 128, "", 44, UI.text.dark, true);
    this.status = menuText(this, cx, 174, "", 18, UI.text.body).setWordWrapWidth(panelW - 60);
    this.pathText = menuText(this, cx, 470, "", 14, UI.text.muted);

    new Button(this, SAFE.left + 70, 34, "‹ Zurück", () => this.back(), {
      width: 110,
      height: 44,
      fontSize: 18,
      variant: "secondary",
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.gone = true;
      this.lobby?.destroy();
      if (!this.handedOver) {
        this.transport?.close();
      }
    });

    if (this.mode === "host") {
      void this.hostRoom();
    } else if (LOCAL_NET) {
      void this.joinRoom(LOCAL_ROOM_CODE);
    } else {
      this.buildJoinForm(cx, panelW);
    }
  }

  // --- Verbinden ------------------------------------------------------------

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

  private async joinRoom(rawCode: string): Promise<void> {
    audio.unlock();
    const code = normalizeRoomCode(rawCode);
    if (!LOCAL_NET && !isValidRoomCode(code)) {
      this.status.setText("Bitte den vollständigen Raumcode eingeben (6 Zeichen).");
      return;
    }
    this.joinButton?.setEnabled(false);
    this.status.setText("Verbinde …");
    try {
      const transport = LOCAL_NET ? new LocalTransport(LOCAL_ROOM_CODE, false) : await PeerTransport.join(code);
      this.hideJoinForm();
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
    this.codeText.setText(transport.isHost ? transport.roomCode : "");
    this.status.setText(transport.isHost ? "Gib den Code weiter. Mitspieler tippen ihn unter „Koop: Beitreten“ ein." : "Verbunden. Warte auf den Start …");

    const lobby = new Lobby(transport, { name: playerName(), character: this.character, weapon: this.weapon });
    this.lobby = lobby;
    lobby.onError((message) => {
      this.status.setText(message);
      this.startButton?.setEnabled(false);
    });
    lobby.onPlayersChanged((players) => this.renderPlayers(players));
    lobby.onStart((setups, seed) => this.begin(lobby, transport, setups, seed));

    if (transport.isHost) {
      this.startButton = new Button(this, VIEWPORT.width / 2, 430, "Runde starten", () => lobby.start(), {
        width: 320,
        height: 60,
        fontSize: 26,
      });
    }
    this.watchPath(transport);
  }

  private begin(lobby: Lobby, transport: Transport, setups: PlayerSetup[], seed: number): void {
    this.startButton?.setEnabled(false);
    this.status.setText("Los geht's …");
    const selfId = lobby.selfId;

    const go = (): void => {
      if (this.handedOver) {
        return;
      }
      this.handedOver = true;
      lobby.destroy();
      let session;
      if (transport.isHost) {
        session = new HostSession(transport, setups, selfId, seed);
      } else {
        // Bis der erste Zustand des Hosts da ist, steht hier die Ausgangslage.
        const initial = decodeState(encodeState(new Simulation(setups, seed).state));
        session = new ClientSession(transport, selfId, initial);
      }
      this.scene.start("Game", { session, mode: this.mode });
    };

    if (transport.isHost) {
      // Der Host wartet einen Moment: In dieser Zeit wiederholt die Lobby das
      // `start`-Paket, bis jeder Client sich gemeldet hat.
      this.time.delayedCall(START_GRACE_MS, go);
    } else {
      go();
    }
  }

  // --- Anzeige --------------------------------------------------------------

  private renderPlayers(players: NetPlayerInfo[]): void {
    for (const object of this.listObjects) {
      object.destroy();
    }
    this.listObjects = [];
    const cx = VIEWPORT.width / 2;
    const rowW = Math.min(520, VIEWPORT.width - 140);
    players.forEach((player, index) => {
      const y = 230 + index * 46;
      const def = CHARACTERS[player.character];
      this.listObjects.push(
        insetPanel(this, cx, y, rowW, 40).container,
        this.add.image(cx - rowW / 2 + 28, y, characterKey(player.character)).setScale(0.45),
        this.add
          .text(cx - rowW / 2 + 58, y, `${player.name}${player.isHost ? "  (Host)" : ""}`, {
            fontFamily: UI.font,
            fontSize: "20px",
            color: UI.text.dark,
            fontStyle: "bold",
          })
          .setOrigin(0, 0.5),
        this.add
          .text(cx + rowW / 2 - 52, y, def.name, { fontFamily: UI.font, fontSize: "16px", color: UI.text.dark })
          .setOrigin(1, 0.5),
        this.add.image(cx + rowW / 2 - 26, y, weaponIconKey(player.startWeapon)).setDisplaySize(30, 30),
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
        this.pathText.setText(
          path.kind === "relay"
            ? "Verbindung über TURN-Relay (direkt ging es nicht)"
            : path.kind === "direkt"
              ? "Verbindung direkt zwischen den Geräten"
              : "Verbindungsweg unbekannt",
        );
        return;
      }
      if (tries < 12 && !this.gone) {
        this.time.delayedCall(500, look);
      }
    };
    this.time.delayedCall(500, look);
  }

  private buildJoinForm(cx: number, panelW: number): void {
    this.status.setText("Gib den Raumcode ein, den dir der Host nennt.");
    const field = document.createElement("input");
    field.type = "text";
    field.maxLength = 6;
    field.placeholder = "RAUMCODE";
    field.autocomplete = "off";
    field.setAttribute(
      "style",
      [
        "width:280px",
        "box-sizing:border-box",
        "padding:8px 10px",
        `font:700 24px ${UI.font}`,
        "text-align:center",
        "letter-spacing:5px",
        "text-transform:uppercase",
        "border-radius:6px",
        "border:3px solid #8b6a45",
        "background:#f3e6c8",
        `color:${UI.text.dark}`,
        "outline:none",
        "box-shadow:inset 0 2px 0 rgba(0,0,0,0.12)",
      ].join(";"),
    );
    this.inputDom = this.add.dom(cx, 250, field);
    this.joinButton = new Button(this, cx, 340, "Beitreten", () => void this.joinRoom(field.value), {
      width: Math.min(320, panelW - 80),
      height: 60,
      fontSize: 26,
    });
  }

  private hideJoinForm(): void {
    this.inputDom?.setVisible(false);
    this.joinButton?.setVisible(false);
  }

  private showError(error: unknown): void {
    const message = error instanceof ConnectError || error instanceof Error ? error.message : "Verbindung fehlgeschlagen.";
    this.status.setText(message);
  }

  private back(): void {
    this.scene.start("Title");
  }
}
