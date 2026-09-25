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
import { waitForLandscape, watchOrientation } from "./platform/rotateGate";
import { readSafeArea } from "./platform/safeArea";
import { VIEW_MODE } from "./platform/debugFlags";
import { installNetLogOverlay } from "./platform/netLogOverlay";
import {
  COLORS,
  VIEWPORT,
  designWidthFor,
  fitViewportToScreen,
  setSafeAreaFromScreen,
} from "./config/constants";
import { BootScene } from "./scenes/BootScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GameScene } from "./scenes/GameScene";
import { HudScene } from "./scenes/HudScene";
import { LoadoutScene } from "./scenes/LoadoutScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { MenuScene } from "./scenes/MenuScene";
import { MapScene } from "./scenes/MapScene";
import { ModeScene } from "./scenes/ModeScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { SlotScene } from "./scenes/SlotScene";
import { TitleScene } from "./scenes/TitleScene";

/**
 * Die Phaser-Konfiguration.
 *
 * Bewusst eine Funktion und keine Konstante: `VIEWPORT` steht erst fest,
 * nachdem der Bildschirm gemessen wurde - und gemessen wird erst, wenn das
 * Handy quer liegt. Eine Konstante hier waere schon beim Laden der Datei
 * berechnet, also mit den alten 960x540.
 */
function buildConfig(): Phaser.Types.Core.GameConfig {
  const world3d = VIEW_MODE === "3d";
  return {
    /*
     * In der 3D-Ansicht zeichnet Phaser nur noch Menues, HUD und Knoepfe -
     * durchsichtig UEBER dem Three.js-Canvas (siehe `render/SceneSetup.ts`).
     * Dafuer reicht der Canvas-Renderer, und das hat einen handfesten Grund:
     * Mit WebGL haette die Seite ZWEI WebGL-Kontexte, einen fuer Phaser und
     * einen fuer Three.js. Auf dem Handy ist jeder Kontext Grafikspeicher
     * und Umschaltzeit. So gibt es genau einen, und der gehoert der Welt.
     *
     * In der alten 2D-Ansicht (`?view=2d`) bleibt alles wie vorher: AUTO
     * nimmt WebGL, wenn das Geraet es kann.
     */
    type: world3d ? Phaser.CANVAS : Phaser.AUTO,
    transparent: world3d,
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
    /*
     * Pixel-Art statt weichgezeichneter Formen.
     *
     * `pixelArt` schaltet die Glaettung beim Vergroessern ab. Ohne das wird ein
     * 16 Pixel grosses Sprite, das auf das Dreifache skaliert wird, matschig -
     * der Browser rechnet dann Zwischenfarben aus, und genau die will man bei
     * Pixel-Art nicht.
     *
     * `roundPixels` setzt Sprites auf ganze Pixel statt auf Zwischenpositionen.
     * Ohne das flimmern die Kanten, sobald sich etwas langsam bewegt.
     *
     * Hier stand vorher `antialias: true` und `roundPixels: false`, gegen
     * Weisspixel an den Raendern GEZEICHNETER Formen. Diese Formen sind
     * groesstenteils weg - Figuren und Arena kommen jetzt aus dem Sheet.
     */
    pixelArt: true,
    render: {
      antialias: false,
      roundPixels: true,
    },
    // Die Simulation rechnet selbst mit festem Takt, deshalb braucht Phaser hier
    // keine eigene Physik-Engine (siehe CLAUDE.md, Architektur-Grundregel).
    scene: [
      BootScene,
      TitleScene,
      SlotScene,
      ModeScene,
      SettingsScene,
      MenuScene,
      LoadoutScene,
      LobbyScene,
      MapScene,
      GameScene,
      HudScene,
      GameOverScene,
    ],
  };
}

// Alles, was kein Touchgeraet ist, bekommt die Sperrseite statt des Spiels.
// Wichtig: Phaser wird dann nie gestartet - der Desktop laedt kein Spiel.
// Dem Wächter in index.html melden, dass der Start geklappt hat - sonst
// blendet er nach acht Sekunden seine Fehlermeldung ein.
(window as unknown as { __holdoutBooted: boolean }).__holdoutBooted = true;

// Werte aus `?tune=` setzen, bevor die erste Runde startet. Ohne `?tune=`
// passiert hier nichts.
applyTuningFromUrl();

if (isSupportedDevice()) {
  void startWhenLandscape();
} else {
  void showDesktopNotice();
}

/**
 * Startet das Spiel - aber erst, wenn das Handy quer liegt.
 *
 * Die Reihenfolge ist der ganze Punkt:
 *   1. Auf das Querformat warten (Startbildschirm aus index.html).
 *   2. ERST DANN den Bildschirm messen.
 *   3. ERST DANN Phaser bauen.
 *
 * Wer hochkant startet und danach dreht, hat sonst eine Flaeche im falschen
 * Format - und genau daher kamen die Balken links und rechts.
 */
async function startWhenLandscape(): Promise<void> {
  // Querformat verlangen, wo das Geraet es zulaesst (Android als installierte
  // App). iOS kann das nicht - dort wartet der Startbildschirm.
  lockLandscape();

  await waitForLandscape();

  fitViewportToScreen(window.innerWidth, window.innerHeight);

  // Das Geraet nach seinen verdeckten Raendern fragen (Notch, Home-Indikator,
  // runde Ecken) und in Entwurfseinheiten umrechnen. Reihenfolge zaehlt: Der
  // Umrechnungsfaktor haengt an der Breite, die eine Zeile darueber festgelegt
  // wird.
  setSafeAreaFromScreen(readSafeArea(), window.innerWidth);

  const game = new Phaser.Game(buildConfig());

  // 3D-Modelle schon im Menue laden, nicht erst bei Rundenbeginn: Bis man
  // Charakter und Rucksack gewaehlt hat, sind sie meist da.
  if (VIEW_MODE === "3d") {
    void import("./render/ModelLoader").then(({ preloadGameModels }) => preloadGameModels());
  }

  // Mit ?debug=netz: Protokoll des Koop-Verbindungsaufbaus auf dem Bildschirm.
  // Ohne den Schalter passiert hier nichts.
  installNetLogOverlay();

  // Haelt die installierte App von selbst aktuell - niemand soll sie loeschen
  // und neu hinzufuegen muessen. Siehe platform/update.ts.
  startUpdateWatch();

  // Wird waehrend des Spiels hochkant gehalten, kommt der Startbildschirm
  // zurueck. Das Spiel laeuft dahinter weiter.
  watchOrientation();

  /*
   * Auf Groessenaenderungen reagieren.
   *
   * DER FEHLER, DEN DAS BEHEBT: Die Entwurfsflaeche wurde nur EINMAL beim Start
   * berechnet. Klappt danach die Adressleiste ein, wird das Fenster hoeher -
   * das Seitenverhaeltnis stimmt nicht mehr, und der Modus FIT legt Balken
   * drum. Gemessen im Emulator: Aus 844x390 ohne Rand wurde 844x390 an
   * Position 0,23 - also 23 Pixel schwarz oben.
   *
   * Jetzt wird die Breite neu bestimmt und, wenn sie sich geaendert hat, auch
   * wirklich gesetzt. Danach muessen alle Anzeigen am Bildschirmrand nachruecken -
   * dafuer feuert Phaser `RESIZE`, und die HUD-Szene setzt sich darauf neu.
   */
  const refit = (): void => {
    const width = designWidthFor(window.innerWidth, window.innerHeight);
    if (width !== null && width !== VIEWPORT.width) {
      VIEWPORT.width = width;
      // Sicherheitsabstaende haengen am Umrechnungsfaktor, der sich mit der
      // Breite aendert.
      setSafeAreaFromScreen(readSafeArea(), window.innerWidth);
      game.scale.resize(width, VIEWPORT.height);

      /*
       * Diese Zeile sieht ueberfluessig aus und ist der eigentliche Kern.
       *
       * `resize` setzt zwar die Zeichenflaeche um, aber NICHT das
       * Seitenverhaeltnis, mit dem FIT sie danach in den Bildschirm einpasst.
       * Phaser merkt sich dieses Verhaeltnis getrennt und behaelt es bei jeder
       * Umstellung bei - im Quelltext steht daneben sogar "which doesn't then
       * change". Gemessen: Canvas 1169x540 -> 1085x540 umgestellt, angezeigt
       * aber weiterhin 844x390, also im alten Verhaeltnis 1169:540. Genau die
       * Differenz waren die 23 schwarzen Pixel oben.
       */
      game.scale.displaySize.setAspectRatio(width / VIEWPORT.height);
      game.scale.refresh();
      return;
    }
    /*
     * Sicherheitsabstaende IMMER neu messen, nicht nur bei neuer Breite.
     *
     * DER FEHLER, DEN DAS BEHEBT: Auf dem iPhone kam der Packbildschirm mit
     * einem oberen Rand von rund 43 Pixeln - im Querformat hat ein iPhone
     * dort nichts. Das waren die Werte vom HOCHFORMAT: iOS liefert die neuen
     * `env(safe-area-inset-*)` nach einer Drehung erst etwas spaeter, und
     * gemessen wurde nur einmal beim Start. Mit dem falschen Rand passten
     * die Gitter nicht mehr in die Hoehe, und "Run starten" lag verdeckt
     * darunter - das Spiel liess sich nicht starten.
     *
     * `refresh` meldet danach `RESIZE`; das HUD setzt sich darauf neu.
     */
    setSafeAreaFromScreen(readSafeArea(), window.innerWidth);
    game.scale.refresh();
  };

  /*
   * Die HTML-Ebene (Raumcode-Feld) deckungsgleich aufs Canvas legen.
   *
   * DER FEHLER, DEN DAS BEHEBT: Das Raumcode-Feld in der Lobby sass eine
   * Spalte zu weit links und rund 150 Einheiten zu hoch. Phaser legt die
   * HTML-Ebene in voller Entwurfsgroesse (z. B. 1184 x 540) an und
   * verkleinert sie von der linken oberen Ecke aus - in der Annahme, sie
   * beginne dort, wo das Canvas beginnt. `#game-root` zentriert seine Kinder
   * aber (`place-items: center`); die grosse Ebene begann deshalb weit
   * links oberhalb des Bildschirms, und nach dem Verkleinern fehlte genau
   * dieser Versatz. Gemessen: Ebene bei -217,-99 statt 0,0.
   *
   * Jetzt wird sie nach jeder Groessenaenderung an die linke obere Ecke des
   * Canvas gesetzt. Phaser meldet `RESIZE`, nachdem es selbst fertig ist.
   */
  const alignDomLayer = (): void => {
    const layer = game.domContainer;
    const parent = layer?.parentElement;
    if (!layer || !parent) {
      return;
    }
    const canvas = game.canvas.getBoundingClientRect();
    const frame = parent.getBoundingClientRect();
    layer.style.margin = "0";
    layer.style.left = `${canvas.left - frame.left}px`;
    layer.style.top = `${canvas.top - frame.top}px`;
  };
  game.scale.on(Phaser.Scale.Events.RESIZE, alignDomLayer);
  game.events.once(Phaser.Core.Events.READY, alignDomLayer);

  // Nach dem Start noch zweimal nachmessen - fuer den Fall, dass die
  // Abstaende beim Start noch vom Hochformat stammten.
  window.setTimeout(refit, 500);
  window.setTimeout(refit, 1500);

  window.addEventListener("resize", refit);
  window.addEventListener("orientationchange", () => {
    // Nach einer Drehung meldet der Browser die neuen Masse erst ein paar
    // Bilder spaeter. Sofort messen ergaebe die alten Werte.
    window.setTimeout(refit, 120);
    window.setTimeout(refit, 400);
  });
}
