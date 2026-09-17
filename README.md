# Koop-Arena-Shooter

Top-down-Arena-Shooter für den Handy-Browser: 1–4 Spieler halten gemeinsam gegen
immer stärkere Gegnerwellen durch. Statische PWA, gehostet auf GitHub Pages.

**Live:** https://thcjk.github.io/thistle-and-crown/

> **Stand: Phase 1 (Fundament).** Spielbar ist bisher eine Arena mit Wänden und
> eine Figur, die sich per Tastatur bewegt. Steuerung, Kampf, Wellen und Koop
> folgen in den nächsten Phasen – siehe `BRIEFING.md`, Abschnitt 8.

## Steuerung

| Eingabe                          | Wirkung |
| -------------------------------- | ------- |
| `W` `A` `S` `D` oder Pfeiltasten | Laufen  |

Touch-Steuerung kommt in Phase 2.

## Technik

TypeScript · Vite · Phaser 3 · vite-plugin-pwa · Vitest · ESLint · Prettier ·
GitHub Actions / Pages

Die Simulation läuft mit festem Takt (30 Ticks pro Sekunde) und ist strikt von der
Darstellung getrennt: Alles unter `src/systems/` ist reine Logik ohne Phaser. Warum
das wichtig ist, steht in `CLAUDE.md`.

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

## Befehle

| Befehl              | Zweck                                   |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Entwicklungsserver mit Hot Reload       |
| `npm run test`      | Tests der Simulation                    |
| `npm run typecheck` | TypeScript prüfen                       |
| `npm run lint`      | ESLint                                  |
| `npm run format`    | Prettier über das Projekt laufen lassen |
| `npm run build`     | Produktionsbuild nach `dist/`           |
| `npm run preview`   | Produktionsbuild lokal ansehen          |

## Projektstruktur

```
src/
  main.ts       Phaser-Konfiguration
  config/       Spielwerte (balance.ts), Technisches (constants.ts), Arena (arena.ts)
  scenes/       Darstellung: BootScene, GameScene
  input/        Geräte-Eingaben -> einheitlicher InputState
  systems/      reine Spiellogik, ohne Phaser
tests/systems/  Tests der Spiellogik
```

## Deployment

Jeder Push auf `main` baut und veröffentlicht über
`.github/workflows/deploy-pages.yml` auf GitHub Pages. Der Workflow setzt dabei
`VITE_BASE_PATH=/thistle-and-crown/` – ohne diesen Basispfad findet der Browser die
Dateien auf Pages nicht.

Einmalig nötig: **Settings → Pages → Source: GitHub Actions**.

## Dokumentation

- `BRIEFING.md` – der vollständige Auftrag: Spielkonzept, Werte, Architektur, Phasenplan
- `CLAUDE.md` – aktueller Stand, Architekturentscheide, offene Punkte

## Lizenz

MIT, siehe `LICENSE`.
