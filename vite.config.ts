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
        // long-press the home-screen icon (Android; iOS has no web shortcuts yet). Icons: scripts/shortcut-icons.mjs
        shortcuts: [
          { name: "New note", short_name: "New note", url: "./?compose=1", icons: [{ src: "icons/shortcuts/compose.png", sizes: "192x192", type: "image/png" }] },
          { name: "Search", short_name: "Search", url: "./#/search", icons: [{ src: "icons/shortcuts/search.png", sizes: "192x192", type: "image/png" }] },
          { name: "Messages", short_name: "Messages", url: "./#/messages", icons: [{ src: "icons/shortcuts/messages.png", sizes: "192x192", type: "image/png" }] },
          { name: "Activity", short_name: "Activity", url: "./#/activity", icons: [{ src: "icons/shortcuts/activity.png", sizes: "192x192", type: "image/png" }] },
        ],
        share_target: { action: "./", method: "GET", params: { title: "title", text: "text", url: "url" } },
        protocol_handlers: [{ protocol: "web+nostr", url: "./#/open/%s" }],
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: ["**/hls-*.js", "splash/**"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // note images and avatars: served from the cache once seen, so scrolling back and relaunching don't refetch them
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: { cacheName: "images", expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60, purgeOnQuotaError: true }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
    // libraries change far less often than the app: own chunks keep them cached across updates.
    // Only libraries the first screen needs; lazy ones (qrcode, marked, hls, wallet connect) stay with their screens.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: "nostr", test: /node_modules[\\/](applesauce-(core|relay|common|loaders|signers|actions|content|react)|nostr-tools|nostr-idb|idb|@noble|@scure[\\/]base|rxjs)[\\/]/ },
          ],
        },
      },
    },
  },
});
