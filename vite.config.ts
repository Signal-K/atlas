import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest (a custom src/sw.ts) instead of the default
      // generateSW, so the service worker can also handle `push` /
      // `notificationclick` events for AT-011's watchlist notifications —
      // generateSW's Workbox-generated worker has no hook for custom event
      // listeners.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Atlas',
        short_name: 'Atlas',
        description: 'Astronomical events, calendar, and sky-watching companion',
        theme_color: '#0b1120',
        background_color: '#0b1120',
        display: 'standalone',
        icons: [
          { src: 'favicon.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      injectManifest: {
        // App shell + local-first data live in IndexedDB (see src/lib/db.ts);
        // this cache only needs to keep the shell itself available offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
