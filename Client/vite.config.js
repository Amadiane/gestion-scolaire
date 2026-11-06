import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // La nouvelle version s'active seule : plus de risque de rester sur une ancienne.
      registerType: 'autoUpdate',
      includeAssets: [
        'images/login-hero.webp', 'images/logo-sylium.png', 'favicon.ico',
        'favicon-32.png', 'favicon-48.png', 'icons/apple-touch-icon.png',
      ],
      manifest: {
        name: 'Sylium Gestion Scolaire',
        short_name: 'Sylium',
        description: 'Gestion scolaire en ligne et hors ligne',
        theme_color: '#1E3A5F',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})