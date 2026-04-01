import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 8080,
    hmr: {
      overlay: false,
      clientPort: 8080,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      
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
          {
            src: "/jux-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/jux-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/jux-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/jux-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        screenshots: [
          {
            src: "/jux-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            form_factor: "narrow"
          },
          {
            src: "/jux-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            form_factor: "wide"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        navigateFallback: "/index.html",
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxAgeSeconds: 300
              }
            }
          }
        ]
      },
      includeAssets: ["favicon.ico", "robots.txt", "jux-icon-192.png", "jux-icon-512.png"]
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
