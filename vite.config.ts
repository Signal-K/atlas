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
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Without a maskable variant, Android applies its own safe-zone
          // mask to the plain icon above and can crop the moon logo
          // unpredictably depending on the launcher's icon shape. This one
          // keeps the artwork inside the ~80% safe-zone circle on a solid
          // background so any mask shape crops background, never the logo.
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // App shell + local-first data live in IndexedDB (see src/lib/db.ts);
        // this cache only needs to keep the shell itself available offline.
        // Only what the app actually serves is in public/ now -- the demo
        // video and product screenshots moved to media/ (outside the web
        // root), because this glob was sweeping them into the first-visit
        // precache and spending ~600KB of a new visitor's bandwidth on
        // files nothing in src/ references.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // astronomy-engine is ~400KB on its own and is only reachable from
        // views that actually compute sky positions. Pinning it (and the
        // React runtime) to their own chunks keeps them out of the entry
        // bundle and lets them stay cached across app deploys.
        manualChunks(id) {
          if (id.includes('node_modules/astronomy-engine')) return 'astronomy'
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react'
        },
      },
    },
  },
})
