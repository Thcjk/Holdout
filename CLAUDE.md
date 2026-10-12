# CLAUDE.md – Projektgedächtnis

Wird bei jedem Start gelesen. Am Ende jeder Sitzung aktualisieren.

## Was das hier ist

**Holdout** (v3.7.0): Brotato-artiger Wellen-Shooter fürs Handy, 2D top-down, solo oder
Online-Koop (1–4). Phaser 3 + TypeScript + Vite, PWA auf GitHub Pages, Android-APK über
Capacitor. Der frühere Koop-Arena-Shooter (v2.5.0, Brawl-Stars-artig, mit 3D) wurde auf dem
Branch `brotato-umbau` komplett ersetzt; sein Stand liegt auf `main` bis zum Merge, seine
Dokumente unter `docs/archiv/` (dort stehen auch viele Lehren zu Safe-Area, Service Worker,
TURN, Pages-Basispfad – bei Problemen dort suchen).

Zielgruppe der Erklärungen: Einsteiger in der Spieleentwicklung. **Antworten, Kommentare
und Texte im Spiel auf Deutsch**, Code lesbar statt clever.

## Stand 2026-10-12

Umbau fertig und per Pull Request #6 auf `main` gemergt (2026-10-12).

- Spielkern, Shop, 6 Charaktere (Söldner, Raufbold, Jäger, Panzer, Glückspilz, Schatten) mit je einer aktiven
  Fähigkeit, 13 Waffen (je 4 Stufen), 27 Gegenstände, 15 Level-Ups, 9 Gegnertypen, 20 Wellen: fertig,
  50 Tests + Bot-Balancemessung.
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
  so zündet ein doppelt angekommenes Netzpaket nicht zweimal). `player.abilityCd`, `player.buff` (Bollwerk,
  Glückssträhne, Schattenschritt). Wert „Fähigkeit-Tempo“ (`stats.ability`) verkürzt die Abklingzeit.
  Knopf: `ui/AbilityButton.ts` (rechts unten). Effekte: `GameScene.abilityEffect`, `boom`, `zap`.
- **Neue Gegner:** Zünder (`exploder`, bleibt neben dem Spieler stehen und explodiert), Teiler (`splitter`,
  zerfällt in 3 Wuselchen). Elite schießt zusätzlich Fächer, Boss wechselt Ring/Fächer und ruft Zünder.

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
- **Look: Poster auf Papier** (Vorbild: Pinterest-Bild „Out of Line“ vom Nutzer). Verworfen: Bonbon-Comic,
  düsterer Graphic-Novel, Märchenbuch nur als Umfärbung („sieht aus wie vorher, nur andere Farben“).
  Kennzeichen: Creme-Papier mit Korn überall, Tusche-Linien, die leicht wackeln, zwei Handschriften
  (`ui/paper.ts`: `FONT_TITLE` Londrina Solid, `FONT_HAND` Patrick Hand SC, per `@fontsource` mitgebaut;
  BootScene wartet mit `waitForFonts()` vor dem Malen). Phaser läuft deshalb mit `pixelArt: false`, Antialiasing an.
  - `ui/paper.ts`: Farben, `wobblyRect` (zittriges Rechteck für Graphics), `grain`, `inkLine`.
  - `ui/ComicBox.ts`: Papierblatt / Einlage / Rost-Stempel / Papierschild mit doppeltem Tuscherand (`BOX.*`).
    Alle Texte dunkel (`UI.text`), keine Konturen.
  - `ui/comicFigures.ts`: Helden (Wanderer mit Kapuze, Schal, einem großen Auge) und Gegner (Schattenwesen)
    werden im 78er-Raster gezeichnet, auf 136 px Leinwand gemalt und mit `inkify` „gedruckt“ (Korn,
    Schraffur, ungleicher Tusche-Umriss). Szenen rechnen Maßstäbe mit `figureScale(alterWert)` um.
    `renderHero(id, size)` malt einen Helden groß (für das App-Icon).
  - `ui/comicWeapons.ts` (Waffen, ebenfalls `inkify`), `ui/icons.ts` (Gegenstände: Papier-Medaillon mit
    Tusche-Bild je Hauptwert – Schwert, Schild, Herz, Blitz, Kleeblatt …).
  - `ui/comic.ts`: Arena als gemalte Lichtung mit welligem Tuscherand, Pfad, Steinkreis, Bäumen ringsum
    (`ARENA_WALL` = 44, so weit ragt das Bild über die Spielfläche), Papier-Hintergrund, Logo, Herz, Klippe.
  - `menuStyle.paintBackground`: Plakat-Landschaft (Bergschichten, dunkler Berg mit Burg und Dornenring, Tannen).
  - TitleScene ist als Plakat gebaut: Schriftzug und Satz links, Held auf Klippe Mitte, Band mit Stichworten unten.
  - HUD (`ui/Hud.ts`): Papierschilder, Herz, Balken mit Tuscherand. Kein Lebensbalken über der Spielfigur (Nutzerwunsch);
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

- Schwierigkeit 2026-10-12 zweimal angezogen (Nutzer: „darf schwerer werden“): Leben `1+0.2w+0.055w²`, Schaden
  +14 %/Welle, Budget `7+5.2·Welle`, Königslarven in 8/12/14/16/18 (ab 16 doppelt), Boss 1400 Leben.
  Bot (mit Fähigkeit): Mittel ~5–14, Söldner erreicht oft Welle 20, scheitert meist am Boss. Panzer im Bot weiterhin schwach.
- Kartoffel ist durch den Söldner (3 Waffenplätze, +Schaden/+Tempo) ersetzt.

- Echte Spieltests: Balance (Panzer/Raufbold waren im Bot schwach), Dropmenge, Shop-Preise.
- Nach einem Koop-Run gibt es keine Rückkehr in dieselbe Lobby – zurück ins Menü, neuer Raum.
- Arena hat keine Hindernisse (nur Dekoration); Bildschirm-Treffer-Feedback, Musik-Lautstärke feinschleifen.
- `noir.ts`-Namen (`blood`, `bone` …) stammen aus der düsteren Fassung, Werte sind die Plakatfarben.
- Kein Speichern von Fortschritt; kein Charakter-Freischalten.
- App-Icon, Favicon und Android-Splash kommen aus `node tools/generate-brand.mjs` (zeichnet mit denselben Funktionen wie
  das Spiel; Playwright aus `/opt/npm-tools`). Danach `npm run build` und für Android neu bauen. Icon = Söldner-Gesicht auf Papier. Farben: Papier `#f1e5c9`, Tinte `#1d1c19`, Rost `#b5532f`.
- Bundle ~1,6 MB (Phaser komplett).

## Deployment

Push auf `main` → `deploy-pages.yml` (Basispfad aus Repo-Namen, **nie fest eintragen**) →
https://thcjk.github.io/Holdout/. Tag `v*` → Android-APK. Vor Release `versionCode` in
`android/app/build.gradle` hochzählen. Einmalig: Settings → Pages → Source: GitHub Actions.
Vor dem Merge von `brotato-umbau` auf `main`: Solo und Koop einmal auf echtem Handy probieren.
