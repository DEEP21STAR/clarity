import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Served as a GitHub Pages project site at deep21star.github.io/clarity/,
  // not the domain root — every asset/manifest path needs this prefix or
  // the built JS/CSS 404s in production. Same convention as NUTRYOS.
  base: '/clarity/',
  // 2026-09-23 — dropped vite-plugin-singlefile (everything inlined into one HTML) now that
  // Clarity has a real GitHub Pages home instead of only living as a claude.ai Artifact. A
  // service worker needs real, separately-cacheable JS/CSS files to precache — a single
  // monolithic HTML file can't be installed as a PWA at all.
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: "Clarity — Deep's Budget Dashboard",
        short_name: 'Clarity',
        description: "What's actually left to spend — live funds, upcoming payments, and smart recommendations.",
        theme_color: '#05060a',
        background_color: '#05060a',
        display: 'standalone',
        start_url: '/clarity/',
        scope: '/clarity/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
} as any)
