# Koop-Arena-Shooter

Top-down-Arena-Shooter für den Handy-Browser: 1–4 Spieler halten gemeinsam gegen
immer stärkere Gegnerwellen durch. Statische PWA, gehostet auf GitHub Pages.

**Live:** https://thcjk.github.io/thistle-and-crown/

## Was drin ist

- Drei Charaktere, die sich grundlegend anders spielen: **Scout** (beweglich,
  Fächerschuss), **Tank** (Schrotschuss, hält aus), **Sniper** (Reichweite,
  Durchschuss) – jeder mit eigener Super-Fähigkeit
- Wellensystem mit steigender Schwierigkeit, drei Gegnertypen, Boss alle fünf
  Wellen, Score und lokaler Rekord
- Twin-Stick-Touchsteuerung: schwebender Joystick links, Zielen und Schiessen
  rechts, Super-Knopf – plus Tastatur und Maus zum Entwickeln
- Koop über WebRTC mit sechsstelligem Raumcode, bis zu vier Spieler
- Als PWA installierbar, Solo-Modus läuft offline

## Steuerung

| Eingabe                  | Wirkung                                                      |
| ------------------------ | ------------------------------------------------------------ |
| Linker Daumen            | Laufen (Joystick erscheint, wo du hintippst)                 |
| Rechter Daumen           | Ziehen zielt, Loslassen feuert; nur Tippen zielt automatisch |
| Super-Knopf unten rechts | Super-Fähigkeit (leuchtet, wenn geladen)                     |
| `W` `A` `S` `D`          | Laufen                                                       |
| Maus                     | Zielen, Linksklick feuert                                    |
| Leertaste                | Super                                                        |
| `Esc`                    | zurück ins Menü                                              |

## Technik

TypeScript · Vite · Phaser 3 · PeerJS · vite-plugin-pwa · Vitest · ESLint ·
Prettier · GitHub Actions / Pages

Die Simulation läuft mit festem Takt (30 Ticks pro Sekunde) und ist strikt von
der Darstellung getrennt: Alles unter `src/systems/` ist reine Logik ohne Phaser.
Deshalb kann im Koop ein Gerät die Runde für alle rechnen, und deshalb spielen
die Tests ganze Runden ohne Browser durch. Warum das die wichtigste Entscheidung
im Projekt ist, steht in `CLAUDE.md`.

## Voraussetzungen

- Node.js 20 oder neuer
- npm 10 oder neuer

## Loslegen

```bash
npm install
npm run dev
```

Der Entwicklungsserver ist auch im lokalen Netz erreichbar (`--host` ist gesetzt),
damit sich das Spiel direkt auf dem Handy testen lässt: Die zweite Adresse in der
Ausgabe von `npm run dev` im Handy-Browser öffnen.

## Koop testen

In dieser Reihenfolge, so schlägt es das Briefing vor:

1. **Zwei Tabs, ein Rechner:** Menü → _Zusammen spielen_ → im ersten Tab
   _Lokaler Test: Raum_, im zweiten _Lokaler Test: beitreten_. Läuft über
   `BroadcastChannel`, ganz ohne Internet.
2. **Zwei Geräte im WLAN:** _Raum erstellen_ zeigt einen Raumcode, das zweite
   Gerät gibt ihn unter _Beitreten_ ein. Ein Link mit `?room=CODE` füllt ihn
   automatisch aus.
3. **Über Mobilfunk:** gleicher Weg. In manchen Netzen scheitert WebRTC
   grundsätzlich – dann kommt eine Fehlermeldung, und der Solo-Modus geht immer.

## Befehle

| Befehl              | Zweck                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run dev`       | Entwicklungsserver mit Hot Reload                                       |
| `npm run test`      | Tests – und eine Balancing-Messung, die ausgibt, wie weit ein Bot kommt |
| `npm run typecheck` | TypeScript prüfen                                                       |
| `npm run lint`      | ESLint                                                                  |
| `npm run format`    | Prettier über das Projekt laufen lassen                                 |
| `npm run build`     | Produktionsbuild nach `dist/`                                           |
| `npm run preview`   | Produktionsbuild lokal ansehen                                          |

## Balancing

Alle Spielwerte stehen in `src/config/balance.ts` – Leben, Schaden, Tempo,
Nachladezeiten, Wellenformel. Diese Zahlen zu ändern ist der Sinn der Datei,
nicht ein Zeichen, dass etwas falsch war. `npm run test` zeigt nach jeder
Änderung, wie weit ein einfacher Bot damit kommt.

## Projektstruktur

```
src/
  config/     Spielwerte, Technisches, Arena
  systems/    reine Spiellogik, ohne Phaser
  net/        Koop: Transport, Lobby, Host und Client
  render/     Arena, Figuren, Kamera, Effekte
  scenes/     Boot, Menü, Lobby, Spiel, HUD, Game Over
  input/ ui/  Eingaben und Bedienelemente
  audio/      synthetisierte Klänge
  assets/     Texture Atlas
tests/        Simulation und Netzwerk, ohne Browser
```

## Deployment

Jeder Push auf `main` baut und veröffentlicht über
`.github/workflows/deploy-pages.yml` auf GitHub Pages. Der Workflow setzt dabei
`VITE_BASE_PATH=/thistle-and-crown/` – ohne diesen Basispfad findet der Browser
die Dateien auf Pages nicht.

Einmalig nötig: **Settings → Pages → Source: GitHub Actions**.

## Dokumentation

- `BRIEFING.md` – der vollständige Auftrag: Spielkonzept, Werte, Architektur, Phasenplan
- `CLAUDE.md` – aktueller Stand, Architekturentscheide, offene Punkte

## Lizenz

MIT, siehe `LICENSE`.
