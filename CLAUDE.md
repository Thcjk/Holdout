# CLAUDE.md – Projektgedächtnis

Wird bei jedem Start gelesen. Am Ende jeder Sitzung aktualisieren.

## Was das hier ist

**Holdout – Die Wanderfestung** (v4.1.0): Eine Mech-Crew flieht auf einer sechsbeinigen
Lauf-Festung durch die Wüste, die goldene Armee eines toten Reichs jagt sie (sie will ihr
Sonnenherz zurück). Kämpfen auf dem Deck oder am Boden, Festung ausbauen, Route wählen.
Fürs Handy, quer, Pixel-Art. Phaser 3 + TypeScript + Vite, PWA auf GitHub Pages, Android über
Capacitor.

Der Nutzer wollte das Spiel **komplett neu** (2026-10-13: „nicht das Vorhandene überarbeiten“).
Das frühere Spiel (Brotato-artiger Wellen-Shooter mit Shop, Helden, Schmiede, Koop) liegt in
der Git-Geschichte, letzter Stand auf dem Zweig `alt-3.9.2` (Commit dd50b6b). Ältere Lehren
(Safe-Area, Service Worker, TURN, Pages-Basispfad) stehen in `docs/archiv/`.

Zielgruppe der Erklärungen: Einsteiger in der Spieleentwicklung. **Antworten, Kommentare und
Texte im Spiel auf Deutsch**, Code lesbar statt clever.

## Konzept und Baustufen

Konzeptseite mit Probebildern wurde vom Nutzer freigegeben („lege los passt so“), inkl. der
Standardantworten auf die offenen Fragen: Akt ~10 min / Lauf ~30 min, bauen nur in der Rast,
Seilwinde kostet Rumpf, Name „Holdout – Die Wanderfestung“. Bleibt aus seinen Wünschen:
Pixel-Art (blaue Mechs = Helden, goldene Armee = Gegner), automatisch schießen, Koop bis 4,
Grinding/Freischalten.

| Baustufe | Inhalt | Stand |
| --- | --- | --- |
| 1 | Laufende Festung, Deck/Boden, Strickleiter, Seilwinde, Sandläufer, Schrott, Rast | **fertig (v4.0.0)** |
| 2 | Module bauen (Raster 7×4, 10 Module, 3 Stufen, Generator-Nachbarbonus, Abbauen = halbe Kosten), zufälliges Angebot je Rast, Trupps von allen Seiten mit Warnpfeil | **fertig (v4.1.0)** |
| 3 | Gegner mit Aufgaben: Enterer (Leitern aufs Deck), Phalanx (Schild vorn), Skarabäus (fliegt aufs Deck), Sandpriester, Streitwagen, Ballista (schießt Module), Belagerungsturm, Goldener Koloss | offen |
| 4 | Routenkarte mit Abzweigungen (Ruine, Oase, Händler, Schrottfeld, Sturm, Ereignis, Boss), Armee rückt nach | offen |
| 5 | Crew: Schrauber (Start), Kanonier, Brecher, Bergungsläuferin, Funkerin, Sturmspringer; Teile Arm/Rücken; Werft mit Altgold, Baupläne, neue Festungen, Hitze-Stufen, Erfolge | offen |
| 6 | Koop (gemeinsame Festung, Schrott gehört allen), Akte 2/3 (Salzebene, Glasschlucht), Ton, Feinschliff | offen |

Jede Baustufe wird einzeln auf `main` hochgeladen. Entwicklungszweig: `wanderfestung`.

## Architektur-Grundregel

**Spielkern (`src/game/`) kennt weder Phaser noch Netz.** Eingaben rein, Zustand raus.

- `Simulation.ts`: fester 60-Hz-Takt (`advance(deltaMs, inputs)`), Phasen `march → rest → march …
  → won | lost`. Befehle der Rast über `command(playerId, {kind: "repair" | "depart"})`; deren
  Ereignisse gehen mit dem nächsten `advance` raus (`pending`).
- Zustand ist reines JSON (später Koop-Schnappschuss). `GameSession` ist die einzige
  Schnittstelle der Szene; bisher nur `SoloSession`. Die Verbindungsschicht (PeerJS, TURN,
  Raumcode, `net/*Transport`) ist erhalten, `net/protocol.ts` ist nur ein Platzhalter.
- **Koordinaten:** Bodenebene x→rechts, y→unten. Festung: `fort.x` = linke Deckkante, `fort.y = 0`,
  Deck-Fußabdruck 280×128 (`DECK_W/H`), Deck liegt `ELEVATION = 72` über dem Boden. Jedes Ding hat
  (x, y, z); gezeichnet bei (x, y − z). Mechs auf dem Deck haben `z = ELEVATION` und wandern mit
  `fort.x` mit. Übergänge (`jump`, `climb`, `winch`) haben Anker, die fest am Boden oder an der
  Festung hängen (`Anchor.onFort`).
- `fortress.ts`: feste Aufbauten (Motor 2×1, Sonnenherz 2×2, Brücke 1×2) als Hindernisse,
  `BLIND_SPOT` (unter dem Deck: vom Deck aus nicht beschießbar), 6 Beine mit Dreiergang
  (`legPhase`, `legPose`, Schrittlänge = Tempo, Füße rutschen nicht), Stampfen beim Aufsetzen,
  Angriffspunkte (`ATTACK_SLOTS`: Füße und Bauch).
- Nutzer 2026-10-13: Gegner sollen **von allen Seiten** kommen, das Spiel soll **trotzdem Roguelike** sein
  (Zufall pro Lauf: Angebot, Trupps, Route; ein Lauf endet mit dem Rumpf).
- Ablauf: Lauf beginnt mit **Rast am „Grab von Aurum“** (`START_STATION`, 60 Startschrott, Bau-Ansicht öffnet
  sich von selbst). Danach Marsch → Rast an der Station (+15 Schrott Fundstücke, neues Angebot) → … → Ziel.
  `state.restAt` = wo gerastet wird, `state.march` = nächste/laufende Etappe.
- **Module** (`data/modules.ts`, `deck.ts`): 10 Stück, je 3 Stufen (Aufrüsten: Grundpreis × Stufe, Abbauen: halbe
  Investition). Angebot je Rast: 4 zufällige verschiedene (`OFFER_SIZE`), jedes einmal kaufbar, „Neu“ kostet
  5 + 3 je Wurf. Waffen (Geschütz, Harpune → zieht unter einen Fuß, Mörser mit Granaten `shells`, Funkenspule
  trifft auch unter dem Deck) feuern selbst; Generator = Nachbarfelder schneller; Ölkessel (nur Rand) brennt
  Zone unter seiner Kante (`Simulation.oilZone`); Magnet hebt Schrott aufs Deck (`scrap.z`); Panzerplatte =
  mehr Rumpf; Motor = `fort.speed` (Gang läuft mit, Füße rutschen nicht); Werkstatt = Rumpf/s. Gebaute
  Module blockieren Mechs nicht (nur die festen Aufbauten).
- **Trupps von allen Seiten** (`spawn`): Seite hinten/vorn/oben/unten (Gewichte `SIDE_WEIGHTS`), 2–8 Gegner,
  vorher `WARNING_TIME` Warnung am Bildrand (`state.warnings`, `WarningView`). Angriffspunkt = einer der vier
  nächsten zur Anmarschseite.
- Regeln Baustufe 1: Gegen Deckkante drücken (0,18 s) → abspringen (hinten Geländer).
  Strickleiter unter dem Bug (`LADDER`) → hochklettern. Mech fällt hinter `BEHIND` zurück →
  Seilwinde, −25 Rumpf. Schrott nur am Boden, bleibt zurück (`SCRAP_LOST_BEHIND`). Rast:
  Reparieren +100 für 25 Schrott. Tod: nach 5 s auf dem Deck wieder da. Verloren nur bei Rumpf 0.
- Werte: `data/crew.ts` (Schrauber: Nietkanone, Notreparatur), `data/enemies.ts` (Sandläufer),
  `data/route.ts` (Probelauf Oase → Ruine → Küste), feste Zahlen in `constants.ts`.
- Balance (Bot baut mit, `npm run balance -- 10 klug|deck`): klug 8/8 geschafft (Rumpf am Ziel ~170–780),
  nur oben bleiben 0/8.

## Darstellung

- Phaser mit `pixelArt: true`, Skalierung FIT, Entwurfshöhe 540, Breite geräteabhängig
  (`config/constants.ts`). **Bildschirmgröße immer über `platform/screenArea.ts`** (iOS-App quer
  meldet sonst zu wenig Höhe).
- **Alle Bilder per Code** (`ui/pixel/`, keine Bilddateien): `pix.ts` (Masken + automatische
  Schattierung), `palette.ts`, `mech.ts` (Mech-Körper, Warnstreifen), `skeleton.ts` (Schädel,
  Helm, Knochen), `crew.ts` (6 Mechs 64×64), `armee.ts` (9 Gegner), `festung.ts` (Rumpf/Deck,
  Beine einzeln `paintLeg`, Module), `wueste.ts` (Boden, `seamless` für Kacheln),
  `textures.ts` (malt beim Start alles als Textur; 16 Bein-Bilder je Seite). 1 Pixel = 1
  Entwurfspixel. Festung in Eisengrau, damit die blauen Mechs auffallen; Boden Rost/Malve,
  damit die goldene Armee leuchtet.
- `ui/world/`: `view.ts` (Kamera folgt der Festung waagerecht, `CAMERA_Y = -222`; Zeichenreihenfolge:
  Boden = y, Beine = y ihres Fußes, Rumpf = 127,7, Deck = 128 + Zeile), `FortressView`
  (Beine im Gang, Herz-Leuchten, Rauch), `GroundView` (kachelnder Boden, Fußabdrücke).
- Verdeckte Figuren unter/hinter dem Deck scheinen als Umriss durch (Mech cyan, Gegner rot).
- Szenen: Boot, Title (Festung läuft, Losziehen, Koop „bald“, Ton), Game, **Build** (Bau-Ansicht über dem
  Spiel: Deck 2×, Raster, Angebot unten, Infotafel rechts; schickt nur Befehle, zeichnet bei Änderung neu;
  solange offen, ruhen Stick, Pause und Rast-Tafel im Spiel), Result.
  `setReloadSafe(true)` nur in Title und Result (PWA-Update nur dort).
- `ui/world/ModuleView` (Module auf dem Deck, Stufen-Punkte, Öl-Lache und Tropfen), `WarningView` (rote Pfeile
  mit Gegnerzahl). Mörser-Granaten, Blitze, Explosionen in `GameScene`.
- UI: `Hud`, `AbilityButton`, `RestPanel` (unten, Deck bleibt frei; Ausbauen/Reparieren/Weiterziehen), `FloatingStick` (linke 62 %),
  `Button`/`ComicBox` (Bronze + Stein + cyan Linie). Schriften Jersey 10 / Pixelify Sans.
- Hinweise für Neulinge erscheinen einmal pro Lauf (Abspringen, Bauch, Schrott, Seilwinde, Tod).

## Entwickeln und prüfen

`npm run typecheck && npm run lint && npm test && npm run build`.
Browser-Test: Playwright (`/opt/npm-tools`), Chromium `/opt/pw-browsers/chromium`, Seite mit
`?desktop=1`. Mit `?debug=werte` liegt der Zustand unter `window.__holdout.state()` (für
gesteuerte Tests), `?debug=kurz` kürzt die Märsche auf ein Zehntel, `?debug=reich` gibt 999 Schrott. `?seed=N`.
App-Icon/Splash: `node tools/generate-brand.mjs` (Schrauber vor Sonnenglanz; Festung + Schriftzug).

## Offene Punkte

- Nicht geprüft: Gefühl auf echtem Handy, Leistung auf echtem Gerät, Ton (Klangnamen nur zugeordnet).
- `@fontsource/fredoka` und `lilita-one` sind noch Abhängigkeiten, werden aber nicht mehr benutzt.
- `palette.ts` hat noch Aliase aus älteren Fassungen.

## Deployment

Push auf `main` → `deploy-pages.yml` (Basispfad aus Repo-Namen, **nie fest eintragen**) →
https://thcjk.github.io/Holdout/. Tag `v*` → Android-APK. Vor Release `versionCode` in
`android/app/build.gradle` hochzählen. Einmalig: Settings → Pages → Source: GitHub Actions.
