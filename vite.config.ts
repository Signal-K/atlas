import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Atlas',
        short_name: 'Atlas',
        description: 'Astronomical events, calendar, and sky-watching companion',
        theme_color: '#0b1120',
        background_color: '#0b1120',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        // App shell + local-first data live in IndexedDB (see src/lib/db.ts);
        // this cache only needs to keep the shell itself available offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
