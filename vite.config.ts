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
        theme_color: '#0b0c10',
        background_color: '#0b0c10',
        display: 'standalone',
        icons: [
          { src: 'favicon.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Skeleton app is tiny -- just precache the shell, no custom
        // push/notificationclick handling yet (see the old src/sw.ts in
        // history if/when that comes back).
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
