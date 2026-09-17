/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VitePWA } from "vite-plugin-pwa";

// Auf GitHub Pages liegt das Spiel unter /<reponame>/ - ohne passenden base-Pfad
// findet der Browser die Dateien nicht. Lokal bleibt es "/".
const base = process.env.VITE_BASE_PATH ?? "/";

// Die Versionsnummer wandert ins Spiel: Sie steht im Menue und auf dem
// Fehlerbildschirm. Nur so laesst sich aus der Ferne sagen, welcher Stand
// auf einem Geraet tatsaechlich laeuft - gerade wenn ein Service Worker
// noch eine aeltere Fassung ausliefert.
const version = JSON.parse(readFileSync("./package.json", "utf-8")).version;

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    VitePWA({
      // Eine neue Version wird im Hintergrund geladen und beim naechsten Start aktiv.
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "Holdout",
        short_name: "Holdout",
        description: "Holdout: Haltet gemeinsam gegen immer stärkere Wellen durch.",
        lang: "de",
        start_url: base,
        scope: base,
        display: "standalone",
        // Feste Kennung, damit eine neue Version als dieselbe App erkannt wird.
        id: "koop-arena-shooter",
        categories: ["games"],
        orientation: "landscape",
        background_color: "#11161f",
        theme_color: "#11161f",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Ohne diese Zeile zeigt ein Start ohne Internet eine Fehlerseite statt
        // des Spiels: Der Service Worker weiss sonst nicht, was er bei einem
        // Seitenaufruf ausliefern soll.
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        // Phaser ist gross - die Voreinstellung von 2 MB wuerde es vom
        // Offline-Zwischenspeicher ausschliessen.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,ogg,m4a,json}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 5173,
    open: false,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
