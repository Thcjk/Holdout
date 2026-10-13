# CLAUDE.md – Projektgedächtnis

Wird bei jedem Start gelesen. Am Ende jeder Sitzung aktualisieren.

## Was das hier ist

**Holdout** (v3.9.0): Brotato-artiger Wellen-Shooter fürs Handy, 2D top-down, solo oder
Online-Koop (1–4). Phaser 3 + TypeScript + Vite, PWA auf GitHub Pages, Android-APK über
Capacitor. Der frühere Koop-Arena-Shooter (v2.5.0, Brawl-Stars-artig, mit 3D) wurde auf dem
Branch `brotato-umbau` komplett ersetzt; sein Stand liegt auf `main` bis zum Merge, seine
Dokumente unter `docs/archiv/` (dort stehen auch viele Lehren zu Safe-Area, Service Worker,
TURN, Pages-Basispfad – bei Problemen dort suchen).

Zielgruppe der Erklärungen: Einsteiger in der Spieleentwicklung. **Antworten, Kommentare
und Texte im Spiel auf Deutsch**, Code lesbar statt clever.

## Stand 2026-10-13

Umbau fertig und per Pull Request #6 auf `main` gemergt (2026-10-12).

- Spielkern, Shop, 6 Helden (Ritter, Feuermagierin, Schurke, Elfe, Zwerg, Zauberer) mit je einer aktiven
  Fähigkeit, 14 Waffen (je 4 Stufen), 27 Gegenstände, 15 Level-Ups, 9 Gegnertypen, 20 Wellen: fertig,
  57 Tests + Bot-Balancemessung.
- **Fortschritt (v3.9.0, Nutzerwunsch „Grinding, Upgrades erarbeiten, Erfolge“):** siehe Abschnitt unten.
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
  Ebenso `ENEMY_TYPES` in `net/protocol.ts`.
- **Waffen-Effekte** (`data/weapons.ts`, optionale Felder): `explode` (Radius), `burn` (Brand, 3 s), `chain`
  (Blitz springt, je Stufe +1), `slow`, `stun`, `look` (Geschossbild `shot-<n>`). Gerechnet in
  `Simulation.shotHits` / `explode` / `chainLightning`. Gegner haben dafür `burn`, `slow`, `stun`; übers Netz als Bits.
- **Fähigkeiten** (`data/abilities.ts`, `Simulation.useAbility`): eine je Held, ausgelöst über einen Zähler in
  `PlayerInput.ability` (steigt mit jedem Knopfdruck; nur ein höherer Wert als `player.abilityAck` löst aus –
  so zündet ein doppelt angekommenes Netzpaket nicht zweimal). `player.abilityCd`, `player.buff` (Schildwall,
  Arkaner Sog, Schattenschritt). Wert „Fähigkeit-Tempo“ (`stats.ability`) verkürzt die Abklingzeit.
  Knopf: `ui/AbilityButton.ts` (rechts unten). Effekte: `GameScene.abilityEffect`, `boom`, `zap`.
- **IDs ≠ Namen.** Interne IDs blieben beim Umbenennen stabil (Protokoll, Tests):
  Helden `ritter, magierin, schurke, elfe, zwerg, zauberer`. Gegner: `grunt` Goblin, `swarmer` Fledermaus,
  `charger` Teufelchen, `spitter` Schleim, `bruiser` Oger, `elite` Skelettritter, `boss` Lich, `exploder`
  Bombenkobold (bleibt stehen und explodiert), `splitter` Mumie (zerfällt in 3 Wuselchen). Waffen: `pistol`
  Kurzbogen, `smg` Wurfdolche, `shotgun` Funkenfächer, `sniper` Langbogen, `fist` Axt, `knife` Dolch, `spear`
  Langschwert, `crossbow` Armbrust, `rocket` Feuerkugel, `flamer` Flammenstab, `wand` Blitzstab, `hammer`
  Kriegshammer, `frost` Froststab. Elite schießt zusätzlich Fächer, Boss wechselt Ring/Fächer und ruft Bombenkobolde.

## Fortschritt über Läufe (`src/meta/`)

- `profile.ts`: Spielstand in `localStorage` (`holdout.profile`, jeder Zugriff in try/catch; `parseProfile`
  repariert alte/kaputte Stände). Kristalle, Schmiede-Stufen, freie Helden, Erfolge, Summen, Bestwerte, `lastHero`.
- `forge.ts`: **Schmiede** – 12 Dauer-Verbesserungen (Werte-Boni + „Kriegskasse“ = Startgold), Preis je Stufe
  `baseCost·growth^Stufe`, gesamt ~3700 Kristalle. `forgeBonus(levels)` → `{mods, startGold}`.
- `goals.ts`: `crystalsForRun` (geschaffte Wellen `3w + w²/3`, Monster/20, Sieg +60), `HERO_UNLOCKS`
  (nur Ritter frei; Elfe Welle 5, Zwerg 600 Monster, Magierin Welle 8, Schurke 3000 Gold, Zauberer Welle 12),
  20 `ACHIEVEMENTS` mit Kristall-Belohnung, `applyRun`, `buyForge`, `settle` (prüft Freischaltungen + Erfolge), `startBonus`.
- Boni sind Teil des Spielers: `PlayerSetup.bonus/startGold` → `PlayerState.bonus` → `computeStats(…, bonus)`.
  Im Koop bringt jeder seine eigenen mit (Lobby `hello`/`NetPlayerInfo`), übers Netz als `WirePlayer.bn`;
  `PlayerState.earned` (gesammeltes Gold) als `ge`.
- `GameScene.finish` trägt den Lauf ein (auch beim Aufgeben ab Welle 2), `ResultScene` zeigt Kristalle,
  neue Erfolge und Helden. Szenen `Forge` (Schmiede) und `Achievements` (Erfolge), Knöpfe im Titel, Kristalle oben rechts.
  Gesperrte Helden: Silhouette + Schloss in Titel und Auswahl.
- Ritter = Starter: 6 Plätze, Start mit Langschwert, Doppelschwert (`twin`, neu), Axt oder Kurzbogen.
- Balance (2026-10-13, Nutzer „noch schwerer“): Leben `1+0.2w+0.1w²`, Schaden +22 %/Welle, Budget `8+6·Welle`,
  Skelettritter in 8/10 (1), 12/14/16 (2), 18 (3), Lich 2600 Leben. Bot: leere Schmiede Mittel ~8–10, kein Sieg;
  halbe Schmiede oft Welle 20; volle Schmiede gewinnt meist. `npm run balance -- 5 [leer|halb|voll]`.

## Oberfläche

- Phaser, `pixelArt`, Skalierung FIT mit Entwurfshöhe 540 und geräteabhängiger Breite
  (`config/constants.ts`), Sicherheitsränder `SAFE`. Die Arena (900×440) sitzt mittig ab y=64.
- Eine Szene pro Bildschirm: Boot, Title, Select, Lobby, Game, Result. Der Shop ist keine Szene,
  sondern `ui/ShopPanel` als undurchsichtige Ebene in `GameScene` (baut nur bei geändertem Zustand neu).
- Steuerung: nur `ui/FloatingStick` (linke ~60 % des Bildschirms). Berührungen, die auf einem
  Knopf landen, starten den Stick nicht.
- Grafik: Figuren, Gegner, Waffen und Oberfläche sind selbst gezeichnet (Kenney-Pixelfiguren, Blaster-Bilder und UI-Pack-Holztafeln
  werden nicht mehr angezeigt; `UiNineSlice` und `CHARACTER_TILES` sind Altlast). Symbole für Gegenstände,
  Spawn-Kreuz und Schatten werden in `ui/icons.ts` gezeichnet –
  **nach dem Zeichnen `refresh()` auf der Canvas-Textur**, sonst bleibt sie leer.
- **Look: Chibi-Fantasy, gemalt** (Vorlage: zwei Pinterest-Bögen des Nutzers mit Chibi-Helden und -Monstern auf
  Schieferblau, 2026-10-13: „so gezeichnet wie die Bilder“). Welt: „Die Feste Holdout“, Burg im Grauland bei Nacht.
  Verworfen: Bonbon-Comic, Graphic-Novel, Märchenbuch, Poster auf Papier.
  Kennzeichen: großer Kopf, große Augen mit Glanzpunkt (Monster: weiße Augen ohne Pupille, oben schräg), offene
  Münder mit Zähnen, dunkelbraune Kontur `#2a201b`, eine Schattenstufe unten rechts, feines Korn, gedeckte Farben.
  Schriften (`ui/paper.ts`): `FONT_TITLE` Lilita One, `FONT_HAND` Fredoka (500/700), per `@fontsource`;
  BootScene wartet mit `waitForFonts()`. Phaser mit `pixelArt: false`, Antialiasing an.
  - `ui/figures/kit.ts`: Zeichenkasten (SVG-Pfadtext `P("M …")`, `part` = Fläche mit Schatten/Licht/Kontur,
    `tube` = Arm/Bein, `eyes`, `mouth`, `fist`, `claw`, `boot`, `belt`, `grainOver`). 100er-Raster, Füße bei y=96.
  - `ui/figures/heroes.ts`, `ui/figures/monsters.ts`: die Figuren. `ui/comicFigures.ts` malt sie auf 208-px-Texturen
    (`inkify` = gleichmäßiger Außenumriss). `figureScale(s)`: s=1 → Figur ~78 px. Spieler im Spiel 0.8, Gegner `radius/15`.
    `renderHero` / `renderMonster` für Icon und Splash.
  - `ui/comicWeapons.ts`: Waffen mit demselben Kit. `ui/icons.ts`: Gegenstände (Goldmedaillon mit Bild je Hauptwert).
  - `ui/arena.ts`: Burghof (Steinplatten, Moos, Gras, Pfützen, Platz mit Wappen, Burgmauer mit Tor, Bannern,
    Fackeln, Mauerkronen mit Efeu, Brüstung mit Fässern). `ARENA_WALL` = 44.
  - `ui/landscape.ts`: Menü-Landschaft (Nacht, Mond, Wolken, Berge, Wald, Burg auf Hügel, Wiese, Glühwürmchen),
    gemalt in 1,5-facher Auflösung. `ui/logo.ts`: Wappenschild mit Krone, Schwert+Stab, Gold-Schriftzug, rotes Band.
  - `ui/ComicBox.ts`: `BOX.panel` (Holzrahmen + Pergament), `inset`, `primary` (Gold), `secondary` (Schieferblau).
  - HUD (`ui/Hud.ts`): Holztafeln, Herz, Balken. Kein Lebensbalken über der Spielfigur (Nutzerwunsch);
    Waffen schweben neben der Figur und zeigen in Schussrichtung (`GameScene.applyPlayer`).
- `setReloadSafe(true)` nur im Titel und im Ergebnis (Selbst-Update der PWA nur dort).

## Entwickeln und prüfen

`npm run typecheck && npm run lint && npm test && npm run build`. Balance: `npm run balance`
(Bot spielt alle Charaktere; Zahlen sind Untergrenzen, der Bot nutzt keine Taktik).
Browser-Test in der Entwicklungsumgebung: Playwright (`/opt/npm-tools`), Chromium aus
`/opt/pw-browsers/chromium`, Seite mit `?desktop=1`. Für zwei Tabs im Koop `requestAnimationFrame`
per Init-Skript auf `setTimeout` umbiegen – sonst pausiert der Hintergrund-Tab die Simulation.

Adress-Zusätze: `?desktop`, `?debug=lokal|werte|netz|all`, `?seed=N` (nur solo).

## Offene Punkte / Ideen

- Echte Spieltests: Balance (Ritter/Zwerg waren im Bot schwach), Dropmenge, Shop-Preise.
- Nach einem Koop-Run gibt es keine Rückkehr in dieselbe Lobby – zurück ins Menü, neuer Raum.
- Arena hat keine Hindernisse (nur Dekoration); Bildschirm-Treffer-Feedback, Musik-Lautstärke feinschleifen.
- `noir.ts`-Namen (`blood`, `bone` …) und `paper.ts` (`wobblyRect`, `PAPER`) stammen aus älteren Fassungen.
- Fortschritt liegt nur im Browser/der App des Geräts (kein Konto, keine Übertragung zwischen Geräten).
- App-Icon, Favicon und Android-Splash kommen aus `node tools/generate-brand.mjs` (zeichnet mit denselben Funktionen wie
  das Spiel; Playwright aus `/opt/npm-tools`). Danach `npm run build` und für Android neu bauen. Icon = Ritter vor Nachthimmel,
  Splash = Landschaft + Logo + alle Helden. Farben: Schiefer `#3f4d63` (Theme, Manifest, Android), Gold `#f0b23e`, Kontur `#2a201b`.
- Bundle ~1,6 MB (Phaser komplett).

## Deployment

Push auf `main` → `deploy-pages.yml` (Basispfad aus Repo-Namen, **nie fest eintragen**) →
https://thcjk.github.io/Holdout/. Tag `v*` → Android-APK. Vor Release `versionCode` in
`android/app/build.gradle` hochzählen. Einmalig: Settings → Pages → Source: GitHub Actions.
