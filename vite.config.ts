import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site under /<repo>/; CI passes that path in BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      strategies: 'generateSW',
      // A new service worker waits until every tab/app window is closed, so an
      // update applies on next launch and never mid-session (SPEC 18).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Pleiad',
        short_name: 'Pleiad',
        description: 'A calm, personal spaced-repetition learning app.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0B1020',
        theme_color: '#0B1020',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell only. Content packs are cached per activation later (SPEC 5.3).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Large install-time icons are fetched by the OS, not needed offline.
        globIgnores: ['icons/icon-512.png', 'icons/icon-maskable-512.png'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
});
