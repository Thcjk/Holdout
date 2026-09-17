/**
 * Lobby: Raum erstellen oder beitreten, Mitspieler abwarten, starten.
 *
 * Drei Wege hinein, absichtlich in der Reihenfolge, die das Briefing fuer
 * Phase 6 vorschlaegt: erst zwei Tabs auf demselben Rechner (lokaler Test),
 * dann echte Geraete ueber WebRTC.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { COLORS, SAFE, VIEWPORT } from "../config/constants";
import { ClientSession } from "../net/ClientSession";
import { HostSession } from "../net/HostSession";
import { LocalTransport } from "../net/LocalTransport";
import { Lobby, MAX_PLAYERS } from "../net/Lobby";
import { PeerTransport } from "../net/PeerTransport";
import { createRoomCode, isValidRoomCode, normalizeRoomCode } from "../net/roomCode";
import type { Transport } from "../net/Transport";
import type { CharacterId } from "../systems/types";
import { Button } from "../ui/Button";
import { setReloadSafe } from "../platform/update";

/** Fester Code fuer den lokalen Zwei-Tab-Test - der muss niemand abtippen. */
const LOCAL_ROOM_CODE = "LOCAL1";

export interface LobbySceneData {
  character: CharacterId;
}

export class LobbyScene extends Phaser.Scene {
  private character: CharacterId = "scout";
  private lobby: Lobby | null = null;
  private transport: Transport | null = null;

  private statusText!: Phaser.GameObjects.Text;
  private codeText!: Phaser.GameObjects.Text;
  private playerText!: Phaser.GameObjects.Text;
  private startButton?: Button;
  private codeInput?: HTMLInputElement;
  private choiceObjects: { setVisible(visible: boolean): void }[] = [];

  constructor() {
    super("Lobby");
  }

  init(data: LobbySceneData): void {
    this.character = data.character ?? "scout";
    this.lobby = null;
    this.transport = null;
    this.startButton = undefined;
    this.codeInput = undefined;
    this.choiceObjects = [];
  }

  create(): void {
    // Hier nicht neu laden: Das wuerde diesen Bildschirm wegwischen.
    setReloadSafe(false);
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.add
      .text(VIEWPORT.width / 2, 48, "Zusammen spielen", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        color: "#dce8f7",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.codeText = this.add
      .text(VIEWPORT.width / 2, 108, "", {
        fontFamily: "system-ui, monospace",
        fontSize: "40px",
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(VIEWPORT.width / 2, 160, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#8ea6c4",
        align: "center",
        wordWrap: { width: VIEWPORT.width - 120 },
      })
      .setOrigin(0.5);

    this.playerText = this.add
      .text(VIEWPORT.width / 2, 250, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#dce8f7",
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5);

    this.buildChoices();

    new Button(
      this,
      SAFE.left + 92,
      VIEWPORT.height - SAFE.bottom - 34,
      "Zurück",
      () => this.leave(),
      {
        width: 140,
        height: 40,
        fontSize: 16,
        color: COLORS.hudDim,
      },
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.lobby?.destroy();
      this.codeInput?.remove();
    });

    // Ein geteilter Link kann den Raumcode mitbringen: .../?room=ABC123
    const fromUrl = normalizeRoomCode(
      new URLSearchParams(window.location.search).get("room") ?? "",
    );
    if (isValidRoomCode(fromUrl)) {
      this.statusText.setText(`Raumcode ${fromUrl} aus dem Link übernommen.`);
      if (this.codeInput) {
        this.codeInput.value = fromUrl;
      }
    }
  }

  private buildChoices(): void {
    const hostButton = new Button(
      this,
      VIEWPORT.width / 2 - 170,
      330,
      "Raum erstellen",
      () => void this.hostRoom(),
      { width: 300 },
    );

    const joinButton = new Button(
      this,
      VIEWPORT.width / 2 + 170,
      330,
      "Beitreten",
      () => void this.joinRoom(),
      { width: 300 },
    );

    const localHost = new Button(
      this,
      VIEWPORT.width / 2 - 170,
      450,
      "Lokaler Test: Raum",
      () => this.startLocal(true),
      { width: 300, height: 44, fontSize: 16, color: COLORS.hudDim },
    );

    const localJoin = new Button(
      this,
      VIEWPORT.width / 2 + 170,
      450,
      "Lokaler Test: beitreten",
      () => this.startLocal(false),
      { width: 300, height: 44, fontSize: 16, color: COLORS.hudDim },
    );

    const hint = this.add
      .text(
        VIEWPORT.width / 2,
        494,
        "Lokaler Test verbindet zwei Tabs desselben Browsers - ohne Internet.",
        { fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "#8ea6c4" },
      )
      .setOrigin(0.5);

    // Texteingabe als echtes HTML-Feld: Nur so oeffnet sich auf dem Handy die
    // Tastatur des Systems. Phaser positioniert es passend ueber dem Canvas.
    const dom = this.add.dom(VIEWPORT.width / 2 + 170, 386).createFromHTML(
      `<input type="text" maxlength="6" placeholder="RAUMCODE"
        style="width:280px;padding:8px 10px;font:600 20px system-ui,sans-serif;
               text-align:center;letter-spacing:4px;text-transform:uppercase;
               border-radius:8px;border:2px solid #5f7191;background:#1e2734;color:#dce8f7;" />`,
    );
    this.codeInput =
      dom.node instanceof HTMLElement ? (dom.node.querySelector("input") ?? undefined) : undefined;

    this.choiceObjects = [hostButton, joinButton, localHost, localJoin, hint, dom];
  }

  private hideChoices(): void {
    for (const object of this.choiceObjects) {
      object.setVisible(false);
    }
  }

  private startLocal(isHost: boolean): void {
    audio.unlock();
    this.hideChoices();
    this.statusText.setText(
      isHost
        ? "Lokaler Raum offen. Öffne dieselbe Seite in einem zweiten Tab und wähle dort „Lokaler Test: beitreten“."
        : "Suche den lokalen Raum im anderen Tab …",
    );
    this.useTransport(new LocalTransport(LOCAL_ROOM_CODE, isHost));
  }

  private async hostRoom(): Promise<void> {
    audio.unlock();
    this.hideChoices();
    const code = createRoomCode();
    this.statusText.setText("Raum wird geöffnet …");

    try {
      this.useTransport(await PeerTransport.host(code));
    } catch (error) {
      this.showError(error);
    }
  }

  private async joinRoom(): Promise<void> {
    audio.unlock();
    const code = normalizeRoomCode(this.codeInput?.value ?? "");
    if (!isValidRoomCode(code)) {
      this.statusText.setText("Bitte einen vollständigen Raumcode eingeben (6 Zeichen).");
      return;
    }

    this.hideChoices();
    this.statusText.setText(`Verbinde mit Raum ${code} …`);

    try {
      this.useTransport(await PeerTransport.join(code));
    } catch (error) {
      this.showError(error);
    }
  }

  private useTransport(transport: Transport): void {
    this.transport = transport;
    const lobby = new Lobby(transport, {
      name: playerName(transport.isHost),
      character: this.character,
    });
    this.lobby = lobby;

    this.codeText.setText(transport.roomCode);

    lobby.onPlayersChanged((players) => {
      this.playerText.setText(
        players.length === 0
          ? "Noch niemand verbunden."
          : players
              .map(
                (player) =>
                  `${player.name} · ${player.character}${player.isHost ? "  (Host)" : ""}`,
              )
              .join("\n"),
      );

      if (transport.isHost) {
        this.statusText.setText(
          players.length < MAX_PLAYERS
            ? "Gib den Raumcode weiter. Start geht auch allein."
            : "Der Raum ist voll.",
        );
        this.ensureStartButton();
      } else if (players.length > 0) {
        this.statusText.setText("Verbunden. Der Host startet die Runde.");
      }
    });

    lobby.onError((message) => this.statusText.setText(message));

    lobby.onStart((setups, seed) => {
      lobby.destroy();
      audio.startMusic();

      const session = transport.isHost
        ? new HostSession(transport, setups, transport.selfId, seed)
        : new ClientSession(transport, setups, transport.selfId);

      this.scene.start("Game", { character: this.character, session });
    });
  }

  private ensureStartButton(): void {
    if (this.startButton) {
      return;
    }
    this.startButton = new Button(
      this,
      VIEWPORT.width / 2,
      420,
      "Runde starten",
      () => this.lobby?.start(),
      { width: 280 },
    );
  }

  private showError(error: unknown): void {
    const message = error instanceof Error ? error.message : "Verbindung fehlgeschlagen.";
    this.statusText.setText(`${message}\n\nDer Solo-Modus geht immer.`);
    new Button(this, VIEWPORT.width / 2, 400, "Zurück zum Menü", () => this.leave(), {
      width: 280,
    });
  }

  private leave(): void {
    this.lobby?.destroy();
    this.transport?.close();
    this.scene.start("Menu");
  }
}

function playerName(isHost: boolean): string {
  return isHost ? "Host" : `Spieler ${Math.floor(Math.random() * 90) + 10}`;
}
