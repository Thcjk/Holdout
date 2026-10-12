# CLAUDE.md – Projektgedächtnis

Wird bei jedem Start gelesen. Am Ende jeder Sitzung aktualisieren.

## Was das hier ist

**Holdout** (v3.0.0): Brotato-artiger Wellen-Shooter fürs Handy, 2D top-down, solo oder
Online-Koop (1–4). Phaser 3 + TypeScript + Vite, PWA auf GitHub Pages, Android-APK über
Capacitor. Der frühere Koop-Arena-Shooter (v2.5.0, Brawl-Stars-artig, mit 3D) wurde auf dem
Branch `brotato-umbau` komplett ersetzt; sein Stand liegt auf `main` bis zum Merge, seine
Dokumente unter `docs/archiv/` (dort stehen auch viele Lehren zu Safe-Area, Service Worker,
TURN, Pages-Basispfad – bei Problemen dort suchen).

Zielgruppe der Erklärungen: Einsteiger in der Spieleentwicklung. **Antworten, Kommentare
und Texte im Spiel auf Deutsch**, Code lesbar statt clever.

## Stand 2026-10-12

Umbau auf Branch `brotato-umbau` fertig und lauffähig, **noch nicht auf `main`**.

- Spielkern, Shop, 6 Charaktere (Söldner, Raufbold, Jäger, Panzer, Glückspilz, Schatten), 7 Waffen (je 4 Stufen), 24 Gegenstände, 14 Level-Ups,
  7 Gegnertypen, 20 Wellen: fertig, 20 Tests + Bot-Balancemessung.
- Solo, Koop (Host/Client, Lobby, Raumcode) und die ganze Oberfläche: fertig. Im Test-Browser
  durchgespielt: Titel → Charakterwahl → Gefecht → Level-Up → Shop → nächste Welle, und Koop mit
  zwei Tabs (`?debug=lokal`): beide Spieler sichtbar, Bewegung kommt an.
- **Nicht geprüft:** Gefühl der Steuerung und Balance mit echten Menschen, Leistung auf echtem
  Handy, Koop über echtes Internet (PeerJS-Server ist aus der Entwicklungsumgebung gesperrt),
  Ton im Spiel (Zuordnung der Klangnamen ist nur nach Namen gewählt).

## Architektur-Grundregel

**Spielkern (`src/game/`) kennt weder Phaser noch Netz.** Eingaben rein, Zustand raus.

- `Simulation.ts`: fester 60-Hz-Takt (`advance(deltaMs, inputs)`), host-autoritativ.
  Phasen `wave → shop → wave … → won | lost`. Befehle des Shops über `command(playerId, cmd)`.
- Solo = `SoloSession` (lokale Simulation). Koop = `HostSession` (rechnet, schickt `state` mit
  15 Hz als volle Schnappschüsse und `events` sofort) und `ClientSession` (schickt `input` mit
  30 Hz samt allen unbestätigten nummerierten Befehlen; sagt die eigene Bewegung voraus).
  Der Datenkanal ist absichtlich unzuverlässig (`reliable:false`), deshalb Vollzustand statt
  Differenzen; Befehle werden bis zur Bestätigung (`player.lastCmd`) wiederholt.
- `GameSession` ist die einzige Schnittstelle, die `GameScene` kennt.
- Der Lobby-Host wartet nach „Runde starten“ 1,2 s, damit das `start`-Paket bei jedem
  Client ankommt (die Lobby wiederholt es in dieser Zeit).
- Alle Spielwerte stehen in `src/game/data/*.ts`, feste Zahlen in `src/game/constants.ts`.
  **Reihenfolge von `ITEMS` und `UPGRADES` ist Protokoll** (Zähler je Index) – neue nur hinten.

## Oberfläche

- Phaser, `pixelArt`, Skalierung FIT mit Entwurfshöhe 540 und geräteabhängiger Breite
  (`config/constants.ts`), Sicherheitsränder `SAFE`. Die Arena (900×440) sitzt mittig ab y=64.
- Eine Szene pro Bildschirm: Boot, Title, Select, Lobby, Game, Result. Der Shop ist keine Szene,
  sondern `ui/ShopPanel` als undurchsichtige Ebene in `GameScene` (baut nur bei geändertem Zustand neu).
- Steuerung: nur `ui/FloatingStick` (linke ~60 % des Bildschirms). Berührungen, die auf einem
  Knopf landen, starten den Stick nicht.
- Grafik: Kenney Topdown Shooter Pixel (Figuren: Spalten 28–33, Reihen 0–15), UI Pack RPG
  (Atlas, `ui/UiNineSlice`), Blaster-Vorschaubilder als Waffensymbole. Symbole für Gegenstände,
  Nahkampfwaffen, Spawn-Kreuz und Schatten werden in `ui/icons.ts` gezeichnet –
  **nach dem Zeichnen `refresh()` auf der Canvas-Textur**, sonst bleibt sie leer.
- **Comic-Look:** `ui/comic.ts` malt beim Start (BootScene) alle Texturen: `ch-<id>`/`en-<typ>` (Figuren mit
  dicker schwarzer Kontur), `arena` (Steinwand, Sandboden, Rasterpunkte, Risse), `bg-game`, `bullet`, `gem`, `logo`.
  Schlüssel über `config/assets.ts` (`characterKey`, `enemyKey`, `arenaKey`). Gegner wackeln/quetschen sich,
  Comic-Wörter („BAM!“, „KRIT!“) in `GameScene.comic()`. Menühintergrund: `menuStyle.paintBackground`.
- `setReloadSafe(true)` nur im Titel und im Ergebnis (Selbst-Update der PWA nur dort).

## Entwickeln und prüfen

`npm run typecheck && npm run lint && npm test && npm run build`. Balance: `npm run balance`
(Bot spielt alle Charaktere; Zahlen sind Untergrenzen, der Bot nutzt keine Taktik).
Browser-Test in der Entwicklungsumgebung: Playwright (`/opt/npm-tools`), Chromium aus
`/opt/pw-browsers/chromium`, Seite mit `?desktop=1`. Für zwei Tabs im Koop `requestAnimationFrame`
per Init-Skript auf `setTimeout` umbiegen – sonst pausiert der Hintergrund-Tab die Simulation.

Adress-Zusätze: `?desktop`, `?debug=lokal|werte|netz|all`, `?seed=N` (nur solo).

## Offene Punkte / Ideen

- Schwierigkeit 2026-10-12 angezogen (erster Testspieler hat beim ersten Versuch gewonnen): steilere Gegnerskalierung,
  größeres Wellenbudget, Königslarven in Welle 8/12/16 (2×) und 2 beim Boss. Bot-Mittel jetzt ~5–13. Echte Spieltests nötig.
- Kartoffel ist durch den Söldner (3 Waffenplätze, +Schaden/+Tempo) ersetzt.

- Echte Spieltests: Balance (Panzer/Raufbold waren im Bot schwach), Dropmenge, Shop-Preise.
- Nach einem Koop-Run gibt es keine Rückkehr in dieselbe Lobby – zurück ins Menü, neuer Raum.
- Arena ist ein einfarbiger Sandboden ohne Hindernisse; Dekoration, Bildschirm-Treffer-Feedback,
  Musik-Lautstärke-Regeln feinschleifen.
- Kein Speichern von Fortschritt; kein Charakter-Freischalten.
- App-Icons/Favicon (`public/icons`, `favicon.svg`) sind noch im alten Stil – an den Comic-Look anpassen.
- Bundle ~1,6 MB (Phaser komplett).

## Deployment

Push auf `main` → `deploy-pages.yml` (Basispfad aus Repo-Namen, **nie fest eintragen**) →
https://thcjk.github.io/Holdout/. Tag `v*` → Android-APK. Vor Release `versionCode` in
`android/app/build.gradle` hochzählen. Einmalig: Settings → Pages → Source: GitHub Actions.
Vor dem Merge von `brotato-umbau` auf `main`: Solo und Koop einmal auf echtem Handy probieren.
