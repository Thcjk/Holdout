# AUDIT.md – Bestandsaufnahme vor der grossen Überarbeitung

**Erstellt:** 2026-09-23 21:17 UTC, auf Stand `54875ac`
**Methode:** Jede Zeile im tatsächlichen Code geprüft – Datei geöffnet, Aufrufstelle
gesucht, Aufrufkette bis zur laufenden Szene verfolgt. Nicht aus CLAUDE.md
übernommen. Zusätzlich ein Durchlauf im Browser-Emulator (iPhone 13 quer):
Menü → Rucksack packen → Run starten, ohne Seitenfehler.

Bewertungen:
**✅ vorhanden & funktioniert** ·
**⚠️ vorhanden, aber nicht eingebunden oder fehlerhaft** ·
**❌ fehlt komplett**

Diese Datei wird nach jeder Etappe um einen Nachtrag ergänzt (ganz unten).

---

## Die Checkliste

### 1. Deterministische, geseedete Weltgenerierung, offene Welt – ✅

`src/systems/WorldGenerator.ts` (`generateWorld`) wird von `createWorld`
(`world.ts:99`) aufgerufen, das wiederum von `Simulation` (Solo und Host) und
von `ClientView` (Koop-Client). `GameScene` zeichnet `session.view.state`.
Zufall ausschliesslich über Mulberry32 (`systems/rng.ts`), kein `Math.random()`
in der Generierung. Gleicher Seed → gleiche Welt ist getestet
(`tests/systems/worldGenerator.test.ts`), dazu eine Flutfüllung: 100 % der
begehbaren Fläche erreichbar, mit Gegenprobe (ein zugemauertes Haus wird als
unerreichbar erkannt).

*Abweichung von den Namen im Arbeitsdokument:* Das Ergebnis heisst
`spawnPoint` statt `startPoint`, Encounter und Ende-Boss stehen gemeinsam in
`encounters` (Ende-Boss mit `isFinal`). Inhaltlich gleichwertig, bleibt wie
es ist (Regel: Funktionierendes nicht neu bauen).

### 2. Organische Gegnerdichte nach Distanz, keine Wellen – ✅

`systems/spawning.ts` mit `zones.ts`: `targetPopulation(zone, spielerzahl)` =
`(4 + 2,5 · Zone) · (0,6 + 0,4 · Spielerzahl)`, Leben ×1,08 und Schaden ×1,04
je Zone. Keine Wellenlogik mehr im Code (`waves.ts` gelöscht, nur Kommentare
erwähnen sie noch).

### 3. Encounter-Punkte mit Mini-Bossen – ✅

`systems/encounters.ts`, aufgerufen in `world.ts:209` (`stepEncounters`). Boss
entsteht erst beim Betreten des Rings, zwei Angriffsmuster in `boss.ts`
(Schockwelle mit Vorwarnung, Salve). Getestet.

*Falscher Kommentar gefunden:* `encounters.ts` behauptet, die Darstellung
zeichne vor dem Aufwachen „Ring und Sprite“. Es wird nur der Ring gezeichnet.

### 4. Ende-Boss – ✅

Eigener Encounter-Punkt mit `isFinal`, auf dem äussersten Ring, fünffaches
Leben, Sieg beendet den Run mit `bossDefeated`.

### 5. Extraktionspunkte mit Countdown, sichtbar markiert – ⚠️

Mechanik vorhanden (`stepExtraction`, 5 s, bricht beim Verlassen ab), Kompass
und Entdecken vorhanden. **Drei Abweichungen vom Dokument:**

1. **Wer in der Zone stehen muss.** Der Code verlangt ALLE Spieler, auch die am
   Boden liegenden (`encounters.ts`, `zoneWithWholeTeam`). Das Dokument – und
   schon der Phase-9-Auftrag – sagen „alle LEBENDEN“. Das war eine
   eigenmächtige Abweichung meinerseits.
2. **Kompass** sitzt auf einer Ellipse innerhalb des Bildes, nicht am
   Bildschirmrand (verschoben, weil er am Rand den Ton-Knopf überdeckte).
3. **Bodenmarker** ist aus Farbflächen (`fillCircle`) statt aus Tiles.

### 6. Neue Welt / neuer Seed nach jedem Run-Ende – ⚠️

Solo: ja – `SoloSession` zieht bei jedem Anlegen einen neuen Seed, gemessen
ergaben fünf Runs fünf verschiedene Welten. **Aber:**
- „Neuer Run“ springt direkt ins Spiel und **überspringt den
  Loadout-Bildschirm** (`GameOverScene.restart`).
- **Koop:** Die Verbindung überlebt den Run nicht. `GameScene` räumt beim
  Verlassen die Sitzung ab, `HostSession.destroy()` schickt `bye` und schliesst
  den Transport. „Host zieht neuen Seed und verteilt ihn“ findet damit nicht
  statt – alle brauchen einen neuen Raumcode.

### 7. Gebäude/Strukturen – ⚠️

Gebaut und gezeichnet (`placeBuilding` im Generator, `drawBuildingFloors` und
eigenes Wandmaterial im `ArenaRenderer`). Innenboden `tile(4,3)`, Wände
`tile(8,0)`. **Nicht dokumentgerecht:** Die Wände sind eine einzige
wiederholte Steintextur **ohne Eck- und Endstücke**, und die Wandstärke (36 px)
passt nicht auf das 48-px-Kachelraster.

### 8. Kamera-Zoom angepasst – ✅ (Massstab noch nicht gemessen)

`CAMERA.maxZoom` 1,0 → 0,8, `minZoom` 0,62 → 0,55. Gegen den Richtwert „Figur
5–7 % der Bildhöhe“ ist noch **nicht gemessen** – rechnerisch: Sprite 48 px ×
0,8 = 38 von 540 Einheiten = 7,1 %.

### 9. Minimap, über Button erreichbar – ⚠️

`src/ui/Minimap.ts` existiert, ist in `HudScene` eingebunden (Knopf „Karte“,
`update` je Bild), pausiert nicht. **Weicht vom Dokument ab:** sitzt links oben,
250 × 250, nur per Knopf sichtbar. Das Dokument will sie **rechts oben unter
der Punkteanzeige, 120 × 120, immer sichtbar**, mit Toggle zu einer grösseren
Ansicht.

### 10. Loot-Drop-System von Gegnern – ⚠️

`killEnemy` (`combat.ts:197`) → `dropFromEnemy` (`loot.ts`), Bosse garantiert,
Bodenfunde werden gezeichnet und aufgesammelt. **Abweichungen:**
Drop-Chancen 8 / 28 / 16 % statt Dokument 15 / 30 / 20 %; Bodenfunde sind
**gezeichnete Rechtecke**, keine Sprites.

### 11. Item-Datenmodell mit Grösse/Form – ✅

`src/config/items.ts`: `id`, `name`, `type`, `size {width, height}`, `rarity`.
Zwölf Gegenstände.

### 12. Gitter-Inventar (Datenlogik UND Drag & Drop) – ⚠️

- Datenlogik `systems/InventoryGridSystem.ts`: vorhanden, 18 Tests, **seit
  `54875ac` auch im Run eingebunden** (Aufsammeln über `findFreeSpot`,
  „Rucksack voll“-Ereignis, Gegenstand bleibt liegen).
- Drag & Drop `ui/InventoryGrid.ts`: vorhanden, im Emulator geprüft (grün/rot,
  Tippen dreht, DREHEN-Knopf beim Halten).
- **Fehlt:** Rucksack **während des Runs** öffnen und umsortieren.
- **Abweichend:** Grösse 8 × 4 statt Dokument 8 × 6; Zellenfarben beim Ziehen
  sind Farbflächen (vom Dokument ausdrücklich so verlangt: „grün/rot
  eingefärbt“).

### 13. Pre-Run-Loadout-Bildschirm – ⚠️

`scenes/LoadoutScene.ts`, erreichbar aus dem Menü, gibt den Rucksack seit
`54875ac` wirklich in den Run weiter (im Emulator: „Beute 4“). **Weicht ab:**
Das Starter-Set liegt schon im Rucksack, statt „Starter-Set links, leerer
Rucksack rechts“. Nach Erfolg gesicherte Gegenstände werden nicht angeboten.
Das Starter-Set ist nicht als geschützt markiert.

### 14. Tank-Heilung (ersetzt Schildwand vollständig) – ❌

Die Schildwand ist schon lange weg (kein Code mehr). Ersetzt wurde sie durch
„Zweite Luft“: **Selbstheilung** um 1000 sofort, 12 s Abklingzeit
(`ABILITIES.tank`). Eine **Team-Flächenheilung** (Radius 220, 80/s, 3 s) wie im
Dokument gibt es nicht.

### 15. Sniper-Aufklärungsschuss (ersetzt Zielscheinwerfer) – ❌

Der Sniper-Super ist weiterhin der Zielscheinwerfer (`supers.ts:135`: markiert
ein Ziel 5 s für doppelten Schaden). Kein Aufklärungsschuss.

### 16. Auto-Aim-Reichweite/Zielkegel reduziert – ❌

Nicht reduziert. Wert: **Waffenreichweite × 1,15** (`combat.ts:72`, für den
Zielhinweis gespiegelt in `GameScene.ts:576`). **Einen Zielkegel gibt es
nicht**, nur die Reichweite. Ohne Ziel wird in Blickrichtung gefeuert.

### 17. Alle sichtbaren Flächen aus echten Tiles – ⚠️

Aus Tiles: Boden, Aussenmauer, Deckung, Gebäudeböden und -wände, Buschfelder.

Gezeichnet (`fillRect`/`fillCircle`/`fillRoundedRect`/`fillPath` und
`add.rectangle`/`add.circle`), Anzahl Aufrufe je Datei:

| Datei | Aufrufe | Was |
| --- | --- | --- |
| `scenes/HudScene.ts` | 8 | Lebens-/Superbalken, Pausen-Hintergrund, Kompass |
| `ui/Minimap.ts` | 6 | Kartenpunkte und Rahmen |
| `ui/InventoryGrid.ts` | 5 | Zellen, Gegenstände, Zielmarkierung |
| `render/EntityRenderer.ts` | 4 | Bodenfunde, Lebensbalken über Figuren |
| `assets/textures.ts` | 4 | erzeugte Texturen für Projektile/Funken |
| `ui/TouchControls.ts` | 3 | FEUER/Fähigkeit/SUPER-Knöpfe |
| `render/ArenaRenderer.ts` | 3 | **Encounter-Ring-Füllung, Ausstiegsmarker** |
| `ui/VirtualJoystick.ts` | 2 | Joystick |
| `scenes/GameScene.ts` | 2 | Zielhinweise (Granate, Bodenstampfer) |
| `render/Juice.ts` | 4 (`add.circle`) | Boss-Warnkreis, Explosionsring, Heilpuls, Spawnwarnung |

**Spielwelt-Elemente darunter** (Etappe 5): Encounter-Ring, Ausstiegsmarker,
Bodenfunde, Boss-Warnkreis, Explosionsring, Heilpuls, Spawnwarnung.
Zusätzlich: **Buschfelder sind Rechtecke** statt Cluster mit unregelmässigem
Rand; **Wände ohne Eckstücke**; **keine Bodenvariation** ausser zwei
Sandkacheln im Wechsel.

### 18. Pinke Linie / Boss-Zonen-Markierung – Ursprung ✅ geklärt

`ArenaRenderer.drawMarkers`: `lineStyle(4, COLORS.danger, 0.75)` mit
`COLORS.danger = 0xff5470` (Pink-Rot), Radius 420 px (Ende-Boss 567). Bei
Zoom 0,8 ist der Ring grösser als die halbe Bildhöhe – man sieht also keinen
Kreis, sondern eine **durchgehende pinke Bogenlinie quer über das Bild**.

### 19. „X Punkte frei – in der sicheren Zone verteilen“ – vorhanden, nicht im Briefing

`systems/skills.ts`, `ui/SkillPanel.ts`, Eingabe `levelUp`, Protokollfelder
`sp`/`sk`, HUD-Hinweiszeile; Fundstellen in 19 Dateien.

*Zur Einordnung, nicht als Widerspruch:* Das System wurde am 2026-09-17 auf
Wunsch des Nutzers gebaut („Fähigkeiten leveln nach jeder Welle“) und in
Phase 8 nach einer Auswahl des Nutzers auf „ein Punkt je Distanzzone“
umgestellt. Im Briefing steht es nicht. Wird in Etappe 1 wie angewiesen
entfernt; über die Git-Historie bleibt es wiederherstellbar.

---

## Weitere Befunde

- **Durchsichtiger Doppel-Charakter in der Wand:** beim Lesen **nicht
  eindeutig gefunden**. Die Datei `ClientGame.ts` aus dem Arbeitsdokument
  existiert nicht (gemeint ist `net/ClientView.ts`). Verdächtig:
  `EntityRenderer.playerVisuals` wird nie aufgeräumt, wenn ein Spieler aus dem
  Zustand verschwindet – sein Sprite bliebe stehen. Gegner-Sprites aus dem
  Pool werden dagegen korrekt ausgeblendet. Nachstellen in Etappe 2.
- **Kenney-UI-Paket oder Pixel-Font:** im Repo nicht vorhanden. Unter
  `public/assets/` liegt ausschliesslich „Topdown Shooter Pixel“ (Tilesheet,
  Lizenz, zwei Vorschaubilder) plus die zwei Musikstücke. Keine `.ttf`,
  `.otf`, `.fnt`, `.woff`.
- **CLAUDE.md ist zwei Phasen hinter dem Code:** endet bei „Phase 8 und 9
  gebaut · Als Nächstes Phase 10“. Gebäude, Minimap, Kompass, Loot, Gitter,
  Loadout sind dort nicht beschrieben.
- **GitHub Pages** zeigt noch den Stand von Phase 9 (`5278d22`). Alles danach
  liegt nur auf dem Branch `claude/artifact-session-70nhy4`.

---

## Nachträge je Etappe

### Etappe 1 · 2026-09-23 21:22 UTC

Punkt 19 erledigt: Skillpunkte-System vollständig entfernt. Siehe CLAUDE.md,
Protokoll Etappe 1.

### Etappe 2 · 2026-09-24 06:25 UTC

Punkt 18 erledigt: Ring gestrichelt, 2 px, `#E4572E`, ohne Füllung.
Doppel-Charakter: nicht nachgestellt; zwei passende Sprite-Lebensdauer-Fehler
behoben (Figuren Gegangener blieben stehen). Siehe CLAUDE.md, Protokoll
Etappe 2.

### Etappe 3 · 2026-09-24 06:27 UTC

**Korrektur zu Punkt 1/2:** Das Audit hat einen Fehler übersehen – Gegner
konnten in der sicheren Startzone erscheinen (`findSpawnPoint` prüfte sie
nicht). Behoben, mit Test und Gegenprobe. Ansonsten bestätigt.

### Etappe 4 · 2026-09-24 06:40 UTC

**Korrektur zu Punkt „Extraktion“:** Die Regel „alle, auch Gefallene“ war
vorhanden, das Dokument verlangt „alle lebenden“ – umgestellt. Kompass sass
nicht am Rand, sondern auf einer Ellipse innen – jetzt am Rand. Bodenmarker
waren Farbflächen – jetzt Teppich aus dem Sheet. **Neu gefunden:** Der
schlafende Boss wurde entgegen dem Kommentar nie gezeichnet – jetzt schon.

*(wird fortgeschrieben)*
