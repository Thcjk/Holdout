/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { VitePWA } from "vite-plugin-pwa";

// Auf GitHub Pages liegt das Spiel unter /<reponame>/ - ohne passenden base-Pfad
// findet der Browser die Dateien nicht. Lokal bleibt es "/".
const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      // Eine neue Version wird im Hintergrund geladen und beim naechsten Start aktiv.
      registerType: "autoUpdate",
      // Die Registrierung uebernimmt main.ts selbst. Grund: In der Android-App
      // gibt es keinen Service Worker - dort liegen die Dateien ohnehin auf dem
      // Geraet. Automatisch eingehaengter Code wuerde dort nur Fehler werfen.
      injectRegister: null,
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "Koop-Arena-Shooter",
        short_name: "Arena",
        description: "Top-down-Koop-Survival: haltet gemeinsam gegen immer staerkere Wellen durch.",
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
