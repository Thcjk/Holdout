# CLAUDE.md – Projektgedächtnis

Diese Datei wird bei jedem Start gelesen. Sie hält fest, wo das Projekt steht,
welche Entscheidungen getroffen wurden und was bewusst noch fehlt.
**Am Ende jeder Sitzung aktualisieren.**

Der vollständige Auftrag steht in `BRIEFING.md`. Diese Datei ersetzt ihn nicht,
sondern ergänzt ihn um den aktuellen Stand.

---

## Was das hier ist

Holdout, ein Koop-Arena-Shooter im Stil von Brawl Stars: Top-down, 1–4 Spieler halten gemeinsam
gegen immer stärkere Gegnerwellen durch. Läuft im Handy-Browser, gehostet als
statische PWA auf GitHub Pages.

Zielgruppe der Erklärungen: Einsteiger in der Spieleentwicklung, mit Web-Erfahrung.
**Alle Erklärungen auf Deutsch**, Fachbegriffe beim ersten Auftreten kurz einordnen.
Code lesbar und kommentiert, nicht maximal clever. Kommentare ebenfalls auf Deutsch.

## Aktueller Stand

> **Seit 2026-09-23 abends läuft eine grosse Überarbeitung nach einem
> technischen Arbeitsdokument (Etappen 0–12).** Der verlässliche Stand steht
> in **`AUDIT.md`** (geprüft im Code, nicht aus dieser Datei übernommen) und
> im **Protokoll der Überarbeitung** direkt unten. Wo der Rest dieser Datei
> etwas anderes sagt, gilt das Protokoll.

Gebaut vor der Überarbeitung (alles auf dem Branch, **Pages zeigt noch
Phase 9**): Phase 8 (offene Welt aus Seed), Phase 9 (Encounter, Boss,
Extraktion), Gebäude, Kamera 0,8, Kompass, Minimap, Phase 10 (Loot),
Phase 11 zum Teil (Gitter-Logik, Loadout-Bildschirm, Rucksack reist in den
Run).

### Protokoll der Überarbeitung

Jede Etappe: was gebaut wurde, **wie** geprüft wurde, was nicht wie geplant
lief. Neueste unten.

#### Etappe 0 – Bestandsaudit · 2026-09-23 21:17 UTC

- **Gebaut:** `AUDIT.md` mit allen 19 Punkten der Checkliste.
- **Geprüft wie:** Jede Aufrufkette im Code verfolgt (Datei geöffnet,
  Aufrufstelle gesucht), `grep` nach `fillRect`/`fillCircle`/`fillRoundedRect`
  über `src/` mit Zählung je Datei, Durchlauf Menü → Rucksack → Run im
  Emulator ohne Seitenfehler.
- **Ergebnis kurz:** 6 × ✅, 10 × ⚠️, 3 × ❌ (Tank-Heilung,
  Sniper-Aufklärung, Auto-Aim). Pinke Linie geklärt: der Encounter-Ring.
- **Nicht wie geplant:** Der durchsichtige Doppel-Charakter liess sich beim
  Lesen nicht eindeutig finden – wird in Etappe 2 nachgestellt.

#### Etappe 1 – Skillpunkte-System entfernt · 2026-09-23 21:22 UTC

- **Gebaut:** „X Punkte frei – in der sicheren Zone verteilen“ vollständig
  entfernt: `systems/skills.ts`, `ui/SkillPanel.ts`, `tests/systems/skills.test.ts`
  gelöscht; Eingabe `levelUp`, Protokollfelder `sp`/`sk`, `PlayerState.skills`
  und `skillPoints`, `SKILLS`/`SKILL_ORDER`/`SKILL_POINTS_PER_ZONE`, die
  `?tune=skills.*`-Wurzel, die HUD-Hinweiszeile und der Zusatz „…und du kannst
  aufwerten“ in der sicheren Zone.
- **Grundwerte unverändert:** Die Faktoren `damageFactor`, `speedFor`,
  `superChargeFor` waren auf Stufe 0 genau 1. Schaden, Tempo und
  Superaufladung rechnen jetzt direkt mit den Grundwerten – für einen Spieler,
  der nie aufgewertet hat, ändert sich nichts. `superChargeFor` ist als
  Rechnung erhalten und nach `combat.ts` gezogen.
- **Geprüft wie:** `grep -i "skill|punkte frei|aufwert|levelUp"` über `src/`
  und `tests/` liefert nur noch Kommentare, die die Entfernung erklären.
  Typecheck, Lint, 217 Tests grün. Im Emulator bis Zone 2 gelaufen: oben links
  steht nur „Zone 2“, kein Panel, keine Hinweiszeile, keine Seitenfehler.
- **Tests umgebaut statt gelöscht:** Die zwei Fortschritts-Tests prüften
  Skillpunkte, meinten aber etwas Wichtigeres – dass ein Dash über mehrere
  Zonengrenzen keinen Fortschritt verschluckt und dieselbe Zone nicht doppelt
  zählt. Sie prüfen das jetzt an den `zoneReached`-Ereignissen.
- **Nebenwirkung, gemessen:** Der Bot verteilte bisher Punkte. Ohne sie:
  Scout 5,6 · Tank 3,4 · Sniper 6,0 Zonen (vorher 5,4 · 3,6 · 7,8).
- **Nicht wie geplant:** nichts.

#### Etappe 2 – Pinke Linie und Doppel-Charakter · 2026-09-24 06:25 UTC

- **Pinke Linie – behoben.** Ursache war der Encounter-Ring
  (`ArenaRenderer.drawMarkers`): durchgezogen, 4 px, `0xff5470`, Radius 420
  (Ende-Boss 567). Bei Zoom 0,8 grösser als die halbe Bildhöhe, im Bild also
  ein pinker Bogen quer über alles. Jetzt **gestrichelt, 2 px, `#E4572E`,
  ohne Füllung** (`strokeDashedCircle`, Strichzahl am Umfang bemessen, damit
  grosser und kleiner Ring gleich aussehen). Der Radius ist unverändert der
  Auslöseradius.
- **Palettenfarbe:** `COLORS.danger` ist jetzt `#E4572E` (war `#ff5470`),
  ebenso die drei Text-Literale im Ergebnisbildschirm, HUD und
  Absturzbildschirm. Betrifft alles, was „Gefahr“ bedeutet.
- **Durchsichtiger Doppel-Charakter – NICHT nachgestellt, zwei passende
  Fehler behoben.** Versucht: Koop mit zwei Tabs (lokaler Transport), beide
  Seiten sehen je genau zwei Figuren. Beim Lesen gefunden:
  1. `EntityRenderer.playerVisuals` wurde **nie aufgeräumt**. Verschwand ein
     Spieler aus dem Zustand, blieb sein Bild stehen – eingefroren, und wenn
     er zuletzt am Boden lag, halbdurchsichtig. Jetzt `pruneLeftPlayers`, mit
     `destroy()` statt Ausblenden.
  2. `HostSession.handleLeave` vergass nur die Eingabe. Die Figur eines
     Gegangenen blieb **bewegungslos in der Welt**, wurde zu Boden gebracht und
     lag dann halbdurchsichtig da. Nebenfolge: Solange sie stand, war keine
     Extraktion möglich. Jetzt wird der Spieler aus der Simulation entfernt.
  Beides passt zur Beschreibung („alte Sprite-Instanzen“, „durchsichtig“),
  **bewiesen ist die Ursache damit nicht**. Taucht der Doppel-Charakter
  wieder auf, braucht es die genaue Situation (solo oder Koop? nach
  Wiederbelebung? nach Verbindungsabbruch?).
- **Geprüft wie:** Emulator, zum nächsten Encounter von Seed 4242 gelaufen
  (2000 px links oben vom Start) – der Ring erscheint als dünne gestrichelte
  Linie. Neuer Test `tests/net/session.test.ts`: Verlässt ein Client die
  Runde, steht beim Host nur noch der Host im Zustand. 218 Tests, Typecheck,
  Lint grün.
- **Nebenbei:** Meine Prüfskripte liegen jetzt unter `node_modules/.cache/shots/`
  statt im Projektordner – dort ignoriert ESLint sie, und sie können nicht
  versehentlich mit eingecheckt werden.
- **Nicht wie geplant:** Die Datei `ClientGame.ts` aus dem Arbeitsdokument
  existiert nicht; gemeint ist `net/ClientView.ts`. Dort liegt beim
  Herunterfallen und Wiederbeleben kein Fehler: Die Vorhersage springt auf
  die Host-Position, sobald der Spieler am Boden ist.

#### Etappe 3 – Weltgenerierung verifiziert, ein Fehler behoben · 2026-09-24 06:27 UTC

- **Laut Audit vorhanden – nur verifiziert, nicht neu gebaut.** Der vom
  Dokument verlangte Selbsttest existiert: `worldGenerator.test.ts` erzeugt
  jede Welt zweimal aus demselben Seed und vergleicht das **ganze** Ergebnis
  tief (`toEqual`) – Wände, Büsche, Gebäude, Encounter, Ausstiege, Fundorte.
  Dazu: verschiedene Seeds ergeben verschiedene Welten, Welt- und
  Spielzufall sind getrennte Ströme, Flutfüllung 100 % erreichbar mit
  Gegenprobe. Zufall nur über Mulberry32 (`systems/rng.ts`).
- **Behoben – das Audit hatte es übersehen:** `findSpawnPoint` prüfte die
  sichere Startzone gar nicht. Ein Spieler am Rand der Zone bekam Gegner auf
  einem Ring von 700–1200 px – und ein Teil davon liegt mitten in der Zone.
  Das Dokument verlangt „keine Gegner-Spawns innerhalb“. Jetzt wird jeder
  Punkt näher als `safeRadius + 120` verworfen.
- **Geprüft wie:** neuer Test in `spawning.test.ts` stellt den Spieler genau
  auf die Grenze und sammelt 60 s Spawns – keiner liegt innerhalb, und es
  sind überhaupt welche erschienen (sonst wäre der Test wertlos). **Gegenprobe
  gemacht:** Mit abgeschalteter Prüfung fällt der Test durch.
- **Bewusst nicht geändert:** Gegner, die dem Spieler in die Startzone
  *nachlaufen*, dürfen das weiterhin. Das Dokument verbietet nur das
  Erscheinen dort. Ob die Zone ganz gegnerfrei sein soll, ist eine offene
  Designfrage.
- **Nicht wie geplant:** Die Namen im Ergebnis weichen vom Dokument ab
  (`spawnPoint` statt `startPoint`, Ende-Boss in `encounters` mit `isFinal`
  statt eigenem `endBossPoint`). Inhaltlich gleichwertig – umbenannt habe ich
  nicht, weil die Regel lautet, Funktionierendes nicht neu zu bauen.

#### Etappe 4 – Encounter, Bosse, Extraktion · 2026-09-24 06:40 UTC

- **Extraktionsregel umgedreht, weil das Dokument es verlangt:** Der
  Countdown zählt jetzt nur die **stehenden** Spieler („alle lebenden“).
  Bisher mussten auch Gefallene in der Zone liegen. Damit „Liegenlassen“
  trotzdem nicht folgenlos ist, habe ich einen Preis ergänzt: Wer bei der
  Extraktion am Boden **ausserhalb** der Zone liegt, verliert seine Beute
  (`leftBehind` in `systems/encounters.ts`, abgerechnet in
  `storage/carried.ts`; der Ergebnisbildschirm sagt „Am Boden
  zurückgelassen – N Gegenstände verloren“). **Das ist meine Ergänzung,
  nicht aus dem Dokument** – wenn sie nicht gefällt: ein Parameter in
  `finishRun`, raus damit. Liegen alle am Boden, startet kein Countdown –
  das ist ein Wipe. Hinweis im Bild: „Wer steht, bleibt in der Zone“.
- **Kompass am Bildschirmrand** (`ui/compassPlacement.ts`, phaserfrei, mit
  Test über 72 Richtungen): Der Pfeil läuft 30 px innerhalb des Rands und
  rutscht auf derselben Kante aus den vier HUD-Ecken heraus. Die Sperrflächen
  werden aus den **echten** Anzeigen gemessen (`getBounds`), nicht geschätzt.
  Er verschwindet, sobald die Zonenmitte im Bild ist – im Emulator lag er
  sonst mitten auf dem Teppich, auf den er zeigen sollte.
- **Bodenmarker aus dem Sheet:** grüner Teppich als Neunerteilung (Spalten
  21–23, Reihen 13–15, `EXTRACTION_PAD_TILES`), so gross, dass auch seine
  Ecken im Wirkkreis liegen. Darüber die exakte Grenze als Ring und ein
  doppelter Leucht-Puls, der über den Kreis hinaus nach aussen läuft. Die
  **gefüllten Kreise** (Hof, Zone) sind weg.
- **Schlafender Boss wird jetzt gezeichnet:** abgedunkeltes Boss-Sprite in
  der Ringmitte, Ende-Boss doppelt so gross. Der Kommentar in
  `encounters.ts` behauptete das schon seit Phase 9 – gezeichnet wurde es nie.
  Nebenbei: Der Ring des Ende-Bosses wurde zu früh ausgeblendet (Sichtprüfung
  mit dem kleinen Radius) – behoben.
- **Geprüft wie:** 226 Tests, darunter vier neue zur Extraktion (Gefallener
  hält nicht auf; Stehender verlässt → Abbruch; Gefallener in der Zone kommt
  mit; alle am Boden → Wipe) und einer zur Beute. Der erste der vier schlägt
  auf dem alten Code fehl (dort wartete die Zone auf den Gefallenen).
  **Im Emulator** (iPhone 13 quer, `?seed=1/42/4242`): Kompass an drei
  verschiedenen Rändern ohne Überlappung; Lauf in die Zone → Countdown →
  „Extrahiert, 4 Gegenstände gesichert“; Lauf zum Boss → schlafendes Sprite
  sichtbar, beim Betreten erwacht er in Farbe.
- **Nicht wie geplant / offen:**
  - Die Minimap-Markierung der Zonen gab es schon; sie wandert mit der
    Minimap in Etappe 6.
  - **Grün ist doppelt belegt:** Büsche (verstecken) und Teppich
    (aussteigen) sind beide grün. Der Teppich unterscheidet sich durch Rahmen
    und Ring, aber das Dokument sagt „Grün = sicher“. Die Alternative im
    Sheet wäre der orange Teppich (18–20, 13–15) – der verwechselt sich mit
    den Ziegeln. Ich habe Grün gelassen; im Spieltest ansehen.
  - Kompass und HUD-Balken sind weiterhin gezeichnet (Kreis, Dreieck,
    Rechtecke). Ein UI-Paket gibt es nicht (siehe Etappe 11); das bleibt
    auf der Liste für Etappe 5.
  - Einmal gesehen: Eine Deckungswand berührte den Wirkkreis einer
    Ausstiegszone. Kein Fehler im Ablauf, aber unschön – nicht behoben.

#### Etappe 5 – echte Kacheln statt Farbflächen · 2026-09-24 06:55 UTC

- **Wände mit Ecken und Endkappen.** Kenneys Beispielbild
  (`public/assets/Sample.png`) baut Häuser aus dunklen Blöcken mit farbigem
  Rand – dieselben Stücke gibt es im Sheet dreimal (orange, braun, grau). Die
  Zerlegung steht in `render/wallPieces.ts` (phaserfrei, 7 Tests):
  Einzelblock, dünne Wand mit zwei Kappen, dicker Block als Neunerteilung.
  Gebäude werden **zellenweise nach Nachbarn** ausgelegt
  (`joinedWallCells`), damit an den Ecken echte Eckstücke sitzen und Kappen
  nur an der Tür. Farben: Gebäude orange (wie im Beispielbild), Deckung
  grau, Aussenmauer braun.
- **Dafür liegt jetzt jede Wand auf dem 48-px-Raster** (`WORLD.grid`).
  Deckung 144–336 × 48 statt 140–320 × 60, Gebäudewand 48 statt 36, Tür 144
  statt 130, Aussenmauer 48 statt 40. **Das ändert Spielwerte** – früher war
  genau das mit Verweis auf Balance abgelehnt worden. Hier verlangt das
  Dokument die Wandstücke, und sie passen nur auf ein Raster. Gegengeprüft
  mit dem Bot, Stand davor gegen danach im selben Lauf gemessen:
  Scout 5,4 → 4,6 · Tank 3,2 → 3,2 · Sniper 6,8 → 7,4 Zonen. Bei fünf
  Läufen auf verschiedenen Welten ist das Rauschen, keine Verschiebung.
- **Gebäude wachsen mit der Distanz:** Obergrenze 384 + 24 je Zone, höchstens
  624 (Dichte stieg schon vorher mit der Zone).
- **Büsche als unregelmässige Haufen:** Von jeder Ecke eines Feldes wird ein
  Stück abgeknabbert (`bushCluster`); zurück kommen Rechtecke ohne
  Überlappung, die Versteck-Prüfung bleibt unverändert. Darauf sitzen
  Kenneys runde Büsche (18–19, 6–7) an per Hash gewählten Stellen – kein
  Zufall aus der Simulation, damit Host und Client dasselbe sehen.
- **Bodenfunde, Geschosse, Partikel aus dem Sheet.** Beute liegt als Sprite
  da (`ITEM_TILES`), darunter nur noch ein Ring in der Seltenheitsfarbe.
  Geschosse sind das Projektil (30,16), eingefärbt in der Palettenfarbe;
  Partikel sind Trümmer (19,9) und Splitter (20,10). **Der selbst gezeichnete
  Atlas `assets/textures.ts` ist gelöscht.**
- **Effekte ohne Füllung:** Explosion, Heilung, Spawnwarnung sind reine
  Ringe. Die Boss-Warnung hat jetzt einen festen Ring am Wirkradius plus
  einen wachsenden als Uhr – vorher sah man die Grenze erst kurz vor dem
  Einschlag. Zielvorschau von Granate und Stampfer ohne Füllung.
- **Geprüft wie:** 236 Tests (neu: Raster aller Wände und Büsche für fünf
  Seeds, `WORLD.grid === TILE × WORLD_SCALE`, Buschhaufen ohne Überlappung
  und zusammenhängend, alle Wandformen, Gebäude-Ecken). Flutfüllung weiter
  100 % erreichbar. Im Emulator bei Zoom 0,35 und normal angesehen.
  **Zwei Fehler erst im Bild gefunden:** braune Deckung verschwand im Sand
  (→ grau), und Häuser sahen mit Kappen an jeder Ecke zusammengestückelt aus
  (→ `joinedWallCells`).
- **Grep-Ergebnis `fillRect(` / `fillCircle(` in `src/`, wie verlangt:**

  | Datei | Anzahl | Was | Warum noch da |
  | --- | --- | --- | --- |
  | `scenes/HudScene.ts` | 7 | Lebens-/Superbalken, Wiederbelebungsbalken, Kompass-Untergrund | HUD |
  | `ui/Minimap.ts` | 5 | Punkte auf der Karte | HUD |
  | `ui/TouchControls.ts` | 3 | Knöpfe FEUER/Fähigkeit/Super | HUD |
  | `ui/VirtualJoystick.ts` | 2 | Joystick | HUD |
  | `ui/InventoryGrid.ts` | 2 | Rucksack-Zellen | HUD |
  | `render/EntityRenderer.ts` | 2 | Lebensbalken über Gegnern | Balken, siehe unten |

  Dazu (andere Befehle, gleicher Sinn): `fillRoundedRect`/`fillTriangle`/
  `add.rectangle` in Minimap, Inventar, Menü, Knopf, HUD und die
  Teammate-Pfeile in `CameraController`. `add.circle` in `Juice.ts` ist nur
  noch ungefüllt.
- **Nicht wie geplant / offen:**
  - **Das HUD ist weiter gezeichnet.** Ein UI-Paket (Knöpfe, Balken, Rahmen)
    ist im Repo nicht vorhanden (Etappe 11 hält das fest). Das Dokument sagt
    dort „nicht improvisieren“ – deshalb kein Nachbau aus Weltkacheln.
  - **Lebensbalken über Gegnern** sind gefüllte Rechtecke in der Welt. Das
    Sheet hat keine Balken. Bewusst gelassen: Ein Balken ist eine Anzeige,
    keine Fläche, die etwas darstellt.
  - **Das Paket hat keine Waffen-Symbole.** Waffen liegen als Kiste mit
    Messer/Werkzeug da; welche Waffe es ist, sagt erst der Rucksack.
  - **Bodenvariation** bleibt beim Wechsel der zwei Sandkacheln je Feld.
    Streudeko (Steine, Grasbüschel) habe ich verworfen: graue Steine sehen
    aus wie Schrott am Boden, grüne Büschel widersprechen „Grün = Versteck“.

#### Etappe 6 – Massstab und Minimap · 2026-09-24 06:57 UTC

- **Massstab gemessen, nicht verändert.** Der sichtbare Körper jeder Figur
  ist 12 Sheetpixel hoch, beim Spieler ×3 = 36 Weltpixel. Beim Standardzoom
  0,8 (eine Person) sind das 28,8 von 540 Entwurfspixeln = **5,3 %** der
  Bildhöhe – innerhalb der verlangten 5–7 %. Weil die Entwurfshöhe fest 540
  ist und formatfüllend skaliert wird, gilt der Anteil auf jedem Gerät. Beim
  weitesten Zoom (0,55, Gruppe weit auseinander) sind es 3,7 % – das ist
  gewollt, sonst passt die Gruppe nicht ins Bild. Festgehalten in
  `tests/ui/scaleRule.test.ts`.
- **Minimap immer sichtbar, rechts oben, 120 × 120**, unter Punktzahl und
  Knopfreihe. Antippen öffnet die grosse Ansicht (oben links, bis 250 px –
  die frühere Position, die im Emulator nachweislich nichts verdeckte),
  erneutes Antippen der kleinen schliesst sie. **Kein Anhalten**, die
  Steuerung bleibt aktiv – im Emulator mit offener Karte gelaufen.
- **Umbau dafür:** Die Punktzahl steht auf zwei Zeilen („Score · Rekord“,
  „Gegner · Beute“) statt vier, die Knopfreihe rückt von 106 auf 62. Sonst
  hätte die Karte auf dem SUPER-Knopf gelegen. Der Knopf **„Karte“ ist
  weg** – die Karte selbst ist jetzt der Knopf.
- **Kompass** weicht der kleinen und (wenn offen) der grossen Karte aus.
- **Nicht wie geplant / offen:**
  - Die grosse Karte schliesst man über die kleine, nicht durch Antippen
    der grossen: Die grosse liegt links, und dort startet jede Berührung den
    Joystick.
  - Die kleine Karte zeigt die ganze Welt (16000 px auf 120 px). Ein
    mitlaufender Ausschnitt wäre für die Umgebung nützlicher; das Dokument
    sagt dazu nichts, deshalb nicht gebaut.
  - HUD-Text auf Gras und Kompassschrift auf grünem Teppich sind schwer
    lesbar – das ist Etappe 11 (weiss mit Schatten).

#### Etappe 7 – neue Welt nach jedem Run, Koop-Raum bleibt offen · 2026-09-24 07:09 UTC

- **Der eigentliche Fehler:** Die Verbindung gehörte der Sitzung, und die
  Spielszene räumte die Sitzung beim Verlassen mit `destroy()` ab – der Host
  schickte sogar ein „bye“. Nach jedem Koop-Run war der Raum zu, alle
  brauchten einen neuen Code. Der Ergebnisbildschirm sagte das ehrlich
  („die Verbindung endet mit dem Run“), gelöst war es nicht.
- **Jetzt:** `GameSession.release()` beendet die Sitzung, **ohne** die
  Verbindung zu schliessen, und gibt sie heraus (solo `null`). Sie wandert
  Ergebnisbildschirm → Packen → **dieselbe Lobby**. Dort meldet sich jeder
  Client mit `hello` neu (mit neuem Rucksack und evtl. neuem Charakter), der
  Host zieht mit „Runde starten“ einen neuen Seed und verteilt ihn über das
  bestehende `start`-Paket. Keine neue Nachricht im Protokoll.
- **Solo und Koop gleich:** „Neuer Run“ führt beide zum Packen (vorher ging
  solo direkt ins Spiel und übersprang den Rucksack). Ladezustand: Der Knopf
  zeigt „Welt wird gebaut …“ und ist gesperrt, bis die nächste Szene steht.
- **Zustände zurückgesetzt:** Jede neue Sitzung baut die Welt mit
  `createWorld` neu – Position, Leben, Munition, Gegner, Beute am Boden. Der
  Rucksack kommt aus dem Packbildschirm; die Wipe/Erfolg-Regel rechnet weiter
  `storage/carried.ts` ab (die Übernahme gesicherter Beute ins Packen ist
  Etappe 9).
- **Wer „Charakter wechseln“ oder „Zurück“ wählt, schliesst die Verbindung**
  – eine vergessene hielte den Raum für die anderen offen. Verlässt der Host
  den Raum, während ein Client in der Lobby wartet, steht das jetzt dort
  (vorher wartete der Client stumm).
- **Geprüft wie:** zwei neue Tests in `tests/net/session.test.ts` –
  `release()` schliesst nichts und sendet kein „bye“; nach einem Run starten
  zwei neue Lobbys über **dieselben** Transporte, beide bekommen denselben
  neuen Seed, der neue Charakter des Clients kommt an, und Host und Client
  bauen dieselbe Karte. **Im Browser** mit zwei Tabs (lokaler Transport):
  Run 1 bis zum Wipe (1 Lebenspunkt, schnelle Gegner per `?tune=`), beide
  „Neuer Run“ → Packen → Lobby zeigt „LOCAL1“ mit beiden Spielern → Start →
  beide in einer neuen Welt. Der erste Versuch lief versehentlich gegen den
  alten Build (vergessen zu bauen) – wiederholt.
- **Nicht wie geplant / offen:**
  - **Startet der Host, bevor ein Client zurück in der Lobby ist, fehlt
    dieser Client im neuen Run** und hängt in der Lobby. Die Hostliste zeigt,
    wer da ist, und der Hinweis sagt „starte, sobald alle in der Liste
    stehen“ – erzwungen wird es nicht. Eine Sperre bräuchte eine Vorstellung,
    wer „alle“ sind, obwohl jemand gehen darf.
  - Über PeerJS (zwei echte Geräte) nicht geprüft – der Signalisierungsserver
    ist hier gesperrt. Der lokale Transport benutzt aber dieselbe
    Schnittstelle, und am Transport ändert sich nichts.
  - Aufgefallen, nicht geändert: `Lobby.start()` stoppt seine
    Wiederholungen sofort, weil die Szene die Lobby im Start-Handler
    abräumt. Ein verlorenes `start`-Paket würde also nicht wiederholt. War
    schon vorher so und im Feldtest unauffällig.

#### Etappe 8 – Loot-Grunddaten · 2026-09-24 07:11 UTC

- **Laut Audit fast vollständig vorhanden** (`config/items.ts` mit
  `ItemDef {id, name, type, size, rarity}`, zwölf Gegenstände; Sprites seit
  Etappe 5). Geändert wurden nur die Zahlen:
- **Dropquoten auf die Dokumentwerte:** Läufer 8 → **15 %**, Brocken 28 →
  **30 %**, Schütze 16 → **20 %** (`LOOT.dropChance`). Der Boden füllt sich
  damit merklich schneller – gewollt, weil der Gitter-Rucksack das Aufheben
  zur Auswahl macht.
- **Bosse: garantiert höhere Seltenheit** stand schon im Code (Mini-Boss ab
  Stufe 2, Ende-Boss ab 3), aber als nackte Zahl in `systems/loot.ts`. Jetzt
  `LOOT.bossMinRarity` / `finalBossMinRarity` in `balance.ts`.
- **Geprüft wie:** 1000 Tode je Typ, gemessene Quote 14,7 / 28,6 / 19,4 %;
  der Test prüft zusätzlich, dass die eingestellten Werte die des Dokuments
  sind (sonst prüfte er nur den Zufall). Neuer Test: auch der Mini-Boss
  lässt nie Stufe 1 fallen. 240 Tests grün.
- **Nicht wie geplant:** nichts – bis auf die Waffen-Symbole, die das Paket
  nicht hat (siehe Etappe 5).

#### Etappe 9 – Gitter-Inventar vervollständigt · 2026-09-24 07:25 UTC

- **Rucksack 8 × 6** statt 8 × 4 (Dokumentwert). Zellen im Spiel 64,
  im Packbildschirm 62 Entwurfseinheiten = 44,8 Punkte auf dem iPhone 13 –
  über Apples Mindestmass 44.
- **Packbildschirm: Lager links (5 × 6), Rucksack rechts (8 × 6).** Nach
  einem Wipe (und beim ersten Start) liegt das Starter-Set links und der
  Rucksack ist leer – so verlangt es das Dokument. Gezogen wird zwischen den
  Gittern wie innerhalb eines Gitters, mit grüner/roter Zielfläche; der
  Gegenstand wechselt erst, wenn das Ziel ihn annimmt (`acceptForeign`),
  dann nimmt ihn die Quelle heraus. Drehen per Tipp oder Knopf „DREHEN“
  (sitzt zwischen den Gittern).
- **Starter-Set geschützt, und das war vorher kaputt:** Nach einem Erfolg
  wanderte alles in die gesicherte Beute – auch das Starter-Set, das beim
  nächsten Packen frisch dazukam. Zwei Erfolge, drei Pistolen. Jetzt tragen
  Starter-Stücke ein Merkmal (goldene Ecke), das auch übers Netz reist
  (Bit im vierten Wert des Rucksack-Codes, `systems/backpackCodec.ts`, alte
  Pakete bleiben lesbar). Sie gehen nie verloren und werden nie gezählt.
- **Wipe leert, Erfolg behält – samt Anordnung:** `storage/carried.ts`
  merkt sich den Rucksack nach einem Erfolg mit Lage und Drehung; er ist
  der Ausgangspunkt des nächsten Packens. Nach einem Wipe ist er leer. Das
  Lager fasst ein Wipe nicht an.
- **Rucksack im Run:** Knopf „Rucksack“ links neben Pause/Ton öffnet ein
  Fenster mit dem Gitter. Umräumen, Drehen, **aus dem Gitter ziehen =
  wegwerfen** (der Gegenstand liegt dann neben der Figur am Boden). Das
  Fenster ändert den Rucksack **nicht selbst**: Es schickt einen
  `InventoryCommand` mit der nächsten Eingabe, im Koop also zum Host, der
  ihn mit denselben Regeln ausführt. Der Gegenstand wird über seine Zelle
  benannt, nicht über seine Listennummer – die entsteht auf dem Client bei
  jedem Zustandspaket neu. **Kein Anhalten, auch solo nicht**; die Figur
  steht still, solange das Fenster offen ist.
- **Geprüft wie:** 248 Tests, neu: Codec (Rundreise, altes Format, halber
  Block), Abrechnung (Wipe ohne Starter, Erfolg mit Anordnung, keine
  Vermehrung, Lager unberührt, Zurückgelassene), Befehle in der Simulation
  (verschieben/drehen, wegwerfen landet am Boden, leere Zelle tut nichts)
  und **übers Netz** (Client-Befehl kommt beim Host an und im
  Zustandspaket zurück). **Im Browser:** Pistole vom Lager in den Rucksack
  gezogen; im Run verschoben und weggeworfen („Beute 0“, Kiste am Boden);
  Wipe → Pistole zurück im Lager; Extraktion → Pistole bleibt im Rucksack,
  Lager ohne zweite Pistole.
- **Fehler, die erst das Bild gezeigt hat:** Das Gitter im Run-Fenster lag
  unter dem abdunkelnden Hintergrund (feste Zeichenebenen) – dunkel und
  ohne Berührung; jetzt mit einstellbarer Grundebene. „Verband“ lief bei
  1 × 1 über den Zellrand; „Schliessen“ lag auf dem Hinweistext.
- **Nicht wie geplant / offen:**
  - Ein bestehender Test hing still an der alten Gittergrösse 8 × 4 und
    schlug mit 8 × 6 fehl; er prüft die Drehlogik und hat jetzt sein
    eigenes 8 × 4-Gitter.
  - Doppeltippen zum Drehen gibt es bewusst nicht (bestehende Begründung
    in `ui/InventoryGrid.ts`: ein Tipp dreht bereits, der zweite landet auf
    dem Handy leicht daneben).
  - Das Lager ist wie bisher nur im Arbeitsspeicher (dauerhaft erst in
    Phase 13 laut Briefing).
  - Im Koop ist das Umräumen per Test und Netzlogik geprüft, aber nicht mit
    zwei Tabs im Browser durchgespielt.

#### Etappe 10 – Tank-Heilfeld, Sniper-Aufklärung, Auto-Aim · 2026-09-24 07:33 UTC

| | alt | neu (Werte aus dem Dokument) |
| --- | --- | --- |
| Tank-Fähigkeit | „Zweite Luft“: sofort +1000, nur selbst | **„Heilfeld“**: Radius 220, 80/s, 3 s, alle Stehenden darin, Abklingzeit 12 s |
| Sniper-Super | „Zielscheinwerfer“: ein Gegner, doppelter Schaden 5 s | **„Aufklärungsschuss“**: Geschoss 700 px/s, beim Einschlag alle Gegner im Umkreis 500 für 6 s aufgedeckt, +50 % Schaden vom ganzen Team |
| Auto-Aim | 1,15 × Waffenreichweite | **0,69 ×** (−40 %), `PLAYER.autoAimRangeFactor` |

- **Dokument sagt „ersetzt Schildwand“** – die Schildwand gab es schon nicht
  mehr (seit dem zweiten Spieltest „Zweite Luft“). Ersetzt wurde also die
  Selbstheilung. Nebeneffekt: Der alte Widerspruch „zwei Heilungen am
  Tank“ (siehe Tabelle oben) ist damit weg – der Tank heilt jetzt das Team.
- **Heilfeld:** folgt dem Tank, heilt je Tick, **nicht** am Boden Liegende
  (sonst wäre es eine zweite Wiederbelebung). Gemeldet wird gesammelt einmal
  je Sekunde, die echte Menge. Der Ring wird bei allen gezeichnet – dafür
  reist die Restzeit im Zustandspaket mit (`hf`, optional, alte Pakete
  bleiben gültig).
- **Aufklärungsschuss:** läuft über den normalen Projektilweg (Wände!),
  wirkt auch bei Wandtreffer oder Ende der Reichweite – wie die Granate.
  Aufgedeckte Gegner leuchten gelb, stehen gelb auf der **Minimap**, und
  jeder Treffer darauf macht 50 % mehr. Die Zielvorschau zeigt Linie und
  echten Radius.
- **Nicht übernommen: `cooldown: 14` des Aufklärungsschusses.** Supers laden
  sich hier über ausgeteilten Schaden auf. Eine zweite Sperre für denselben
  Knopf wäre eine Regel, die man nicht sieht. Wenn gewünscht: eine Zeile in
  `supers.ts`.
- **Auto-Aim:** Einen Zielkegel gibt es nicht und gab es nie – gesucht wird
  rundum im Radius. Reduziert wurde deshalb nur die Reichweite. Gegner
  jenseits von 69 % der Reichweite bekommen einen Schuss in Blickrichtung.
- **Geprüft wie:** 253 Tests, neu: Heilfeld (Menge über 3 s, Radius,
  niemand am Boden, Meldungen je Sekunde), Aufklärung (Umkreis, Einschlag
  ins Leere), Schadensbonus 50 %, Zielsuche innen/aussen. **Im Browser:**
  Tank-Knopf heisst „HEILFELD“, Ring mit echtem Radius und innerem Puls,
  Abklingring am Knopf; Sniper-Super mit Vorschau (Linie + gelber Kreis),
  Geschoss und Einschlagring.
- **Nicht wie geplant – deutlich spürbar:** Der Bot-Sniper fällt von 7,4 auf
  **4,8 Zonen** (Scout 4,6 unverändert, Tank 3,2 → 3,4). Grund: Der
  Basisangriff zielt nur automatisch, und die Suche reicht jetzt 621 statt
  1035 px – der Sniper verliert seine Reichweite, sobald der Gegner nicht in
  Blickrichtung steht. Das ist die direkte Folge der Vorgabe, keine
  Nebenwirkung eines Fehlers. Falls es sich im Spiel falsch anfühlt: den
  Faktor je Charakter statt global setzen.

#### Etappe 11 – UI-Stil · 2026-09-24 07:35 UTC

- **Kein Kenney-UI-Paket und keine Pixelschrift im Repo.** Gesucht nach
  Schriftdateien (`.ttf/.otf/.woff/.fnt`) und UI-Paketen: `public/` enthält
  nur das Tilesheet, zwei Vorschaubilder, die Lizenz und die Musik. Laut
  Dokument wird dann **nicht improvisiert** – Knöpfe, Balken und Rahmen
  bleiben gezeichnet, die Schrift bleibt `system-ui`. Festgehalten in
  `AUDIT.md`. Wer ein Paket nachliefert (z. B. Kenney „UI Pack“ und eine
  Pixelschrift), ersetzt `ui/Button.ts` und die Balken in `HudScene`.
- **Palette umgesetzt:** neue Konstante `PALETTE` in `config/constants.ts`
  (HUD-Text `#FFFFFF`, Schatten `#00000066`, Gefahr `#E4572E`, Erfolg
  `#7FB069`). `COLORS.mate` von `#7EE08A` auf `#7FB069`; alle Stellen, die
  die alten Werte als Text wiederholten, lesen jetzt `PALETTE`. Zonenname,
  Punktzahl, Mitspielerzeile, Ansage und Kompassschrift haben Schatten.
- **Geprüft wie:** 253 Tests unverändert grün; im Emulator angesehen –
  weisser Text mit Schatten ist auf Sand und Gras lesbar.
- **Nicht wie geplant:** Das vorgegebene Erfolgsgrün ist dunkler als das
  alte und hebt sich auf dem **Sandboden schwächer ab** (Ansage „Sichere
  Zone …“, Kompass-Entfernung auf dem grünen Teppich). Der Schatten mildert
  es, löst es nicht. Nicht eigenmächtig aufgehellt – die Farbe ist Vorgabe.
  Die Menüs und Ergebnisbildschirme benutzen weiter ihr helles Blaugrau
  (`#dce8f7`); das Dokument verlangt Weiss nur für den HUD-Text.

Was weiterhin aussteht, ist kein Code, sondern dein Urteil:

- **Phase 2 ist ein Gefühlstest.** Ob sich die Steuerung auf dem Handy gut
  anfühlt, lässt sich nicht messen. Fühlt sie sich zäh an: Werte in
  `src/config/balance.ts` (`speed`, `accelerationTime`) und
  `src/config/constants.ts` (`TOUCH`) anpassen.
- **Phase 6 ist bestanden.** Der Nutzer hat am 2026-09-18 auf echten Geräten
  bestätigt, dass Koop über das Internet funktioniert.
- **Balancing ist ein Vorschlag, kein Ergebnis.** Siehe unten.

### Vier Stellen, an denen BRIEFING.md einen älteren Stand beschreibt

Bewusst unverändert übernommen – das Briefing ist das Dokument des Nutzers.
Hier nur festgehalten, damit niemand danach baut:

| Abschnitt | Was dort steht | Was wirklich im Code ist |
| --- | --- | --- |
| 3 | Rechter Joystick zum Zielen, WASD-Desktop-Fallback | Fester FEUER-Knopf, Desktop gesperrt – beides auf Wunsch des Nutzers |
| 4 | Scout: **Blendgranate** | Splittergranate – die Blendgranate wurde als wirkungslos zurückgemeldet |
| 4 | Tank-Super = Team-Heilung | Seine *zweite* Fähigkeit ist bereits eine Selbstheilung → zwei Heilungen an einem Charakter, zu klären in Phase 14 |
| 5 | Projektstruktur mit `entities/`, `WaveManager` | Die echte Struktur steht weiter unten |

## Nur Handy, und installiert statt im Browser

Nach Phase 7 gewünschte Änderung, bewusst ausserhalb des Briefings:

- **Am Desktop startet das Spiel nicht.** `src/platform/device.ts` prüft
  Fähigkeiten (Touchpunkte plus grober Zeiger), nicht den User-Agent-Text: Der
  lässt sich fälschen und ändert sich mit jeder Browserversion. Wer kein
  Touchgerät hat, bekommt `DesktopNotice` mit QR-Code – Phaser wird gar nicht
  erst geladen.
- **Tastatur und Maus sind entfernt.** Der im Briefing vorgesehene
  Desktop-Fallback wäre Code, den niemand mehr benutzen kann.
  **Folge fürs Entwickeln:** Entweder auf dem Handy testen oder in den
  Entwicklerwerkzeugen die Geräteansicht einschalten (F12, dann Strg+Umschalt+M).
- **Das Bild füllt den Bildschirm.** Die Entwurfsauflösung war fest 960×540,
  also 16:9. Ein iPhone im Querformat ist eher 19,5:9 – im Modus `FIT` blieben
  links und rechts je rund 75 Pixel schwarz, das Spiel sass in einem
  Briefkasten. Jetzt bleibt die **Höhe** fest bei 540 und die **Breite folgt dem
  Gerät** (`fitViewportToScreen` in `config/constants.ts`), begrenzt auf 960 bis
  1600. Gemessen auf dem iPhone 13 quer: vorher 693×390 mit 151 px Balken,
  jetzt 844×390 ohne.

  Die Obergrenze ist eine Notbremse gegen absurde Werte, kein enges Korsett –
  zu eng, und es entstünden genau wieder die Balken, die der Umbau beseitigen
  soll. 1600 entspricht 2,96:1, breiter ist kein Handy. Zum Vergleich: 16:9
  ergibt 960, das übliche 19,5:9 ergibt 1170, und Safari im Querformat mit
  eingeblendeter Adressleiste (rund 2,6:1) bleibt mit 1424 darunter.

  **Warum `FIT` und nicht `ENVELOP` oder `RESIZE`** (beides erwogen):
  - `ENVELOP` skaliert formatfüllend und schneidet den Überstand ab. Genau an
    den Rändern sitzen hier aber FEUER, SUPER, Punktzahl und Wellenanzeige –
    abgeschnitten würde also die Bedienung.
  - `RESIZE` gibt jedem Gerät seine eigene Weltansicht. Auf einem breiten Handy
    sähe man deutlich mehr Arena als auf einem schmalen; im Koop wäre das ein
    echter Vorteil.
  - `FIT` auf einer abgeleiteten Auflösung hat beides nicht: nichts wird
    abgeschnitten, und die Grenze 960–1280 hält den Unterschied zwischen
    Geräten bei höchstens einem Drittel Breite.

  **Folge fürs Weiterbauen:** `VIEWPORT.width` steht erst fest, wenn das Spiel
  startet. Wer sie beim Laden einer Datei ausliest (eine Konstante auf
  Modulebene), bekommt die alte 960 – genau das war bei den Mitten der
  Touch-Knöpfe der Fall, sie sind jetzt Funktionen.
- **Die Ränder gehören dem Gerät, nicht dem Spiel** (`src/platform/safeArea.ts`).
  Seit `viewport-fit=cover` zeichnet die Seite bis in die letzte Ecke. Das ist
  gewollt – sonst bleiben Balken –, hat aber eine Kehrseite: Auf einem iPhone
  liegt im Querformat auf einer Seite die Notch, unten der Home-Indikator, und
  alle vier Ecken sind rund. Punktzahl, Lebensbalken und die Knöpfe standen
  genau dort und wurden angeschnitten.

  Diese Abstände darf man **nicht raten**. Jedes Gerät hat andere: ein iPhone
  quer meldet auf einer Seite rund 47 Pixel, ein Handy ohne Notch überall null.
  Deshalb wird gefragt statt geschätzt – der Browser gibt sie über
  `env(safe-area-inset-*)` heraus. Gemessen wird über ein unsichtbares
  Hilfselement: Ein `env()`-Wert lässt sich nicht direkt auslesen, das daraus
  berechnete Polster schon.

  **Umgerechnet wird in Entwurfseinheiten** (`setSafeAreaFromScreen`), nicht in
  Bildschirmpixeln: Gezeichnet wird auf einer Fläche von 540 Einheiten Höhe,
  die auf den Bildschirm skaliert wird. Ohne Umrechnung wäre derselbe Abstand
  auf einem grossen Gerät zu klein und auf einem kleinen zu gross. Alles, was
  am Rand klebt, rechnet `SAFE` auf seinen Randabstand drauf – HUD,
  FEUER/SUPER, Versionsschild, Zurück-Knopf.

  **Reihenfolge in `main.ts`:** quer warten → Bildschirm messen → Sicherheits­-
  abstände messen → Phaser bauen. Der Umrechnungsfaktor hängt an der Breite aus
  Schritt 2.

  **Zum Prüfen:** `?safe=oben,rechts,unten,links` in Bildschirmpixeln gibt die
  Werte vor, statt sie zu messen (Beispiel iPhone quer: `?safe=0,47,21,47`).
  Nötig, weil Emulatoren am Rechner immer null melden – sonst liesse sich ein
  Layout für ein Gerät mit Notch nur auf dem Gerät selbst prüfen. `?debug=werte`
  zeigt ausserdem Fläche, Bildschirmgrösse und die gemeldeten Ränder an; stehen
  dort überall Nullen, meldet das Gerät keine, und es liegt nicht am Spiel.
- **Das Spiel startet erst im Querformat** (`src/platform/rotateGate.ts` plus
  `#rotate-gate` in `index.html`). Vorher lief es auch hochkant an.

  **Der Fehler, den das behebt:** Das Spiel misst beim Start den Bildschirm, um
  seine Zeichenfläche darauf zuzuschneiden. Wird die App **hochkant geöffnet
  und erst danach gedreht** – der normale Ablauf auf dem Handy –, war diese
  Messung für das falsche Format. Übrig blieben Balken links und rechts. Genau
  das war auf dem iPhone zu sehen, und genau diesen Fall hatte ich beim Testen
  übersprungen: Ich habe immer direkt im Querformat gestartet.

  Statt die Fläche nachträglich umzubauen – was jede Szene, jeden Knopf und
  jede HUD-Position neu setzen müsste, mitten im Spiel – wartet der Start
  einfach. Reihenfolge in `main.ts`: **erst quer, dann messen, dann Phaser
  bauen.** Danach gibt es nichts nachzubessern.

  Der Startbildschirm steht **direkt im HTML**, nicht im Spielcode: So ist er
  sofort da, noch bevor Phaser geladen ist.

  **Der Notausgang.** Wer die Rotationssperre eingeschaltet hat – auf dem
  iPhone der Normalfall –, bei dem meldet der Browser nie „quer", egal wie man
  das Gerät hält. Ohne Ausweg wäre das eine Sackgasse, und genau eine solche
  hat dieses Projekt schon einmal lahmgelegt. Deshalb erscheint nach vier
  Sekunden ein Knopf **„Trotzdem starten"**. Wer einfach dreht, sieht ihn nie.
  Die Wahl merkt sich das Modul (`forcedStart`) – sonst würde derselbe
  Bildschirm beim nächsten Grössenwechsel wieder aufhalten.

  Während des Spiels hochkant gehalten, kommt der Startbildschirm zurück. Das
  Spiel läuft dahinter **weiter** und wird nicht angehalten: Im Koop rechnet
  der Host für alle weiter, ein angehaltener Client geriete nur aus dem Takt.
- **Querformat wird zusätzlich verlangt, wo es geht** (`src/platform/orientation.ts`).
  `screen.orientation.lock` greift auf Android in der installierten App;
  **iOS Safari kann es nicht**, weder im Browser noch auf dem Startbildschirm.
  Dort übernimmt der Startbildschirm oben. Im PWA-Manifest steht
  `orientation: landscape`; Android beachtet das, iOS ignoriert es.

  **Die CSS-Drehung um 90 Grad ist bewusst nicht zurückgekommen.** Sie
  funktionierte im Emulator, hatte aber zwei Fallen: CSS dreht das Bild, nicht
  die Finger (Phasers `transformPointer` musste ersetzt werden), und gedreht
  werden darf nur die Zeichenfläche, nicht ihr Rahmen (Phaser misst den Rahmen
  zum Einpassen und bekäme sonst die hochkanten Masse).
- **Auf Grössenänderung wird die Entwurfsfläche neu berechnet** (`refit` in
  `main.ts`). Vorher geschah das nur einmal beim Start, und genau das war der
  **schwarze Rand oben**: Klappt in Safari die Adressleiste ein, wird das
  Fenster höher, das Seitenverhältnis stimmt nicht mehr, und `FIT` legt Balken
  drum. Gemessen im Emulator, vorher:

  ```
  1 direkt nach Start   : Fenster 844x390 | Canvas 844x390 @0,0  | Rand o0  u0
  2 Fenster wird höher  : Fenster 844x420 | Canvas 844x390 @0,23 | Rand o23 u8
  ```

  **Die Falle dabei – zwei Dinge, die gleich klingen.** `game.scale.resize()`
  stellt die Zeichenfläche um, aber **nicht** das Seitenverhältnis, mit dem
  `FIT` sie danach einpasst. Phaser merkt sich das getrennt und behält es bei;
  im Quelltext steht daneben sogar „which doesn't then change". Ohne die Zeile
  `displaySize.setAspectRatio(...)` wechselte die Zeichenfläche also brav von
  1169×540 auf 1085×540 – angezeigt wurde sie weiterhin im alten Verhältnis,
  und der Rand blieb genau wie vorher stehen. Nachher:

  ```
  1 direkt nach Start   : Fenster 844x390 | Canvas 844x390 @0,0 | Rand o0 u0
  2 Fenster wird höher  : Fenster 844x420 | Canvas 844x420 @0,0 | Rand o0 u0
  3 Fenster wird breiter: Fenster 900x420 | Canvas 900x420 @0,0 | Rand o0 u0
  ```

  **Folge fürs Weiterbauen:** Die Entwurfsbreite ändert sich jetzt auch
  *während* des Spiels. Alles, was an einer Bildschirmkante klebt, muss darauf
  hören statt seine Position nur einmal zu bekommen. Phaser meldet es als
  Ereignis `RESIZE`; `HudScene.layout()` setzt daraufhin Texte und Knöpfe neu
  und reicht es über `InputManager.layout()` an `TouchControls` weiter, damit
  auch die drei Knöpfe unten rechts nachrücken. Wer eine neue Anzeige an den
  Rand setzt, gehört in `layout()` – sonst klebt sie an der alten Kante.
- **Die installierte App aktualisiert sich selbst** (`src/platform/update.ts`).
  Ein Service Worker haelt die App offline verfuegbar - und liefert deshalb von
  sich aus weiter die gespeicherte Fassung. Das Modul fragt regelmaessig nach
  (jede Minute im Vordergrund, zusaetzlich bei jeder Rueckkehr in den
  Vordergrund und sobald wieder Netz da ist), laedt Geaendertes im Hintergrund
  und startet erst dann neu, wenn es nicht stoert: **nur im Hauptmenue**. Jede
  Szene meldet das selbst (`setReloadSafe`) - Menue `true`, Spiel, Lobby und
  Ergebnisbildschirm `false`. Sonst waere ein Neustart der Verlust der Runde
  oder der Punktzahl. Niemand muss die App loeschen und neu hinzufuegen.
- **Nicht jede Datei kam beim Update mit - der Fehler, der die Musik zweimal
  „nicht getauscht" aussehen liess.** Der Service Worker merkt sich zu jeder
  Datei eine Kennung, an der er erkennt, ob sie sich geändert hat. Steht dort
  `null`, heisst das: „Der **Dateiname** enthält schon eine Version, diese
  Datei ändert sich nie" – sie wird nach der ersten Installation **nie wieder
  geladen**.

  Für `assets/index-Cx-XINIv.js` stimmt das. Für `assets/audio/menu.ogg`
  stimmt es **nicht**: Der Name bleibt immer gleich. Die Voreinstellung von
  vite-plugin-pwa nimmt aber pauschal alles unter `assets/` als unveränderlich
  an – und dort landet auch alles aus `public/assets/`: Musik, Tilesheet,
  Vorschaubilder.

  **Folge, und sie war heimtückisch:** Die Versionsnummer im Menü sprang brav
  auf den neuen Stand (der Bundle-Name hat ja einen Hash), die Musik blieb die
  alte. Der Nutzer sah 1.16.0 und hörte 1.14.0. Zweimal wurde deshalb ein
  Tausch gemeldet, der längst im Repo stand.

  **Nachgestellt statt vermutet**, mit einem echten Update von 1.14.0 auf
  1.16.0 im Browser (alte Fassung installieren, neue Fassung auf den Server
  legen, aktualisieren lassen):

  ```
  vorher                                   nachher (mit dontCacheBustURLsMatching)
  1) alter Stand   menu.ogg = 52630        1) alter Stand   menu.ogg = 52630
     Deploy:       menu.ogg = 364365          Deploy:       menu.ogg = 364365
  3) Bundle neu    index-oufIWByq.js       3) Bundle neu    index-oufIWByq.js
     ausgeliefert  menu.ogg = 52630  ALT      ausgeliefert  menu.ogg = 364365  NEU
  ```

  `dontCacheBustURLsMatching` in `vite.config.ts` gilt jetzt nur noch für
  Dateien, deren Name wirklich einen Hash trägt. Alles andere bekommt eine
  Inhaltskennung. **Eine bereits installierte App heilt sich damit von
  selbst** – die Kennung ändert den Zwischenspeicher-Schlüssel, also wird neu
  geladen.

  **Folge fürs Weiterbauen:** Wer eine Datei mit festem Namen nach
  `public/` legt, muss nichts weiter tun – sie wird jetzt richtig behandelt.
  Wer die Regel ändert, prüft am fertigen Build nach:
  `grep -o '{url:"[^"]*",revision:[^}]*}' dist/sw.js` darf `null` nur bei den
  hash-benannten Bundles zeigen.
- **Zwei Wege zur Installation.** Android bekommt eine echte APK über Capacitor
  (`android/`, Workflow `android-apk.yml`). Android und iPhone können die Seite
  zusätzlich als PWA installieren (`src/platform/install.ts`). Eine iOS-App ist
  ohne Mac und Apple-Entwicklerkonto nicht baubar - deshalb bleibt die PWA dort
  der einzige Weg.
- **Signatur:** Ohne hinterlegten Schlüssel baut der Workflow einen Debug-Build,
  dessen Schlüssel bei jedem Lauf wechselt - eine so gebaute App lässt sich nicht
  über die vorherige Version installieren. Die vier Secrets dafür stehen im README.

## Steuerung und Fähigkeiten

Zwei Änderungen nach dem ersten Spieltest, beide über das Briefing hinaus:

- **Der Schussknopf sitzt fest.** Im Briefing war rechts ein zweiter
  schwebender Joystick vorgesehen, der beim Loslassen feuert. In der Praxis
  hiess das: Man musste den Gegner treffen, statt einfach zu schiessen. Jetzt
  liegt unten rechts ein fester **FEUER**-Knopf. Halten feuert dauerhaft (so
  schnell, wie Munition und Schusstakt es zulassen), Ziehen zielt mit Linie,
  blosses Halten überlässt der Simulation die Zielsuche. `InputState.fire` ist
  deshalb ein **gehaltener Zustand**, kein einmaliger Wunsch - auch im
  Netzwerkprotokoll. Einmalig sind nur noch Super und Aufwertung.
- **Antippen geht nicht mehr verloren.** `InputState.fire` wird jedes Bild frisch
  vom Finger abgelesen, aber nicht jedes Bild rechnet einen Tick: Bei 60 Bildern
  und 30 Ticks je Sekunde ist es nur jedes zweite. Ein kurzes Antippen, das
  genau dazwischen begann und endete, wurde deshalb stillschweigend verschluckt
  - das war die Ursache für „Schiessen geht nur ab und zu". `TouchControls`
  hinterlegt jetzt bei jedem Druck einen **gemerkten Schuss**, der liegen bleibt,
  bis die Simulation ihn gesehen hat. Genau einer pro Druck, kein Doppelschuss.
  Wird gezogen, bekommt er beim Loslassen noch die gezogene Richtung mit - so
  trifft auch ein schnelles Wischen dorthin, wohin gezielt wurde.
- ~~**Fähigkeiten lassen sich aufwerten**~~ – **am 2026-09-23 entfernt**
  (Etappe 1 der Überarbeitung): steht nicht im Briefing. Wiederherstellbar
  über die Git-Historie vor Commit „Etappe 1“.

### Die Knöpfe liegen im Bogen – und der Basisangriff zielt nicht mehr von Hand

Unten rechts liegen jetzt **drei** feste Knöpfe auf einem Bogen, nach dem
Vorbild von Wild Rift:

| Knopf | Lage | Verhalten |
| ----- | ---- | --------- |
| **FEUER** | innen in der Ecke, der grösste | Antippen feuert **sofort** auf den nächsten Gegner in Reichweite. Halten feuert weiter, so schnell wie Munition und Schusstakt es zulassen. |
| **Fähigkeit** (Name der Fähigkeit) | links davon | Halten zeigt den Zielhinweis, Ziehen richtet aus, Loslassen löst aus. Kurzes Antippen ohne Ziehen löst in Blickrichtung aus. Beim Tank gibt es nichts zu zielen (`aimStyle: "self"`) – dort löst schon das Antippen aus. |
| **SUPER** | darüber, grösser als die Fähigkeit | Gleiches Prinzip. |

Alle drei sind ausgegraut und zeigen einen **Abklingring**, solange sie nicht
einsatzbereit sind. Beim FEUER-Knopf ist das die Munition als Ringstücke – so
sieht man blind, ob noch etwas da ist. Der Bewegungs-Joystick links bleibt, wie
er war.

**Die Munition steht deshalb nur noch dort.** Unten links, neben dem
Lebensbalken, gab es sie ein zweites Mal als Kästchenreihe – dieselbe Zahl an
der gegenüberliegenden Bildschirmecke. Der untere Rand ist der knappste Platz
im Bild, und beim Schiessen schaut der Daumen ohnehin auf den Ring. Die
Kästchen sind weg, der Super-Balken ist an ihre Stelle nachgerückt.

**Der Basisangriff zielt nicht mehr von Hand.** Bisher konnte man am
FEUER-Knopf ziehen, um selbst zu zielen. Genau das war die Ursache für
„Zielen ist unpräzise": Man musste mit dem Daumen eine Richtung treffen,
während beide Figuren in Bewegung waren. Jetzt sucht die Simulation das Ziel.
Von Hand gezielt wird nur noch dort, wo es eine echte Entscheidung ist – bei
Fähigkeit und Super.

**Der Zielhinweis zeigt die echten Zahlen, nicht ungefähre.** Jede Länge und
jeder Radius in `drawAbilityAim` kommt aus derselben Stelle, mit der die
Simulation rechnet (`ABILITIES` beziehungsweise `SUPERS`). Eine Anzeige, die
eine andere Reichweite zeigt als die, die wirkt, wäre schlimmer als gar keine:
Man würde ihr glauben und danebenzielen. Der Kreis der Splittergranate ist ihr
echter Schadensradius – wer darin steht, bekommt ab, wer daneben steht, nicht.

Wo es **nichts** zu zielen gibt, wird auch nichts angezeigt: Die Heilung des
Tanks (`aimStyle: "self"`) wirkt auf ihn selbst, und ein Zielstrahl wäre dort
eine Linie, der man folgt, obwohl sie nichts bedeutet.

### Die zweite aktive Fähigkeit

Zusätzlich zum Super hat jeder Charakter eine zweite Fähigkeit mit fester
Abklingzeit. Unterschied zum Super: Der lädt sich über ausgeteilten Schaden auf
und ist der grosse Moment; diese hier soll laufend eingesetzt werden.

| Charakter | Fähigkeit | Wirkung | Abklingzeit |
| --------- | --------- | ------- | ----------- |
| Scout | **Splittergranate** | Wurf bis 400 px, Explosionsradius 140 px, 700 Schaden an jedem Gegner darin. Das Wurfgeschoss selbst macht keinen Schaden – der ganze Schaden steckt in der Explosion. | 7 s |
| Tank | **Zweite Luft** | Heilt sofort 1000 Lebenspunkte (von 4200). Kein Zielen. | 12 s |
| Sniper | **Lähmschuss** | Langsames Geschoss (300 px/s), 200 Schaden statt 900, wurzelt den Getroffenen 1,5 s fest. | 9 s |

#### Die Lehre aus dem zweiten Spieltest: Wirkung muss man **sehen**

Scout und Tank hatten vorher andere Fähigkeiten, und beide wurden mit „macht
keinen Sinn" bzw. „hat keine Wirkung" zurückgemeldet. Das Aufschlussreiche
daran: **Beide wirkten messbar.** Der Fehler lag nicht in der Rechnung.

- **Scout hatte eine Blendgranate.** Getroffene Gegner griffen 1,5 s nicht an.
  Nachgemessen in einer Runde mit fünf Läufern: Der erlittene Schaden
  **halbierte sich** (2400 → 1200), und alle fünf waren geblendet. Nur *sehen*
  konnte man davon nichts – die Gegner liefen unverändert weiter, nichts starb,
  nichts flog. Eine Wirkung, die man nicht sieht, ist im Gefecht keine: Man
  hält die Fähigkeit für kaputt und benutzt sie nicht mehr.
- **Tank hatte eine Schildwand**, die gegnerische Schüsse blockte. Sie passte
  aus zwei Gründen nicht zu ihm: Er kämpft auf 250 px mitten im Getümmel, und
  dort kommt der Schaden von Läufern, die ihn *berühren* – genau davor schützte
  die Wand nicht. Und sie verlangte Stellungsspiel (hinstellen, dahinter
  bleiben), während der Tank der Charakter ist, der das gerade *nicht* nötig
  haben soll.

Daraus die Leitregel, die jetzt oben in `systems/abilities.ts` steht:
**Eine Fähigkeit muss binnen einer Sekunde sichtbar sein.** Die Granate macht
jetzt Schaden – Gegner sterben. Der Tank heilt – der Lebensbalken springt hoch.

**Warum der Tank keine Schockwelle bekam**, obwohl das naheliegt: Sein Super
(Bodenstampfer) macht bereits Flächenschaden **mit** Rückstoss. Eine zweite
Fähigkeit derselben Art wäre nur eine schwächere Kopie davon gewesen. Heilung
ist im ganzen Spiel sonst nirgends zu haben – ausser über die Wiederbelebung.

#### Drei Entscheidungen, die im Code stehen

- **Die Explosion geht über `damageEnemy`**, nicht über `enemy.health -= x`.
  An dieser Funktion hängen Sniper-Markierung, Superladung, Punkte und
  Todesmeldung. Wer den Schaden von Hand abzieht, bekommt Gegner mit null Leben,
  die weiterlaufen.
- **Erst sammeln, dann Schaden machen.** `damageEnemy` kann töten, und ein
  toter Gegner wird sofort aus `state.enemies` entfernt. Würde `detonate`
  direkt über diese Liste laufen und dabei töten, rückten die folgenden
  Einträge eine Stelle vor – **jeder zweite Gegner im Radius bliebe
  unversehrt.** Das hätte sich als „die Granate trifft manchmal nicht alle"
  gezeigt und wäre schwer zu finden gewesen; `tests/systems/abilities.test.ts`
  prüft deshalb ausdrücklich drei Gegner auf einmal.
- **Die Granate läuft über den normalen Projektilweg**, nicht als Sonderfall.
  So gelten dieselbe Flugbahnprüfung und dieselben Wände wie für alles andere,
  und ein Wurf hinter eine Deckung ist unmöglich. Sie wirkt auch dort, wo sie
  auf eine Wand trifft oder ihre Wurfweite aufbraucht – sonst wäre ein Wurf ins
  Leere wirkungslos, obwohl Gegner danebenstehen.
- **Der Schaden fällt im ganzen Radius gleich hoch aus**, ohne Abschwächung
  nach aussen. Der Zielkreis am Knopf zeigt genau diesen Radius; eine
  Abschwächung hiesse, dass der Kreis etwas anderes verspricht, als er hält.
- **Gemeldet wird die echte Heilung, nicht der Tabellenwert.** Bei fast vollem
  Leben schwebt `+100` über der Figur, nicht `+1000`.

**Gewurzelt und betäubt sind weiterhin verschieden**, und das ist Absicht:
Gewurzelt heisst „steht fest, greift weiter an", betäubt (Tank-Super) heisst
„tut gar nichts". In der Darstellung ist gewurzelt an kaltem Blau zu erkennen.
Die **Blendung ist samt Maschinerie entfernt** – mit der Blendgranate hatte sie
ihren einzigen Verwender verloren, und toter Code veraltet still.

Im Netzwerkprotokoll ist die Fähigkeit ein eigenes Feld (`ability` plus
`abilityAim`), genau wie der Super: einmaliger Wunsch, der zwischen zwei
Paketen nicht verlorengehen darf.

`tests/systems/abilities.test.ts` prüft die Wirkung, nicht die Darstellung –
darunter, dass die Granate schwache Gegner wirklich **tötet** (aus der Liste
entfernt, mit Punkten) statt sie auf null Leben zu setzen.

### Pause: anhalten und weiterspielen

**Der Fehler, den das behebt:** Oben rechts sass ein Knopf „Menü", der die
Runde **sofort beendete**. Wer nur kurz aufhören wollte, verlor damit alles und
musste von vorn anfangen. Genau das kam als „es soll möglich sein Pause zu
machen und danach weiter zu spielen" zurück.

Der Knopf öffnet jetzt **immer** einen Zwischenbildschirm; aufgeben kann man
danach immer noch, aber erst nach einem zweiten, ausdrücklichen Antippen.

**Nachtrag: Im Koop war der alte Weg zuerst stehengeblieben.** Weil Anhalten
dort nicht geht, gab es auch keine Rückfrage – der Knopf warf einen weiterhin
ohne Warnung aus der Runde. Das war ein Trugschluss: **Die Rückfrage braucht
gar kein Anhalten, sie braucht nur eine Anzeige.** Deshalb sind beides jetzt
zwei getrennte Dinge (`GameScene.overlayOpen` gegen `GameScene.paused`), und
nur das zweite hängt an `canPause`.

| | Solo | Koop |
| --- | --- | --- |
| Knopf heisst | Pause | Menü |
| Titel | Pause | Menü |
| Hinweis | „Die Runde wartet auf dich" | „**Achtung: Die Runde läuft weiter** – im Koop rechnet der Host für alle." (gelb) |
| Knöpfe | Weiter · Runde beenden | Weiter spielen · Runde verlassen |
| Simulation | angehalten | läuft weiter |
| Hintergrund | dicht (0,82) | durchscheinend (0,58) – man soll sehen, dass es weitergeht |

**Die Beschriftung sagt die Wahrheit, auch wenn sie unbequem ist.** Im Koop
steht dort „Menü" und nicht „Pause", und der Hinweis warnt ausdrücklich. Ein
Knopf, der Pause verspricht und keine macht, wäre schlimmer als der alte
Zustand gewesen – man würde sich darauf verlassen. Beim Nachstellen mit zwei
Tabs ist genau das passiert: Der Spieler ging zu Boden, während der
Zwischenbildschirm offen war. Der Hinweis ist also keine Zierde.

**Während der Bildschirm offen ist, bekommt die Simulation eine LEERE Eingabe**
(`emptyInput()`). Der dunkle Hintergrund liegt zwar über den Knöpfen, aber die
Touch-Steuerung hört auf die ganze Szene – ein Daumen, der auf „Weiter spielen"
zielt, würde sonst nebenbei den Joystick ziehen oder einen Schuss auslösen.
Stehenbleiben ist das ehrlichere Verhalten: Man spielt gerade nicht.

- **Angehalten heisst: die Simulation bekommt keine Zeit mehr zugeteilt**
  (`GameScene.paused`). Gezeichnet wird weiter – ein eingefrorenes Bild gehört
  zur Pause, ein schwarzer Bildschirm nicht. Nachgemessen im Emulator: Zwei
  Bildschirmfotos im Abstand von drei Sekunden sind **Pixel für Pixel
  identisch**; ohne Pause sind sie es nicht.
- **Auch die App im Hintergrund hält an.** Ein Anruf, eine Nachricht, kurz
  etwas nachschauen – vorher lief die Runde dabei weiter, und man kam mit
  deutlich weniger Leben zurück oder gar nicht. Jetzt hört `visibilitychange`
  mit; zurück kommt man von Hand über „Weiter".
- **Angehalten wird nur solo** (`GameSession.canPause`). Im Koop rechnet der
  Host für alle weiter; ein Gerät, das für sich anhält, müsste beim
  Weitermachen entweder minutenlang nachrechnen oder springen. Die Spielszene
  fragt dafür die Sitzung, statt selbst nach dem Modus zu schauen – sie soll
  weiterhin nicht wissen, ob solo, als Host oder als Client gespielt wird. Die
  HUD-Szene fragt gar nicht: Sie zeigt an, was ihr gesagt wird.
- **Einmalige Wünsche werden in der Pause gelöscht.** Sonst läge ein Schuss aus
  dem Moment des Anhaltens bereit und ginge beim Weitermachen sofort los, ohne
  dass jemand den Knopf gedrückt hat.
- **Der Ton geht mit.** Musik in der Pause weiterlaufen zu lassen, während das
  Bild steht, klingt nach Absturz.
- **Das HUD ruht mit – aber nur solo.** Im Koop läuft die Runde weiter, also
  müssen Leben, Wellenzahl und Gegnerzahl weiterlaufen. Die Skill-Hinweiszeile
  wird deshalb nicht mehr über das Einfrieren unterdrückt, sondern über
  `overlayOpen`: Sonst blendete das weiterlaufende HUD sie jedes Bild wieder
  ein, und sie flackerte mitten durch die Schrift.

**Stolperstein beim Bauen, der beinahe durchgerutscht wäre:** Das Pausenbild
wird einmal im `create()` der HUD-Szene gebaut und danach nur ein- und
ausgeblendet. Der Aufruf stand zuerst zu früh – vor der Skill-Hinweiszeile, die
er ausblenden will. Ergebnis war ein Abbruch mit „Cannot read properties of
undefined", und zwar *nur im echten Spiel*, nicht in den Tests. Gefunden hat
ihn erst der Durchlauf im Browser-Emulator.

### Pixel Art: das Kenney-Paket

Seit dem 2026-09-18 kommen Figuren und Arena aus **"Topdown Shooter Pixel"**
von Kenney (CC0, `public/assets/`). Alles steht in **einer** Datei:
`src/config/assets.ts`. Im Spielcode steht nur `CHARACTER_TILES.scout`, nie
eine Zahl - wer das Paket wechselt, ändert diese Datei und sonst nichts.

**Kein Atlas, sondern ein Spritesheet.** Das Paket bringt **keine Datei mit
Koordinaten** mit (kein XML, kein JSON) - nur Lizenz, zwei Vorschaubilder und
die Sheets. `load.atlasXML` fällt damit weg. Stattdessen ein gleichmässiges
Raster, das sich nachrechnen lässt:

```
577 = 34 × (16 + 1) − 1        339 = 20 × (16 + 1) − 1
→ 16×16-Kacheln, 1 px Abstand, kein Rand, 34 × 20 = 680 Kacheln
```

`tile(spalte, reihe)` rechnet das in die Nummer um, die Phaser benutzt - so
stehen in der Zuordnung Koordinaten statt Zahlen wie 64.

#### Die Zuordnung

Auf dem Sheet ist die **Spalte die Waffe** und die **Reihe das Outfit**. Beides
wird genutzt: Farbe allein reicht bei 16 Pixeln nicht.

| | Kachel | Aussehen |
| --- | --- | --- |
| Scout | (30, 1) | blau, kurze Waffe |
| Tank | (32, 2) | orange, grosse quer gehaltene Waffe |
| Sniper | (33, 3) | grün, längster Lauf |
| Läufer | (28, 7) | braun-grün gefleckt, **ohne Waffe** |
| Brocken | (29, 15) | dunkel mit Grün, Arme vor |
| Schütze | (31, 6) | Tarnfarben, **mit Gewehr** |

**Das Paket enthält keine Monster.** Alle 96 Figuren sind derselbe Mensch in
anderer Kleidung - keine Zombies, keine Kreaturen, keine Grössenvarianten.
Unterschieden wird deshalb über Farbe, **Bewaffnung** und Grösse. Die
Bewaffnung trägt dabei die Bedeutung: Wer keine Waffe hat, macht
Berührungsschaden und muss zu einem hin; wer eine hat, schiesst aus der Ferne.
Das liest man ohne Erklärung.

#### Drei Dinge, die gemessen wurden statt geraten

1. **Die Figurengrösse.** Bei allen Figuren belegt der Körper senkrecht genau
   die Pixel 2 bis 13, also **12 Pixel**. Die Breite schwankt (8 px ohne Waffe
   bis 15 px mit langem Lauf) und taugt deshalb nicht als Mass.
   `SPRITE_BODY_RADIUS = 6` sorgt dafür, dass die Höhe der Figur genau dem
   Durchmesser des Trefferkreises entspricht - was man sieht, ist auch das, was
   getroffen wird. Für Spieler und Schütze (Radius 18) ergibt das glatt ×3.
2. **Der Weltmassstab muss dazu passen** (`WORLD_SCALE = 3`). Beim ersten
   Versuch wurden Figuren dreifach, Boden und Kisten aber 1:1 gezeichnet.
   Ergebnis: Ein Buschfeld von 180×140 px bestand aus rund hundert
   Miniatursträuchern und sah aus wie gemusterte Tapete, und die Figur war
   grösser als eine Bodenkachel. In Kenneys Vorlage ist eine Figur etwa eine
   Kachel gross - also bekommt die Welt denselben Faktor.
3. **Die Buschfelder sind Gras, nicht die Buschkacheln.** Das klingt verkehrt
   und ist gemessen: Die Buschkacheln (18,6) und (19,6) sind **Viertelstücke**
   eines grossen Busches und decken einzeln gekachelt nur **54 %** ihrer
   Fläche - dazwischen klaffen Lücken. Die Graskacheln decken **100 %** und
   wirken als Fläche wie hohes Gras: genau das Bild aus Brawl Stars, das ohne
   Erklärung sagt „da kann man drin verschwinden".

Deshalb ist der **Boden nicht Gras**: Grün hat eine feste Bedeutung - „hier
kann man sich verstecken". Wäre auch der Boden grün, ginge sie verloren, und
Lebensbalken und Namen hätten weniger Kontrast.

#### Der dünne Streifen neben jeder Deckung – und warum er kein Bluten war

Nach dem Spieltest kam: „Neben jeder Kiste ist ein dünner Streifen des
Nachbar-Sprites sichtbar." Die naheliegende Erklärung wäre Textur-Bluten beim
Zerschneiden des Sheets. **Sie war falsch**, und das liess sich belegen statt
vermuten:

- Es gibt **keine Koordinatendatei** – ein Off-by-one darin ist unmöglich.
- `tileSprite` **kopiert nur den einen Frame** in eine eigene 16×16-Leinwand
  (`drawImage(..., frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, ...)`).
  Aus dem Sheet kann nichts hineinbluten.
- Der Filter steht **bereits auf NEAREST**: `canvasToTexture` setzt ihn, solange
  `antialias: false` – und das ist gesetzt.

Die echte Ursache ist Arithmetik: Ein Deckungsblock ist **60 px** breit, eine
Kachel erscheint mit **48 px** (16 × `WORLD_SCALE`).

```
60 / 48 = 1,25   →   die letzte Kachel wird bei einem Viertel abgeschnitten
```

Bei einer Kachel **mit Rahmen** – dort lag eine Holzkiste – sieht man diesen
Schnitt sofort: Der Rahmen fehlt plötzlich und man blickt auf das nackte
Innere. Das ist der „Streifen".

**Zwei Wege wären falsch gewesen.** Die Blöcke auf ein Vielfaches von 48 zu
bringen, hätte Spielwerte geändert, die Kollision und Balance bestimmen und die
gemessen sind – Optik ist kein Grund, daran zu drehen. Und das Zeichnen aufs
Raster zu schnappen, hätte Bild und Trefferfläche auseinanderlaufen lassen.

**Die Lösung sind nahtlose Kacheln plus ein gezeichneter Umriss:** Bei einer
nahtlosen Textur fällt derselbe Schnitt gar nicht auf, und der Umriss liegt
**immer genau auf der Kollisionskante** – unabhängig davon, wo die Kachel
endet. Was man sieht, ist auch das, wogegen man läuft.

| | Kachel | |
| --- | --- | --- |
| Boden | (4,0)/(5,0) | warmer Sand statt kühlem Stein |
| Aussenmauer | (8,0) | kühler Stein – hebt sich vom Sand ab |
| Deckung | (14,2) | rote Ziegel, nahtlos, mit Umriss |

#### Was NICHT geändert wurde, und warum

Zwei weitere Punkte aus derselben Rückmeldung haben sich als Missverständnis
erwiesen:

- **„Die Arena wird am Bildrand angeschnitten, zeig sie ganz."** Die Kamera hat
  bereits `setBounds(0, 0, 1600, 1200)` – sie zeigt nie über die Arena hinaus.
  Angeschnittene Kacheln am Bildrand sind bei einer mitscrollenden Kamera
  normal. Die ganze Arena (1600×1200) in die Zeichenfläche (1169×540) zu
  zwingen hiesse Zoomfaktor 0,45: Der Spieler wäre dann rund 16 Pixel gross.
- **„Das HUD überlappt die Spielwelt."** Es liegt bereits in einer eigenen,
  fest verankerten Szene (`HudScene`) – genau wie gefordert. Dass die Welt
  darunter durchscrollt, ist das Wesen eines HUD.
- **„Die Buschflächen wirken zufällig platziert."** Sie stehen an vier
  symmetrischen Stellen und sind seit dem Wechsel auf Graskacheln geschlossene
  Rechtecke. Eine separate Tiled-Datei würde die Arena ein zweites Mal
  beschreiben – die Arena war die Quelle, aus der die Simulation rechnete, und
  zwei Beschreibungen derselben Karte laufen früher oder später auseinander.
  *(Seit Phase 8 gibt es überhaupt keine feste Karte mehr; sie entsteht aus
  einem Seed.)*

#### Was sonst noch dranhing

- **`pixelArt: true` und `roundPixels: true`** in der Phaser-Konfiguration.
  Ohne das erste wird ein dreifach vergrössertes 16-px-Sprite matschig, weil
  der Browser Zwischenfarben ausrechnet; ohne das zweite flimmern die Kanten
  bei langsamer Bewegung. Dafür sind `antialias: true` und
  `roundPixels: false` gewichen, die gegen Weisspixel an gezeichneten Formen
  standen - diese Formen sind grösstenteils weg.
- **Der Pfad braucht `import.meta.env.BASE_URL`.** Auf GitHub Pages liegt das
  Spiel unter `/Holdout/`; ein Pfad, der mit `/assets/...` beginnt, zeigte dort
  ins Leere. Genau dieser Fehler hat das Projekt schon einmal lahmgelegt.
- **Die Karten im Menü zeigen dieselben Sprites** wie das Spiel. Sonst wäre die
  Auswahl eine Lüge: Man sähe etwas anderes, als man danach steuert.
- **Projektile, Funken und Punkte bleiben gezeichnet.** Das Paket hat dafür
  nichts Passendes, und abstrakte Punkte passen in jeden Stil.
- **Deckung und Aussenmauer sehen verschieden aus** (Holzkiste gegen
  Steinwand), obwohl die Simulation beides als dasselbe Rechteck kennt. Rein
  optisch - hinter der Aussenmauer steht nie jemand, hinter einer Kiste
  ständig.

**Erledigt am 2026-09-23:** `BRIEFING.md` Abschnitt 7 nennt jetzt das
Kenney-Pixel-Paket statt der Cartoon-Pakete. Einziger Rest: Der Abschnitt sagt
weiterhin, man solle „die dazugehörige Koordinatendatei prüfen" – die gibt es
in diesem Paket nicht, deshalb Spritesheet statt Atlas (siehe oben).

### Musik: der Wechsel ist das Signal

Zwei Stücke, vom Nutzer geliefert (`public/assets/audio/`), Pfade in
`config/assets.ts`:

| Wann | Stück | Lautstärke |
| --- | --- | --- |
| Menü und Lobby | `menu.ogg` (Retro Mystic) | voll |
| **Gegner in der Nähe** | `wave.ogg` (Retro Comedy) | voll |
| Länger kein Gegner in der Nähe | `menu.ogg`, das ruhige Stück | **leise** (35 %) |
| Pausenbildschirm (nur solo) | nichts | – |

*(Bis Phase 8 hing die Regel an der Rundenphase – „leise in der Pause zwischen
zwei Wellen". Mit den Wellen ist dieser Auslöser weggefallen, siehe „Phase 8"
weiter unten.)*

**Zwei Korrekturen des Nutzers stecken in dieser Tabelle**, und beide waren
Annahmen von mir, keine Vorgaben:

1. Die Zuordnung war zuerst vertauscht („du hast die sound falschherum
   gebaut"). Retro Mystic ist das getragene Stück und gehört ins Menü, Retro
   Comedy das treibende und gehört ins Gefecht.
2. Zwischen den Wellen war zuerst **Stille** vorgesehen – die Stille selbst
   sollte das Signal sein. Der Nutzer wollte stattdessen leise Musik
   („zwischen den Wellen braucht es doch Musik, aber leiser und nicht die
   Wellenmusik").

**Welche Datei welches Stück ist, steht nicht mehr zur Debatte – es ist
gemessen.** Beide Dateien heissen `menu.ogg` und `wave.ogg` und tragen keinen
Titel in sich; die ursprünglichen Namen sind nie im Repo gelandet. Statt zu
raten, wurden sie in Chromium dekodiert und ausgewertet:

| Datei | Dauer | Anschläge/s | Helligkeit | also |
| --- | --- | --- | --- | --- |
| `menu.ogg` | **48 s** | 1,1 | 576 Hz | langsam, dunkel, getragen → **Retro Mystic** |
| `wave.ogg` | **6 s** | 6,7 | 772 Hz | hektisch, hell, kurz → **Retro Comedy** |

Wer die Zuordnung künftig anzweifelt, misst nach, statt die Dateien erneut zu
tauschen – genau das wäre hier beinahe passiert und hätte den richtigen Stand
wieder kaputtgemacht. Der eigentliche Fehler lag nicht in der Zuordnung,
sondern beim Service Worker (siehe „Nicht jede Datei kam beim Update mit").

**Damit trägt jetzt der WECHSEL das Signal, nicht die Stille** – und zwar
doppelt: anderes Stück **und** andere Lautstärke. Nur eines von beidem wäre zu
wenig. Dasselbe Stück leise und laut wechselt zu unauffällig, und ein anderes
Stück auf gleicher Lautstärke hört man im Gefecht nicht heraus. So merkt man
den Wellenstart auch dann, wenn man gerade nicht auf den Bildschirm schaut.

**Die Lautstärke ist ein zweiter Parameter, kein zweiter Schalter**
(`audio.setMusic(track, volume)`, Grundlautstärke × Faktor). Zwei Folgen im
Code, beide Fallen:

- Der Vergleich „ändert sich überhaupt etwas?" muss **beides** prüfen.
  Verglichen er nur das Stück, bliebe beim Wechsel Menü → Pause die volle
  Lautstärke stehen, und der Unterschied wäre weg.
- `applyMusic()` setzt `element.volume` bei **jedem** Aufruf neu, nicht nur
  beim Anlegen. Sonst behielte das Element den zuletzt gesetzten Wert.

**Zusätzlich hat jetzt jeder Wellenstart UND jedes Wellenende einen Klang**
(die synthetisierten, wie vorher): `waveStart` als tiefer Stoss, `waveCleared`
als steigender Dreiklang (523/659/784 Hz). Dafür meldet die Simulation ein
eigenes Ereignis `waveCleared` – die Darstellung liest es nur ab, entschieden
wird es in `systems/spawning.ts` (Architektur-Grundregel).

**Eine Stelle statt zwei.** Früher gab es `startMusic()` und `stopMusic()`;
mit zwei Schaltern und vier Szenen, die sie rufen, war schwer zu sagen, was
gerade laufen sollte. Jetzt gibt es nur `audio.setMusic(...)`. Die Spielszene
ruft das jedes Bild aus der Rundenphase heraus – `setMusic` prüft selbst, ob
sich etwas ändert, und tut sonst nichts.

**Beim Wellenstart beginnt das Stück von vorn** (`currentTime = 0` beim
Anhalten). Eine Welle soll mit ihrem Anfang beginnen, nicht dort weitermachen,
wo die vorige aufgehört hat.

**Ogg ist nicht überall abspielbar, und das ist abgesichert.** Android kann es
seit jeher, **Safari auf dem iPhone erst ab 17.4** (März 2024). Auf einem
älteren iPhone bliebe es sonst stumm, ohne dass man den Grund sähe. Deshalb
prüft `canPlayOgg()` vorher mit `canPlayType`, und wenn der Browser nicht kann,
übernimmt der bisherige synthetisierte Akkordteppich – weniger schön, aber
besser als Stille.

**Im Browser nachgemessen** (über mitgeschriebene `play()`/`pause()`-Aufrufe
samt `volume`, weil `new Audio(...)` ein Element ausserhalb des DOM erzeugt und
mit `querySelectorAll` nicht zu finden ist). Gegner auf 1 Leben gesetzt, damit
mehrere Wellen in eine Messung passen:

```
1 Menue          laeuft: menu.ogg vol=0.50
2 Vorbereitung   laeuft: menu.ogg vol=0.17   (PAUSE wave , PLAY menu)
   +4s           laeuft: wave.ogg vol=0.50   <- Welle 1 beginnt
  +10s           laeuft: menu.ogg vol=0.17   <- Welle 1 geschafft
  +20s           laeuft: wave.ogg vol=0.50   <- Welle 2
  +28s           laeuft: menu.ogg vol=0.17
```

0,17 ist 0,5 × 0,35 – Grundlautstärke mal `BREAK_MUSIC_VOLUME` aus
`GameScene`.

### Phase 8: die Welt entsteht aus einer Zahl

Die feste Arena (1600×1200, acht Deckungsblöcke von Hand gesetzt) ist weg.
Jeder Run bekommt einen **Seed**, und daraus entsteht die komplette Karte:
`src/systems/WorldGenerator.ts`, phaserfrei wie alles unter `systems/`.

| | alt | neu |
| --- | --- | --- |
| Welt | 1600×1200, fest | **16000×16000**, generiert |
| Schwierigkeit | Wellennummer (Zeit) | **Distanz zum Start** (Ort) |
| Gegner | Wellenliste, dann Pause | **Zielbevölkerung** rund um die Spieler |
| Fortschritt | Welle geschafft | **neue Distanzzone erreicht** |
| Heilen | Pause zwischen den Wellen | **sichere Zone** um den Start |
| Punkte verteilen | in der Pause | **in der sicheren Zone** |

**Warum Distanz statt Zeit die eigentliche Änderung ist:** Früher stieg die
Schwierigkeit von selbst, und man konnte nichts dagegen tun ausser besser zu
spielen. Jetzt entscheidet das Team, wie gefährlich es wird – aus einem
Schicksal wird eine Entscheidung. Das ist der Kern des ganzen Umbaus.

#### Der Seed war schon halb verdrahtet – und genau dort lag eine Falle

`Lobby.ts` würfelte längst einen Seed und schickte ihn im `start`-Paket an
alle; Host und Solo reichten ihn an `createWorld` weiter. **Der Client nicht.**
`ClientSession` erzeugte seine `ClientView` ohne Seed, und die rief
`createWorld(setups)` mit dem Standardwert 1.

Solange die Arena eine Konstante war, war das harmlos – jeder hatte dieselben
zwölf Rechtecke. Mit der Generierung hätte derselbe Code dazu geführt, dass der
Client **eine andere Karte baut als der Host**: Er liefe gegen unsichtbare
Wände, während die anderen ihn durch Deckung laufen sähen. Eine Zeile, aber
eine, die erst in Phase 16 aufgefallen wäre.

#### Zwei Zufallsströme aus einem Seed

Der Generator hat einen **eigenen** Zufallszustand und fasst den des Spiels
(`WorldState.rngState`) nicht an. `gameplaySeed()` leitet den zweiten ab.

Würfelte die Weltgenerierung aus demselben Strom, würde **ein zusätzlicher
Deckungsblock jede spätere Zufallszahl im Spiel verschieben** – Streuung,
Spawnpositionen, alles. Und Host und Client müssten für immer exakt gleich
viele Zahlen ziehen, auch in Code, der mit der Welt nichts zu tun hat.

Der Generator selbst ist weiterhin **Mulberry32 aus `systems/rng.ts`** – kein
neues Paket. `seedrandom` wäre eine Abhängigkeit für sechs Zeilen gewesen, die
schon dastanden und getestet waren.

#### Der Zusammenhang der Karte ist gebaut, nicht gehofft

Zufällig gestreute Rechtecke können eine Fläche einschliessen – ab Phase 10
läge dort Loot, an das niemand herankommt. Statt hinterher zu prüfen und neu zu
würfeln, macht es der **Aufbau unmöglich**: Jedes Hindernis liegt vollständig
in einer Rasterzelle (800 px) und hält `minGap/2` Abstand zu deren Rand.
Zwischen zwei Zellen bleibt damit immer eine Gasse von 160 px – der Spieler ist
36 px dick.

Geprüft wird es trotzdem, mit einer **Flutfüllung** über fünf Seeds
(`tests/systems/worldGenerator.test.ts`):

```
Seed        1: 93.3 % der Karte begehbar, davon erreichbar 100.0 %
Seed       42: 93.4 % der Karte begehbar, davon erreichbar 100.0 %
Seed     4242: 93.7 % der Karte begehbar, davon erreichbar 100.0 %
```

Die erste Zahl ist **die Absicherung gegen einen stillen Fehlschlag**: Wäre
fast alles blockiert, bestünde die zweite Prüfung trivial. Eine Karte, auf der
man sich nicht bewegen kann, ist kein bestandener Test.

#### Drei Zahlen, die gemessen und dann korrigiert wurden

1. **Weltgrösse 9600 → 16000.** Bei 9600 lagen vom Start in der Mitte nur 4800
   px bis zum Rand, also sechs Zonen – der Bot erreichte in **allen fünf**
   Durchläufen genau Zone 5 und stand dann an der Mauer. Gemessen wurde damit
   nicht die Schwierigkeit, sondern die Kartengrösse. 16000 ergibt zehn Zonen,
   beim tiefsten Gegner also Faktor 1,08¹⁰ = 2,16 auf das Leben – genau das,
   was früher Welle 10 war.
2. **Gegnerzahl 3+1,6 → 4+2,5 je Zone.** Vorher waren zu keinem Zeitpunkt mehr
   als neun Gegner gleichzeitig unterwegs; die alten Wellen brachten über
   zwanzig. Die Welt wirkte leer.
3. **Deckungsdichte.** Die alte Arena hatte einen Block je 0,24 Mio. px². Der
   erste Wurf ergab einen je 0,82 Mio. – gut dreimal so dünn, und im Bild
   deutlich zu sehen. Jetzt liegt sie wieder in derselben Grössenordnung.

#### Der Verdacht, der sich als falsch erwies

Aus 12 Rechtecken wurden über 500, und Wände werden in den heissesten
Schleifen **linear** durchlaufen (`collision.ts`, `projectiles.ts`). Das klang
nach einem Leistungsproblem, das einen Wandindex nötig macht.

Gemessen (`tests/systems/tickCost.test.ts`):

```
Welt 16000 px, 552 Waende, 7 Gegner: 0.157 ms je Tick (Budget 33 ms)
```

Ein halbes Prozent des Budgets. **Der Index wäre reine Beschäftigung gewesen.**
Die Grenze aus dem Briefing (Abschnitt 7) ist die Anzahl gleichzeitig aktiver
Objekte, nicht die Fläche – und die bleibt bei 40 Gegnern.

#### Was mit der Fläche wirklich wächst: das Zeichnen

Der Boden wird in Felder von 1200 px zerlegt, und `ArenaRenderer.update()`
blendet je Bild ein, was im Sichtfeld liegt. Damit hängen die Zeichenkosten an
der Bildschirmgrösse statt an der Weltgrösse. Dasselbe gilt für Deckung und
Büsche; die Umrisse der Deckungsblöcke werden nur für sichtbare Blöcke neu
gezeichnet.

**Aussenmauer und Deckung unterscheidet der Renderer jetzt an der Lage:** Was
den Kartenrand berührt, ist Mauer, alles andere ist Deckung. Früher gab es dafür
die feste Liste `COVER_BLOCKS`; die ist mit der Generierung verschwunden. Der
neue Weg braucht keine zusätzlichen Daten und kann deshalb nicht mit ihnen
auseinanderlaufen.

#### Zwei Ersatzteile für Dinge, die mit den Wellen weggefallen sind

- **Heilen.** Die Pause zwischen zwei Wellen heilte 60 % des Lebens. Ohne
  Ersatz gäbe es im ganzen Run keine Heilung ausser der Tank-Fähigkeit, und
  jeder Run endete zwangsläufig nach wenigen Minuten. Jetzt heilt der sichere
  Ring um den Startpunkt (10 % je Sekunde). Der Weg zurück kostet Zeit – und
  ist damit die kleine Schwester der Entscheidung, um die sich alles dreht.
- ~~**Skillpunkte verteilen.**~~ – mitsamt dem Skillpunkte-System in Etappe 1
  entfernt.

**Die Heilung ist meine Ergänzung, nicht aus dem Briefing.** Sie füllen
Lücken, die der Wegfall der Wellen gerissen hat. Wenn sie nicht gefallen, ist
das kein Widerspruch zum Plan – dann raus damit.

#### Die Musikregel hing an den Wellen und hängt jetzt am Gefecht

„Leise in der Pause, treibend in der Welle" hatte keinen Auslöser mehr. Jetzt
entscheidet die Lage: Gegner nah → treibendes Stück, volle Lautstärke; länger
keiner in der Nähe → ruhiges Stück, leise. **Zwei Schwellen statt einer** (900
px hinein, 1300 px und vier Sekunden hinaus), sonst schaltete ein Gegner, der
auf der Grenze herumläuft, die Musik im Sekundentakt um.

In der offenen Welt ist das sogar besser als vorher: Die Musik sagt einem, dass
etwas kommt, **bevor** man es sieht.

### Phase 9: Bosse, Encounter und der erste gute Ausgang

Bis Phase 8 endete ein Run nur auf eine Art: alle am Boden. Jetzt sind es drei.

| Ausgang | Auslöser | Ergebnisbildschirm |
| --- | --- | --- |
| `wipe` | alle gleichzeitig am Boden | „Team am Boden" (rot) |
| `extracted` | 5 s gemeinsam in einer Ausstiegszone | „Extrahiert" (grün) |
| `bossDefeated` | Ende-Boss besiegt | „Wächter besiegt" (gold) |

Deshalb heisst die Phase im Code jetzt `"ended"` und nicht mehr `"gameover"` –
ein Run kann gut ausgehen, und `WorldState.outcome` sagt wie.

#### Encounter stecken im Seed, ihr Zustand im Protokoll

`generateWorld` liefert zusätzlich `encounters` und `extractions`, gewürfelt
**nach** Wänden und Büschen. Diese Reihenfolge ist Teil der Zusicherung: Host
und Clients ziehen dieselben Zufallszahlen in derselben Folge und bekommen
dieselben Stellen – **übers Netz geht keine einzige Koordinate**, nur der
Zustand (`0 schlafend, 1 aktiv, 2 geschafft`) und der Extraktions-Countdown.

- Ein **Mini-Boss je Zone** ab Zone 2, auf dem Ring in der Zonenmitte.
- **Ein Ende-Boss** auf dem äussersten Ring, den die Karte hergibt.
- **Sechs Ausstiegszonen**, verteilt über Zone 1 bis 8.

**Der Startpunkt ist bewusst keine Ausstiegszone.** Sonst wäre die
Entscheidung, um die sich der Run dreht, geschenkt: hinauslaufen, umdrehen,
raus.

**Ein Test hat hier einen echten Fehler gefunden:** Der Ende-Boss sass bei 85 %
des Maximalradius, die Mini-Bosse reichten aber bis 95 % – er war also *näher*
am Start als seine eigenen Vorstufen. Jetzt gehört ihm der äusserste Ring, und
die Mini-Bosse hören eine Zone davor auf.

#### Der Boss ist ein vierter Gegnertyp, kein neues System

`ENEMIES.boss` sind die Werte des **Mini-Bosses**; derselbe Typ mit
`isBoss: true` ist der **Ende-Boss** und bekommt über die längst vorhandene
Maschinerie fünffaches Leben, fünffache Punkte und doppelte Grösse. Eine zweite
Skalierungslogik wäre nur eine Stelle mehr, an der zwei Zahlen auseinanderlaufen.

**Zwei Angriffsmuster, die sich gegenseitig die Lücke schliessen:**

| Muster | Wirkung | Wann |
| --- | --- | --- |
| **Schockwelle** | 0,8 s Warnkreis, dann 900 Schaden im Radius 260 plus Rückstoss | jemand näher als 320 px |
| **Salve** | Fächer aus 5 langsamen Geschossen (300 px/s), 260 Schaden | alle weiter weg |

Mit nur einem der beiden hätte er einen toten Winkel: Bei bloss Fläche bliebe
man auf Abstand und er wäre harmlos, bei bloss Salve käme der Tank mit seinen
250 px Reichweite nie heran.

**Der Warnkreis ist der eigentliche Inhalt der Schockwelle.** In
`abilities.ts` steht die Regel „eine Fähigkeit muss binnen einer Sekunde
sichtbar sein"; beim Gegner gilt sie gespiegelt. Ein Treffer, den man nicht
kommen sieht, fühlt sich nicht schwer an, sondern unfair – man lernt nichts
daraus. Der angezeigte Radius **ist** der wirkende, und eine Betäubung bricht
eine begonnene Welle ab (sonst wäre der Kreis weg und der Schaden käme doch).

#### Vier Entscheidungen, die im Code stehen

- **Der Boss entsteht erst beim Betreten.** Läge er schlafend in
  `state.enemies`, hätte ihn `despawnDistant` sofort weggeräumt, und die
  Obergrenze von 40 Gegnern hätte sich mit Schläfern gefüllt. Bis dahin ist er
  nur ein Eintrag in einer Liste – sichtbar über den Ring am Boden.
- **Ein aktiver Boss wird nie despawnt und zählt nicht gegen die Obergrenze.**
  Sonst liesse sich jeder Encounter durch Weglaufen erledigen, und der
  Ende-Boss wäre gar nicht mehr zu besiegen.
- **Der Bosstod wird abgelesen, nicht gemeldet.** `killEnemy` Bescheid sagen zu
  lassen hätte einen Import-Zyklus ergeben (combat → encounters → enemies →
  boss → combat) und nur *einen* Weg abgedeckt. Jetzt zählt, was der Fall ist:
  Ist der Gegner weg, ist der Encounter geschafft.
- **Extrahieren geht nur, wenn ALLE in der Zone stehen – auch die Gefallenen.**
  „Alle Lebenden" hätte geheissen, dass man einen am Boden Liegenden einfach
  zurücklassen kann. So muss man ihn erst aufheben.

#### Zwei Fehler, die erst das Bild gezeigt hat

1. **Der Warnring war enger als seine Wirkung.** Ring 300, Auslöser 420 – der
   Boss erwachte, während man noch ausserhalb des Kreises stand. Es ist jetzt
   **eine** Zahl für beides.
2. **Die Boss-Kachel war ein Möbelstück.** `tile(30, 16)` sah im Sheet
   plausibel aus; Reihe 16 enthält aber keine Figuren. Im Spiel war der Boss
   ein dunkler Klotz. **Figuren liegen ausschliesslich in den Spalten 28–33 und
   den Reihen 0–15.** Der Boss ist jetzt violett (32, 4) – die einzige Farbe,
   die weder ein Spieler noch ein Gegner belegt.

#### Nebenbei: ein Schadensfaktor, der aus dem Leben abgeleitet war

`damageScale()` rechnete den Schadensfaktor als `maxHealth / Grundleben`. Das
ging gut, solange beide dasselbe waren – war aber schon vorher falsch (Leben
wächst 8 % je Zone, Schaden laut Briefing nur 4 %) und wäre beim Boss richtig
schiefgegangen: Dessen Leben ist zusätzlich verfünffacht, er hätte also mit
**fünffachem** Schaden geschossen. Der Faktor steht jetzt als eigenes Feld
`damageMultiplier` am Gegner.

**Folge:** Schützen machen etwas weniger Schaden als vorher, und der Bot kommt
entsprechend tiefer (Scout 5,4 → 7,0 Zonen).

#### Neu zum Nachstellen: `?seed=`

`.../Holdout/?seed=4242` erzwingt eine bestimmte Welt. Ohne das liesse sich ein
Fehler „beim Boss weiter draussen" nicht nachstellen – beim nächsten Start ist
die Karte eine andere. **Nur solo:** Im Koop gibt der Host den Seed vor.

### Bewegung: Kennlinie statt Schwelle, Achsen getrennt

Zwei Änderungen am Steuerungsgefühl, beide gemessen statt geschätzt.

**Die Joystick-Kennlinie** (`src/ui/stickResponse.ts`) bildet die Zugstrecke
des Daumens auf das Tempo ab. Vorher geradlinig: halber Ausschlag, halbes
Tempo. Das klingt richtig, fühlt sich aber grob an – schon ein kleiner Schubs
ist ein spürbarer Satz, und langsames Schleichen lässt sich kaum treffen. Jetzt
quadratisch (`TOUCH.responseCurve = 2`): halber Ausschlag ergibt 25 % Tempo,
volles Tempo gibt es weiterhin am Rand. Dazu Stickradius 78 → 64 (der Rand
liegt jetzt im natürlichen Schwenkbereich des Daumens) und tote Zone 10 → 6
(die Feinsteuerung macht die Kurve, nicht mehr ein breiter toter Bereich).

Die Funktion ist **bewusst phaserfrei und eigenständig**, damit sich die Kurve
im Test nachrechnen lässt statt nur auf dem Handy zu ahnen
(`tests/ui/stickResponse.test.ts`: kein Sprung grösser als 5 % Tempo je Pixel).

**Kollision getrennt nach Achsen** (`moveAndCollide` in `systems/collision.ts`):
erst X bewegen und prüfen, dann Y. Wird schräg gegen eine Wand gedrückt, ist
nur eine Achse blockiert – die andere kommt im **selben** Tick durch.

Das ist das übliche Muster aus Arcade-Physik. **Phaser Arcade Physics selbst
kommt dafür nicht in Frage**: Die Simulation muss ohne Phaser laufen (der Host
rechnet die Runde für alle, Tests spielen ganze Runden ohne Browser). Die
Rechnung je Achse ist geschlossen lösbar, also exakt und nicht geraten.

**Wichtig fürs Protokoll:** Ein Hängenbleiben an Wänden war *nicht*
reproduzierbar. `tests/systems/movementCollision.test.ts` misst es: Gleiten an
geraden Wänden 98–100 % des theoretischen Wegs, einmal um einen Deckungsblock
herum ohne einen einzigen Stillstand, an der echten Arena der schlechteste Tick
= volle Geschwindigkeit. Die Umstellung auf getrennte Achsen ist also Vorsorge,
keine Reparatur. Fühlt es sich weiterhin hakelig an, liegt es nicht an der
Kollision – dann zuerst die Eingabe verdächtigen.

**Was an gefühlter Verzögerung wirklich messbar war:** Die Kette lautet
Berührung → noch im selben Bild in eine Richtung umgerechnet (es gibt *keine*
Warteschlange) → bis zu ein Simulationsschritt Wartezeit (0–33 ms) →
Beschleunigung auf Vollgeschwindigkeit. Der letzte Posten war mit 100 ms länger
als die beiden davor zusammen und steht jetzt auf 60 ms
(`PLAYER.accelerationTime`). Nicht auf 0: Ohne jede Beschleunigung springt die
Figur zwischen Stillstand und Vollgas.

Steuerungswerte lassen sich jetzt ebenfalls ohne Neubau probieren:
`?tune=touch.responseCurve=1.5,touch.stickRadius=70,player.accelerationTime=0.04`

### Treffer werden auf der ganzen Flugstrecke geprüft

Der grösste Fund beim Überarbeiten des Schiessens, und er stand in keiner
Fehlermeldung: Ein Projektil fliegt 600 Pixel je Sekunde, ein Tick dauert eine
dreissigstel Sekunde - pro Schritt springt es also **20 Pixel** weit. Geprüft
wurde bisher nur der Endpunkt dieses Sprungs. Ein Läufer hat mit Projektil
zusammen 23 Pixel Trefferradius; alles, was den Rand streift, wurde damit rund
jedes fünfte Mal übersprungen. Der Schuss sass, gezählt wurde er nicht - und es
fühlte sich an wie „danebengezielt".

`systems/projectiles.ts` rechnet jetzt die Strecke als Linie gegen den Gegner
als Kreis (`sweepHitTime`, eine quadratische Gleichung, exakt und ohne
Abtasten). Wände werden abgetastet, in Schritten von höchstens einem
Projektilradius. Wer zuerst auf der Strecke liegt, wird zuerst getroffen -
sonst schösse man durch Deckung hindurch oder träfe den hinteren von zwei
Gegnern. `tests/systems/projectileSweep.test.ts` hält das fest; der erste Test
fällt auf dem alten Code durch.

**Nebenwirkung, die man kennen muss:** Auch Gegnerprojektile treffen jetzt
zuverlässig. Das Spiel ist dadurch messbar schwerer geworden - die
Balancing-Messung fiel beim Tank von 8,4 auf 6,6 Wellen.

### Sehen, womit gerechnet wird

`?debug=hitbox` an die Adresse gehängt zeichnet die Trefferradien als Umriss:
Spieler grün, Gegner rot, Projektile gelb samt der Strecke, die sie im nächsten
Tick zurücklegen. `?debug=werte` blendet Zahlen ein, `?debug=all` beides. Die
Radien werden aus dem Weltzustand gelesen, nicht noch einmal aufgeschrieben -
sonst zeigte die Anzeige etwas anderes an, als getroffen wird, und würde lügen
statt zu helfen. Ohne `?debug=` kostet das nichts (`platform/debugFlags.ts`).

Auf dem Handy gibt es keine Entwicklerwerkzeuge - die Adresszeile ist der
einzige Weg, im echten Spiel auf dem echten Gerät etwas sichtbar zu machen.

### Koop über zwei verschiedene Netze

Für eine Verbindung übers Internet braucht es **zwei** Dinge. Sie werden oft
verwechselt, und beide müssen stimmen (`src/net/peerConfig.ts`):

1. **Signalisierung – „wie finden wir uns?"** Ein kleiner Server, bei dem sich
   der Host unter seinem Raumcode anmeldet. Er vermittelt nur den Kontakt;
   Spieldaten laufen nie darüber. Fällt er aus, meldet PeerJS
   `peer-unavailable` – also „diesen Raum gibt es nicht", obwohl der Host
   danebensitzt.
2. **NAT-Durchstossung – „wie kommen wir aneinander vorbei?"** Beide Geräte
   stehen hinter einem Router, im Mobilfunk sogar hinter dem Netz des Anbieters
   (CGNAT). **STUN** sagt einem Gerät nur, wie es von aussen aussieht; **TURN**
   leitet die Daten über einen fremden Server weiter, wenn direkt nichts geht.

**Was gefehlt hat:** `new Peer(id)` wurde **ohne jede Konfiguration** aufgerufen.
Damit galten nur die eingebauten STUN-Server und **kein TURN**. Im selben WLAN
geht das meistens gut; über zwei verschiedene Netze – genau der Fall „Freund
kommt von zu Hause dazu" – scheitert es regelmässig, und zwar stumm: Der Raum
wird gefunden, aber der Datenkanal geht nie auf.

Jetzt sind STUN- und TURN-Server konfiguriert (Open Relay, öffentliche und
ausdrücklich zum Mitbenutzen gedachte Zugangsdaten – keine Geheimnisse). Drei
TURN-Einträge mit verschiedenen Ports und Protokollen, weil strenge Firewalls
oft nur 443 durchlassen und manche nur TCP.

**Zwei Signalisierungsserver statt einem.** Ein einzelner Gratis-Dienst ist ein
einzelner Ausfallpunkt, und sein Ausfall sieht für den Spieler genauso aus wie
ein falscher Raumcode. Sie werden der Reihe nach probiert.

**Wiederholversuche beim Beitreten.** Die Anmeldung des Hosts braucht beim
Server einen Moment. Wer sofort nach dem Vorlesen tippt, kann in genau dieses
Fenster geraten. Bei „nicht gefunden" wird deshalb bis zu dreimal mit 600 ms
Pause wiederholt, bevor die Meldung kommt.

**Vier Ursachen, vier Meldungen.** Vorher hiess jeder Fehlschlag sinngemäss
„Raum nicht gefunden". Jetzt unterscheidet `ConnectError`:

| Ursache | Was der Spieler liest |
| ------- | --------------------- |
| `signal-unreachable` | Der Verbindungsdienst ist nicht erreichbar – liegt nicht an dir und nicht am Raumcode |
| `room-not-found` | Kein Raum mit diesem Code – Tippfehler, oder der Host hat geschlossen |
| `no-direct-connection` | Raum gefunden, aber keine Verbindung zwischen den Geräten – meist Mobilfunk |
| `room-code-taken` | Dieser Code ist gerade belegt |

Die dritte Zeile ist die wichtige: Sie unterscheidet „falscher Code" von
„NAT-Problem", und nur mit dieser Unterscheidung weiss man, ob TURN hilft oder
ob man sich vertippt hat. Erkannt wird sie am ICE-Zustand: Sobald der auf
`checking` springt, ist der Raum gefunden. Springt er auf `failed`, wird sofort
abgebrochen statt zwölf Sekunden zu warten.

**Grenzen, die bleiben:** Der TURN-Dienst ist gratis und im Durchsatz begrenzt –
für zwei bis vier Spieler reicht das, für viele gleichzeitige Räume bräuchte es
einen eigenen. Und ein eigener Signalisierungsserver wäre die einzige Lösung,
die nicht von fremder Verfügbarkeit abhängt; er passt nur nicht zu „statische
Seite auf GitHub Pages".

#### Eigener TURN-Schlüssel statt geteiltem Gratis-Relay

Die Open-Relay-Daten in `peerConfig.ts` darf jeder mitbenutzen – und teilen
sich deshalb ein Kontingent mit allen anderen, die sie benutzen. Ist es
aufgebraucht, geht die Verbindung nicht mehr, und man sieht nicht warum. Mit
einem eigenen Schlüssel (metered.ca) gibt es ein eigenes Kontingent und eine
Nutzungsanzeige beim Anbieter.

`src/net/turnCredentials.ts` holt die Zugangsdaten beim Start ab:

```
https://<app-name>.metered.live/api/v1/turn/credentials?apiKey=<schlüssel>
```

Schlüssel und App-Name stehen in `.env` (`VITE_TURN_API_KEY`, `VITE_TURN_APP`),
Vorlage in `.env.example`. Für den Pages-Build liest der Workflow das Secret
`TURN_API_KEY`. **Fehlt beides, passiert nichts Schlimmes:** Dann gelten die
öffentlichen Open-Relay-Daten, und das Spiel läuft unverändert.

**Der Schlüssel ist in der ausgelieferten App NICHT geheim, und das lässt sich
auch nicht reparieren.** Vite setzt jeden `VITE_*`-Wert beim Bauen fest in das
JavaScript ein, das an die Handys geht; Holdout ist eine statische Seite ohne
eigenen Server, es gibt also keinen Ort, an dem ein Geheimnis bleiben könnte.
Nachgeprüft am fertigen Build:

```
$ grep -rl "<schlüssel>" dist/
dist/assets/index-COblGTJi.js
```

Was `.env` trotzdem bringt: Der Schlüssel steht nicht in der Git-Historie (dort
bekommt man ihn nie wieder heraus) und lässt sich beim Anbieter zurückziehen
und ersetzen. **Folge:** nur einen Schlüssel mit Gratis-Kontingent verwenden,
nie einen mit hinterlegter Zahlung, und die Nutzung gelegentlich ansehen.
Wirklich geheim ginge nur mit einem eigenen kleinen Server – und der passt
nicht zu „statische Seite auf GitHub Pages".

**Fällt der Abruf aus, wird nicht abgebrochen**, sondern auf die öffentlichen
Daten zurückgefallen. Eingeschränkt zu funktionieren ist besser, als wegen
einer fehlgeschlagenen Nebensächlichkeit gar nicht zu starten. Genau dieser
Fall liess sich hier im Echtbetrieb prüfen, weil der Proxy `metered.live`
sperrt:

```
TURN: Abruf fehlgeschlagen (Failed to fetch) - oeffentliche Daten
HOST: TURN-Schluessel eigener? ja
```

**Host und Client holen dieselben Server**, und zwar **vor** `new Peer(...)`:
Die ICE-Server bekommt eine Verbindung beim Erzeugen mit, nachtragen geht
nicht. Bekäme nur eine Seite TURN, fände auch nur eine Seite einen Weg.

#### Sehen, WELCHER Weg benutzt wird

Ohne diese Auskunft weiss man bei einer klappenden Verbindung nicht, ob TURN
gegriffen hat oder ob es auch ohne gegangen wäre – und bei einer scheiternden
nicht, ob TURN überhaupt versucht wurde. Man ändert dann Dinge auf Verdacht.

`src/net/connectionPath.ts` liest nach dem Verbinden über
`RTCPeerConnection.getStats()` das **benutzte** Kandidatenpaar aus:

| Typ | Bedeutung |
| --- | --------- |
| `host` | Adresse im lokalen Netz – nur im selben WLAN |
| `srflx` | über STUN gefundene Aussenadresse – direkt übers Internet |
| `prflx` | unterwegs entdeckt, ebenfalls direkt |
| `relay` | **über TURN** – die Daten laufen über fremde Rechner |

Steht auf **einer** der beiden Seiten `relay`, läuft die Verbindung über TURN.
Angezeigt wird es in der Lobby („Verbindung direkt zwischen den Geräten" bzw.
„Verbindung über TURN-Relay") und ausführlich unter `?debug=netz`.

**Zwei Fallen, die im Code stehen:**

- **Nur das nominierte Paar zählt.** Es gibt mehrere geprüfte Paare; wer das
  erstbeste nimmt, meldet womöglich TURN, obwohl direkt verbunden wird.
  `tests/net/connectionPath.test.ts` prüft genau das mit einem zweiten,
  gescheiterten Relay-Paar im Aufbau.
- **Der Datenkanal ist offen, bevor die Zahlen da sind.** Einmal fragen liefert
  oft noch nichts – deshalb dreimal im Abstand von 400 ms.

Geprüft ist das nicht nur gegen nachgebaute Statistiken, sondern gegen eine
**echte** WebRTC-Verbindung: zwei `RTCPeerConnection` in einer Seite, direkt
verdrahtet. Ergebnis: `kind = direkt`, `lokal host/lokales Netz, entfernt
host/lokales Netz`. Der `relay`-Fall lässt sich hier nicht herstellen – dafür
braucht es zwei Geräte in verschiedenen Netzen.

## Der Name

Das Spiel heisst **Holdout**. Umbenannt wurde alles Sichtbare: Browser-Titel,
PWA-Manifest, Menü, Sperrseite, Android-App, APK-Dateiname, Release-Titel.

Drei Dinge behalten bewusst den alten Namen:

| Was                       | Wert                                             | Warum                                                                                                                                                |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android-`applicationId`   | `ch.thcjk.arenashooter`                          | Ändert man sie, ist es für Android eine andere App - Updates über die installierte Version gehen dann nicht mehr.                                    |
| Speicherschlüssel         | `arena-shooter.highscore`, `arena-shooter.muted` | Ein neuer Schlüssel bedeutet: Rekord weg, Ton-Einstellung weg.                                                                                       |
| Peer-Präfix und Kanalname | `koop-arena-`                                    | Sichtbar ist davon nichts. Eine Änderung würde nur bewirken, dass zwei Geräte mit unterschiedlichen Versionen sich nicht mehr im selben Raum finden. |

## Die Architektur-Grundregel

**Spiellogik und Darstellung sind strikt getrennt.** Das ist die eine Entscheidung,
die man später nicht mehr billig nachholen kann.

- Alles unter `src/systems/` ist **reine Logik auf Datenobjekten** und
  **importiert nichts aus Phaser**. Der Host rechnet damit die Runde für alle,
  und Tests spielen damit ganze Runden ohne Browser durch
  (`tests/systems/round.test.ts`).
- `src/render/` und `src/scenes/` zeichnen nur. Sie lesen den Zustand und stellen
  ihn dar; sie entscheiden nichts über Positionen, Leben oder Schaden.
- `src/input/` und `src/ui/` übersetzen Geräte-Eingaben in einen einheitlichen
  `InputState`. Die Simulation weiss nicht, ob eine Eingabe von Tastatur, Daumen
  oder aus dem Netz kommt - erst dadurch war Phase 6 überhaupt machbar.
- `src/net/` verbindet beides: `GameSession` ist die einzige Schnittstelle, die
  die Spielszene kennt. Ob solo, als Host oder als Client gespielt wird, sieht
  sie nicht.

Vor jedem neuen Modul die Frage stellen: _Muss der Host das rechnen können, ohne
zu zeichnen?_ Wenn ja, gehört es nach `systems/`.

## Entscheidungen und Abweichungen vom Briefing

| Thema                 | Entscheidung                                                              | Warum                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phaser-Version        | Phaser 3 (3.90), nicht Phaser 4                                           | Briefing gibt Phaser 3 vor. Für Einsteiger zählt vor allem, dass Tutorials, Forenantworten und Beispiele passen - dieses Material gibt es fast ausschliesslich für Phaser 3.                                                                                                                                                           |
| Phaser Arcade Physics | Wird **nicht** benutzt                                                    | Das Briefing nennt Arcade Physics für die Gegner-KI (Abschnitt 4), aber die Architektur-Grundregel (Abschnitt 5) ist stärker: Die Simulation muss ohne Phaser laufen. Kollision Kreis gegen Rechteck steht deshalb selbst in `systems/collision.ts` - rund 60 Zeilen, testbar.                                                         |
| Sprites               | **Pixel Art von Kenney** (seit 2026-09-18). Projektile, Funken und Punkte bleiben gezeichnet | Ursprünglich alles gezeichnet, weil kenney.nl aus dieser Entwicklungsumgebung nicht erreichbar ist. Der Nutzer hat das Paket selbst ins Repo gelegt. Dass der Wechsel eine Datei war und keine fünfzig Fundstellen, lag genau an der damals gewählten Schnittstelle. Siehe „Pixel Art" unten. |
| Ton                   | Klangeffekte synthetisiert, **Musik als .ogg** (seit 2026-09-18)          | Effekte bleiben synthetisiert (kenney.nl war nicht erreichbar); gleiche Schnittstelle: Im Spielcode steht nur `audio.play("hit")`. Die zwei Musikstücke hat der Nutzer geliefert. Siehe „Musik" unten.                                                                                                                                  |
| HUD und Touch         | Eigene Szene (`HudScene`)                                                 | Die Spielkamera zoomt je nach Spielerabstand, und alles in ihrer Kamera zoomt mit - auch Text und Joysticks, die fest am Bildschirmrand kleben sollen. Eine zweite Szene hat ihre eigene Kamera ohne Zoom.                                                                                                                             |
| Spielerform           | Kreis statt Rechteck                                                      | Ein Kreis gleitet an Wänden und Ecken entlang, ein Rechteck verhakt sich. Genau dieses Verhaken lässt Top-down-Steuerung zäh wirken.                                                                                                                                                                                                   |
| Rundenablauf          | Vorbereitung nur vor Welle 1, danach Welle → Pause → Welle                | Die Pause kündigt laut Briefing selbst die nächste Welle an. Eine zusätzliche Vorbereitung dazwischen wären 15 Sekunden Warten zwischen zwei Wellen.                                                                                                                                                                                   |
| Repo                  | Ersetzt den früheren Inhalt von `thistle-and-crown` (ein Babylon.js-MOBA) | So entschieden am 2026-09-17. Der alte Stand ist über die Git-Historie auf `main` erreichbar. Das Repo heisst inzwischen `Holdout`; der Basispfad wird deshalb aus dem Repo-Namen abgeleitet statt eingetragen.                                                                                                                                                                        |

## Projektstruktur

```
src/
  main.ts                 Phaser-Konfiguration, Szenenliste
  config/
    balance.ts            ALLE Spielwerte
    assets.ts             ALLE Sprites: Kachelnummern, Massstab, Zuordnung
    constants.ts          Arena, Bildschirm, Tickrate, Kamera, Touch, Farben
    tuning.ts             ?tune= aus der Adresszeile
  systems/                PHASER-FREI - die Simulation
    types.ts              Datentypen und Ereignisse
    world.ts              Weltzustand, ein Tick
    Simulation.ts         fester Zeitschritt + Interpolation
    movement.ts           Beschleunigung, Dash
    collision.ts          Kreis gegen Rechteck, Gleiten
    combat.ts             Schüsse, Munition, Schaden, Wiederbelebung
    projectiles.ts        Projektile mit Object Pooling
    enemies.ts            Gegner-KI, Sichtlinie
    supers.ts             die drei Super-Fähigkeiten
    WorldGenerator.ts     die Karte aus einem Seed (deterministisch)
    spawning.ts           Distanzformel, Zielbevölkerung, Rundenablauf
    targeting.ts          wer sieht wen
    rng.ts                wiederholbarer Zufall (Mulberry32)
  net/                    Koop
    protocol.ts           Nachrichten zwischen Host und Clients
    Transport.ts          Verbindungsschnittstelle
    PeerTransport.ts      WebRTC über PeerJS
    LocalTransport.ts     zwei Tabs desselben Browsers (ohne Server)
    Lobby.ts              Raum, Spielerliste, Start
    HostSession.ts        autoritative Simulation
    ClientSession.ts      Eingaben senden
    ClientView.ts         Interpolation und Vorhersage
    SoloSession.ts        Einzelspieler
    GameSession.ts        die Schnittstelle, die die Spielszene kennt
  render/                 Darstellung
    ArenaRenderer, EntityRenderer, CameraController, Juice
    wallPieces.ts         Wand -> Stuecke aus dem Sheet (Ecken, Kappen)
  scenes/                 Boot, Menu, Lobby, Game, Hud, GameOver
  input/InputManager.ts   Touch -> InputState
  ui/                     VirtualJoystick, TouchControls, SkillPanel, Button, HudModel
  audio/                  synthetisierte Klänge und Musik
  storage/highscore.ts    lokaler Rekord
  platform/               Geräte-Erkennung, Desktop-Sperre, Absturzanzeige,
                          Selbst-Aktualisierung, Installation
android/                  Capacitor-Projekt für die Android-App
tools/                    Hilfsskripte (App-Icons erzeugen)
tests/
  systems/                Simulation, inklusive ganzer Runden ohne Browser
  net/                    Protokoll, Raumcodes, Host und Client im selben Prozess
```

## Balancing

**Alle Spielwerte stehen in `src/config/balance.ts`.** Kein anderes Modul
verdrahtet Spielwerte fest.

### Zwei Messungen bei jedem `npm run test`

- `tests/systems/balanceProbe.test.ts` – die kurze: Wie weit kommt ein Bot je
  Charakter (fünf Durchläufe)?
- `tests/systems/balanceReport.test.ts` – das Protokoll: je Welle Dauer,
  ausgeteilter und erlittener Schaden, Kills, Leben danach. Dazu die
  rechnerische Zeit, einen Gegner zu töten. **Rechnerisch** heisst „wenn jede
  Kugel trifft" – beim Tank (34 Grad Streuung) ist das eine Wunschzahl,
  **gemessen** ist, was wirklich passiert ist.

Der Bot steht in `tests/bot.ts` und wird von beiden benutzt. Er ist absichtlich
mittelmässig, muss aber zwei Dinge können, sonst misst er Unsinn:

1. **Auf die eigene Reichweite achten.** Ein früherer Bot hielt pauschal 300 px
   Abstand – der Tank reicht nur 250. Er floh damit aus seiner eigenen
   Reichweite und schoss minutenlang ins Leere.
2. **Merken, wann er zuletzt getroffen hat.** Trifft er drei Sekunden nichts,
   obwohl Gegner leben, steht eine Wand dazwischen – dann geht er stur nach
   vorne, statt Abstand zu halten.

### Stand nach der Messung vom 2026-09-23 (Phase 8)

Gemessen wird jetzt die **Tiefe**, nicht die Zeit: Wie weit kommt der Bot,
bevor er stirbt? Das ist dieselbe Zahl, die ab Phase 10 über die Loot-Qualität
entscheidet.

| Charakter | Zonen (Bot) | überlebt |
| --------- | ----------- | -------- |
| Scout     | 5,4         | 99 s     |
| Tank      | 3,4         | 85 s     |
| Sniper    | 8,6         | 109 s    |

Bei zehn möglichen Zonen. **Die Zahlen sind nicht mit den alten Wellenzahlen
vergleichbar** – eine Welle war ein Zeitabschnitt, eine Zone ist ein Ort.

Der Tank liegt deutlich hinten, und das ist plausibel statt überraschend: Seine
Reichweite ist 250 px, er muss also mitten hinein, während die Gegnerdichte mit
der Tiefe steigt. Ob das ein Problem ist, zeigt erst eigenes Spielen – der Bot
nutzt weder Deckung noch Büsche noch eine der beiden Fähigkeiten.

*Zum Vergleich der alte Stand (Wellen, bis 2026-09-18): Scout 10,2 · Tank 9,8
· Sniper 7,2.*

**Die Zahlen sind seit der zweiten aktiven Fähigkeit noch deutlicher eine
Untergrenze:** Der Bot benutzt sie nicht. Er wirft keine Granate und heilt sich
nicht – die Messung ist also die eines Spielers, der zwei Knöpfe ignoriert.
Dass sie sich beim Umbau der Fähigkeiten nicht verändert hat, ist genau deshalb
kein Widerspruch, sondern die Bestätigung, dass am Grundgerüst nichts verrutscht
ist.

### Drei Fehler, die die Messung aufgedeckt hat

Alle drei sahen nach schlechtem Balancing aus und waren Fehler im Code:

1. **Schützen blieben hinter Deckung stehen.** Sie hielten Abstand, ohne zu
   prüfen, ob sie den Spieler überhaupt sehen. Schiessen konnten sie nicht
   (braucht Sicht), getroffen wurden sie auch nicht (die Wand fängt die
   Schüsse). Wellen dauerten dann 290 bis 400 Sekunden statt dreissig. Jetzt
   hält ein Schütze nur Abstand, **wenn er Sicht hat**; sonst geht er vor.
2. **Der Dash schlug durch die Aussenmauer.** Die Mauer ist 40 px dick, ein
   Tick dauert 1/30 s. Ab 1200 px/s springt der Spieler in einem Tick weiter,
   als die Mauer dick ist, und `resolveAgainstWalls` schiebt ihn nach **aussen**.
   Zwei Gegenmassnahmen: Dash-Tempo bleibt bei 1150 (Reichweite kommt über die
   Dauer), und `clampToArena` hält Spieler und Gegner als Notbremse im Feld.
   `state.bounds` gab es schon – es wurde nur nie benutzt.
3. **Der Super lud je Treffer, nicht je Schaden.** Der Scout feuert drei Kugeln
   je Schuss, der Sniper eine – der Scout lud dreimal so schnell, obwohl er pro
   Schuss weniger Schaden macht (660 gegen 900). Gemessen: Scout-Super alle
   0,9 s, Sniper-Super alle 4,4 s. Jetzt lädt er **je 1000 Punkten Schaden**.

### Änderungen an den Werten (jede mit Begründung im Code)

| Wert                             | Alt  | Neu  | Warum                                                                      |
| -------------------------------- | ---- | ---- | -------------------------------------------------------------------------- |
| `scout.shot.spread`              | 9°   | 6°   | Bei 9° lagen die äusseren Kugeln auf 450 px rund 35 px neben der Mitte, der Trefferradius ist 23 – auf Distanz traf nur die mittlere. |
| `SUPERS.scout.duration`          | 0,22 | 0,30 | Der Dash trug 250 px – weniger als die Reichweite eines Schützen, als Flucht also wirkungslos. Jetzt 345 px.                      |
| `SUPERS.scout.damage`            | 300  | 500  | Der schwächste der drei Supers (Tank 800 Fläche, Sniper doppelter Schaden 5 s).                                                    |
| `SUPERS.scout.invulnerableTime`  | –    | 0,30 | **Die wirksamste Änderung.** Der Scout kassierte in Welle 5 mehr Schaden als der Tank (2677 gegen 1342) bei 57 % von dessen Leben. Genau so lang wie der Dash: „Während du dashst, kann dir nichts passieren." |
| `PLAYER.superChargePerHit`       | 17   | –    | Ersetzt durch…                                                             |
| `PLAYER.superChargePerDamage`    | –    | 26   | …Aufladung je 1000 Schaden. Neutral gegenüber der Kugelzahl.                |

Der Bot ist **schlechter als ein Mensch**: keine Deckung, keine Büsche, kein
Ausweichen vor einzelnen Projektilen. Seine Zahlen sind eine Untergrenze. Das
Briefing nennt 8–15 Wellen als realistische Runde – ob das stimmt, zeigt erst
dein eigenes Spielen.

### Werte ohne Neubau probieren

`?tune=` überschreibt Zahlen aus `balance.ts` direkt in der Adresszeile
(`src/config/tuning.ts`):

```
?tune=characters.scout.health=3200
?tune=player.shootCooldown=0.1,enemies.runner.speed=140
?tune=supers.scout.invulnerableTime=0.5&debug=werte
```

Gesetzt wird nur, wo vorher schon eine Zahl stand – ein Tippfehler ändert also
nichts, sondern erscheint in der Liste „Nicht übernommen". `?debug=werte` blendet
Bildrate, Gegnerzahl, Munition, Leben, Superladung und Schaden/s ein, dazu alle
aktiven Überschreibungen.

**Nur solo brauchbar:** Im Koop rechnet der Host für alle. Ein Client mit eigenen
Werten sagt seine Bewegung falsch voraus und ruckelt. Das steht auch im Spiel auf
dem Bildschirm.

## Befehle

| Befehl              | Zweck                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `npm run dev`       | Entwicklungsserver, auch im WLAN erreichbar (`--host` ist gesetzt) |
| `npm run test`      | Tests der Simulation und des Netzwerks, plus Balancing-Messung     |
| `npm run typecheck` | TypeScript prüfen                                                  |
| `npm run lint`      | ESLint                                                             |
| `npm run build`     | Produktionsbuild nach `dist/`                                      |
| `npm run preview`   | Produktionsbuild lokal ansehen                                     |

Vor jedem Commit: `npm run typecheck && npm run lint && npm run test && npm run build`.
Genau das prüft auch `quality-check.yml`.

## Deployment

- Push auf `main` startet `.github/workflows/deploy-pages.yml`
- Der Workflow liest den Basispfad aus dem Repo-Namen
  (`VITE_BASE_PATH=/${GITHUB_REPOSITORY#*/}/`) statt ihn fest einzutragen.
  Ohne den richtigen Basispfad zeigen alle Dateipfade ins Leere und man sieht
  nur die Hintergrundfarbe
- Ergebnis: `https://thcjk.github.io/Holdout/`
- Einmalig nötig: **Settings → Pages → Source: GitHub Actions**

### Die Lehre vom 2026-09-17: Umbenennen bricht den Basispfad

Das Repo hiess `thistle-and-crown` und heisst jetzt `Holdout`. Damit änderte
sich die Pages-Adresse von `/thistle-and-crown/` auf `/Holdout/` - aber im
Workflow stand der alte Pfad fest verdrahtet. Ergebnis auf dem iPhone: Die
Seite lud, jede Spieldatei darin zeigte auf `/thistle-and-crown/...` und war
dort nicht mehr da. Zu sehen war nur die Hintergrundfarbe - ein blaues Bild,
ohne Fehlermeldung.

Zwei Konsequenzen, beide im Code:

1. **Der Pfad wird abgeleitet, nicht eingetragen.** Beide Pages-Workflows
   bestimmen ihn aus `$GITHUB_REPOSITORY`. Das nächste Umbenennen tut nichts
   mehr weh.
2. **Stilles Scheitern gibt es nicht mehr.** `index.html` enthält einen
   Wächter in einfachem JavaScript (kein Modul, kein Import - er läuft
   also auch dann, wenn genau das Laden von Modulen kaputt ist): Ist nach
   8 Sekunden weder `window.__holdoutBooted` gesetzt noch ein Canvas da,
   erscheint eine deutsche Meldung mit der Adresse der Seite und einem Knopf,
   der Service Worker und Zwischenspeicher leert. Dazu fängt
   `src/platform/crashScreen.ts` Ausnahmen ab und zeigt sie samt Version an.
   Die Version steht ausserdem unten rechts im Menü - damit sieht man am
   Handy, welcher Stand wirklich installiert ist.

## Bekannte offene Punkte

- **Querformat lässt sich auf dem iPhone nicht technisch erzwingen.**
  `screen.orientation.lock` gibt es in iOS Safari nicht. Gelöst über den
  Startbildschirm, der auf das Drehen wartet – inklusive Notausgang für alle
  mit Rotationssperre. Siehe „Nur Handy".
- **Version 1.1.0 ist ein kaputter Stand** (falscher Basispfad, weisse bzw.
  blaue Seite). Heruntergeladen hat sie niemand (0 Downloads). Ab 1.1.1 ist es
  behoben; ob das alte Release gelöscht wird, entscheidet der Nutzer.
- **Die Balance ist am Bot gemessen, nicht am Menschen.** Scout 10,2 · Tank
  9,8 · Sniper 7,2 Wellen. Der Bot nutzt keine Deckung, keine Büsche und
  **keine der beiden Fähigkeiten** – das sind Untergrenzen. Ob 8–15 Wellen
  stimmen, zeigt erst eigenes Spielen.
- **Koop über das Internet funktioniert** – vom Nutzer am 2026-09-18 auf
  echten Geräten bestätigt („es geht jetzt mit online"). Damit ist der lange
  offene Punkt aus Phase 6 erledigt. **Was dabei noch offen ist:** ob die
  Verbindung direkt oder über TURN lief. Die Lobby sagt es seit 1.11.0 von
  selbst – beim nächsten Mal einfach die Zeile unter dem Raumcode lesen.
  Aus dieser Entwicklungsumgebung ist der Signalisierungsserver weiterhin
  gesperrt (403 auf `0.peerjs.com:443`), hier lässt sich also nach wie vor nur
  der Ausfallweg prüfen.

- **Bildrate auf echtem Gerät ungeprüft.** Im Container laufen selbst fast leere
  Szenen nur mit ~50 fps (Software-Rendering ohne GPU), das Spiel mit ~32 fps.
  Diese Zahlen sagen nichts über ein Handy aus. Auf einem echten Gerät messen.
- **Keine Host-Migration.** Verlässt der Host, endet die Runde mit Hinweis -
  so im Briefing vorgesehen.
- **Der TURN-Weg ist auf zwei echten Geräten noch nicht bestätigt.** Abruf,
  Rückfall und Wegerkennung sind geprüft (150 Tests, dazu ein Durchlauf gegen
  eine echte WebRTC-Verbindung). Ob im Fall „ein Handy WLAN, eines Mobilfunk"
  wirklich `relay` herauskommt, zeigt nur der Test mit zwei Geräten - die
  Lobby sagt es dann von selbst. **Dafür muss vorher das Secret
  `TURN_API_KEY` im Repository hinterlegt sein**, sonst baut der Workflow ohne
  Schlüssel und es gelten wieder die öffentlichen Daten.
- **Bundle ist gross** (~1,6 MB, gzip ~370 kB), weil Phaser komplett eingebunden
  ist. Ein massgeschneiderter Phaser-Build wäre der nächste Hebel.
- **Die APK baut, ist aber nur debug-signiert.** Der Workflow lief am
  2026-09-17 auf Anhieb durch (rund 2 Minuten, 6,7 MB). Lokal ist sie nicht
  baubar: Das Android-SDK fehlt in der Entwicklungsumgebung und
  `dl.google.com` ist gesperrt. Ohne hinterlegten Keystore wechselt der
  Signaturschlüssel bei jedem Lauf - eine neue Version lässt sich dann nicht
  über die alte installieren, sondern erst nach dem Deinstallieren. Die vier
  Secrets dafür stehen im README.
- **Die APK ist auf keinem echten Gerät installiert worden.** Dass sie baut,
  heisst noch nicht, dass sie startet - das zeigt erst das Handy.
- **Die Welt ist keine Tilemap**, sondern eine Liste von Rechtecken aus
  `systems/WorldGenerator.ts`. Die Schnittstelle zur Simulation bleibt
  dieselbe, eine Tilemap könnte sie später füllen.
- **Phase 8 hat noch keinen Ausstieg.** Ein Run endet nur durch den Tod –
  Extraktionspunkte und Mini-Bosse kommen in Phase 9. Bis dahin fühlt sich ein
  Run bewusst unfertig an.
- **Die neuen Balancing-Zahlen sind Erstmessungen.** Scout 5,4 · Tank 3,4 ·
  Sniper 8,6 Zonen von zehn. Der Tank liegt deutlich hinten. Ob das stört,
  zeigt erst eigenes Spielen.
- **Die Buschfelder sind harte Rechtecke.** Bei Feldern bis 380 px fällt die
  gerade Kante mehr auf als in der alten Arena. Rein optisch, keine Auswirkung
  aufs Spiel.

## Was bewusst NICHT gebaut wird (V1)

PvP · Accounts und Login · Server-Datenbank · Matchmaking mit Fremden ·
Online-Ranglisten · freischaltbare Charaktere, Skins, Shop, Währungen ·
mehrere Karten oder Spielmodi · Cutscenes, Story, Tutorial-Level.

**Projektregel:** Was nicht in der V1-Liste des Briefings steht, wird nicht gebaut –
auch dann nicht, wenn es "schnell noch" machbar wäre.

## Arbeitsweise

- Nach jeder Änderung selbst spielen und deployen, bevor es weitergeht.
- Vor grösseren Änderungen den Plan zeigen, dann erst Code schreiben.
- Erklären, was gebaut wurde und warum – besonders bei Phaser-Begriffen wie
  Scenes, Groups oder dem Scale Manager.
- Am Ende der Sitzung diese Datei aktualisieren.
