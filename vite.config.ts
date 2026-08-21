import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 8080,
    // Autorise l'accès via un tunnel (Ngrok, LocalTunnel, trycloudflare...) dont
    // l'URL/l'hôte change à chaque relance — sans ça Vite bloque la requête
    // avec "Blocked request. This host is not allowed" en mode dev.
    allowedHosts: true,
    hmr: {
      overlay: false,
      clientPort: 8080,
    },
    // Empêche Vite de surveiller les artefacts de compilation Rust (verrouillés
    // pendant `cargo build`, ce qui fait planter le watcher avec EBUSY sous Windows).
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    /**
     * Proxy Piped pour éviter les problèmes CORS en navigateur.
     * On expose une API "same-origin" via /api/piped/*.
     */
    proxy: {
      '/api/piped/trending': {
        target: 'https://api.piped.yt',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/piped\/trending/, '/trending'),
      },
      '/api/piped/streams': {
        target: 'https://api.piped.yt',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/piped\/streams/, '/streams'),
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      manifest: {
        name: "Jux-Music - Écoute et partage de la musique",
        short_name: "Jux-Music",
        description: "Écoute et partage de la musique avec vos amis",
        theme_color: "#121212",
        background_color: "#121212",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        lang: "fr",
        dir: "ltr",
        categories: ["music", "entertainment", "multimedia"],
        prefer_related_applications: false,
        icons: [
          { src: "/jux-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/jux-icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/jux-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/jux-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        navigateFallback: "/index.html",
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Audio MP3/M4A — cache offline
            urlPattern: /\.(?:mp3|m4a|wav|ogg|aac)(\?.*)?$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "audio-cache",
              rangeRequests: true,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200, 206] },
            },
          },
          {
            // Couvertures et images
            urlPattern: /\.(?:png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      includeAssets: ["favicon.ico", "robots.txt", "jux-icon-192.png", "jux-icon-512.png"],
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
