/**
 * Einstiegspunkt: baut die Phaser-Instanz und startet die erste Szene.
 */

// Zuerst der Auffangschirm fuer Fehler: Er muss haengen, bevor irgendetwas
// anderes schiefgehen kann - sonst faengt er genau den Fehler nicht, der ihn
// selbst verhindert haette.
import { installCrashScreen } from "./platform/crashScreen";

installCrashScreen(__APP_VERSION__);

import Phaser from "phaser";
import { isSupportedDevice } from "./platform/device";
import { showDesktopNotice } from "./platform/DesktopNotice";
// Nur importiert, damit der Empfaenger fuer `beforeinstallprompt` frueh genug
// haengt - das Ereignis kommt einmal und sehr frueh.
import "./platform/install";
import { startUpdateWatch } from "./platform/update";
import { applyTuningFromUrl } from "./config/tuning";
import { lockLandscape } from "./platform/orientation";
import { COLORS, VIEWPORT, fitViewportToScreen } from "./config/constants";
import { BootScene } from "./scenes/BootScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GameScene } from "./scenes/GameScene";
import { HudScene } from "./scenes/HudScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { MenuScene } from "./scenes/MenuScene";

// Entwurfsaufloesung an den Bildschirm anpassen, BEVOR die Konfiguration
// gebaut wird - sonst bleibt es bei 16:9 und das Spiel sitzt in einem
// Briefkasten. Siehe fitViewportToScreen in config/constants.ts.
fitViewportToScreen(window.innerWidth, window.innerHeight);

const config: Phaser.Types.Core.GameConfig = {
  // AUTO nimmt WebGL, wenn das Geraet es kann, sonst Canvas.
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: COLORS.background,
  scale: {
    /*
     * FIT, aber mit einer Aufloesung, die zum Geraet passt.
     *
     * Warum nicht ENVELOP: Der wuerde formatfuellend skalieren und den
     * Ueberstand abschneiden. Genau an den Raendern sitzen hier aber FEUER,
     * SUPER, Punktzahl und Wellenanzeige - abgeschnitten wuerde also die
     * Bedienung.
     *
     * Warum nicht RESIZE: Der gibt jedem Geraet seine eigene Weltansicht. Auf
     * einem breiten Handy saehe man deutlich mehr Arena als auf einem schmalen,
     * und im Koop waere das ein echter Vorteil.
     *
     * FIT auf einer abgeleiteten Aufloesung hat beides nicht: nichts wird
     * abgeschnitten, und der Unterschied zwischen Geraeten ist auf ein Drittel
     * Breite begrenzt.
     */
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
  },
  dom: {
    // Erlaubt echte HTML-Elemente ueber dem Canvas. Gebraucht wird das nur fuer
    // das Raumcode-Feld: Nur ein echtes Eingabefeld oeffnet auf dem Handy die
    // Systemtastatur.
    createContainer: true,
  },
  input: {
    // Tastatur wird nicht gebraucht: Das Spiel laeuft nur auf Touchgeraeten.
    keyboard: false,
    // Drei gleichzeitige Finger: linker Stick, rechter Stick, Super-Knopf.
    // Ohne diese Zeile meldet Phaser nur einen Zeiger, und der zweite Daumen
    // wird stillschweigend ignoriert.
    activePointers: 4,
  },
  render: {
    antialias: true,
    // Verhindert Weisspixel an den Raendern gezeichneter Formen auf manchen Handys.
    roundPixels: false,
  },
  // Die Simulation rechnet selbst mit festem Takt, deshalb braucht Phaser hier
  // keine eigene Physik-Engine (siehe CLAUDE.md, Architektur-Grundregel).
  scene: [BootScene, MenuScene, LobbyScene, GameScene, HudScene, GameOverScene],
};

// Alles, was kein Touchgeraet ist, bekommt die Sperrseite statt des Spiels.
// Wichtig: Phaser wird dann nie gestartet - der Desktop laedt kein Spiel.
// Dem Wächter in index.html melden, dass der Start geklappt hat - sonst
// blendet er nach acht Sekunden seine Fehlermeldung ein.
(window as unknown as { __holdoutBooted: boolean }).__holdoutBooted = true;

// Werte aus `?tune=` setzen, bevor die erste Runde startet. Ohne `?tune=`
// passiert hier nichts.
applyTuningFromUrl();

if (isSupportedDevice()) {
  const game = new Phaser.Game(config);

  // Querformat verlangen, wo das Geraet es zulaesst (Android als App). Wo nicht
  // (iOS), bleibt der Hinweisstreifen aus index.html stehen.
  lockLandscape();

  // Auf Drehung und Groessenaenderung reagieren: Phaser passt den Modus FIT von
  // selbst an die neue Fenstergroesse an, braucht dafuer aber den Anstoss.
  // `refresh` misst neu - ohne das bleibt die alte Zeichenflaechengroesse
  // stehen, und Beruehrungen landen daneben.
  const refit = (): void => {
    game.scale.refresh();
  };
  window.addEventListener("resize", refit);
  window.addEventListener("orientationchange", () => {
    // Nach einer Drehung meldet der Browser die neuen Masse erst ein paar
    // Bilder spaeter. Sofort messen ergaebe die alten Werte.
    window.setTimeout(refit, 120);
    window.setTimeout(refit, 400);
  });
  // Haelt die installierte App von selbst aktuell - niemand soll sie loeschen
  // und neu hinzufuegen muessen. Siehe platform/update.ts.
  startUpdateWatch();
} else {
  void showDesktopNotice();
}
