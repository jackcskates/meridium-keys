import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  || process.env.GITHUB_SHA?.slice(0, 7)
  || `local-${new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 12)}`

// https://vite.dev/config/
export default defineConfig({
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['meridium-mark.svg', 'apple-touch-icon-v3.png', 'icon-192x192-v3.png', 'icon-512x512-v3.png', 'icon-1024x1024-v3.png', 'icon-192x192-maskable-v3.png', 'icon-512x512-maskable-v3.png', 'icon-1024x1024-maskable-v3.png'],
      manifest: {
        id: '/',
        name: 'Meridium Keys',
        short_name: 'Keys',
        description: 'Local-first encrypted password vaults.',
        lang: 'en-US',
        categories: ['security', 'utilities', 'productivity'],
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192x192-v3.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512x512-v3.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-1024x1024-v3.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
          { src: '/icon-192x192-maskable-v3.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512x512-maskable-v3.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-1024x1024-maskable-v3.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [],
        skipWaiting: false,
      },
    }),
  ],
})
