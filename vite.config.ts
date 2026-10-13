import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "icons/icon.svg"],
      manifest: {
        name: "Dusk",
        short_name: "Dusk",
        description: "A calm Nostr client. Quiet by default, customizable when you want it.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#14151a",
        theme_color: "#14151a",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        share_target: { action: "./", method: "GET", params: { title: "title", text: "text", url: "url" } },
        protocol_handlers: [{ protocol: "web+nostr", url: "./#/open/%s" }],
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: ["**/hls-*.js"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
