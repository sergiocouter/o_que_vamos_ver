import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'badge-96x96.png'],
      manifest: {
        name: 'O que vamos ver?',
        short_name: 'Vamos ver?',
        description: 'A lista de filmes, séries e realities da sua família.',
        theme_color: '#201d26',
        background_color: '#f7f6f3',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'pt-BR',
        categories: ['entertainment', 'lifestyle'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Notificações do lembrete diário (push e clique).
        importScripts: ['push-sw.js'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\/\.netlify\/functions\/tmdb\?action=image/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tmdb-posters',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Onde assistir: guarda por 1 dia para os cartões não consultarem a cada abertura.
            urlPattern: /\/\.netlify\/functions\/tmdb\?action=providers/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tmdb-providers',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },
    }),
  ],
})
