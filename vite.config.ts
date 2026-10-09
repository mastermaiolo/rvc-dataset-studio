/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    // Offline after the first visit. The service worker only caches the app itself;
    // recordings live in IndexedDB and are never cached or sent anywhere.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer', // external registerSW.js: no inline script, CSP stays strict
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'RVC Dataset Studio',
        short_name: 'Dataset Studio',
        description: 'Find your vocal profile and record a clean dataset for Applio/RVC. Everything stays in your browser.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0B0F14',
        theme_color: '#0B0F14',
        categories: ['music', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2020',
    modulePreload: { polyfill: false },
    sourcemap: true,
  },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
