import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Full production security headers — kept in sync with vercel.json. Applied to
// the `preview` server (which serves the built app) so `npm run preview` mirrors
// production and can validate the CSP in a browser before deploying. The CSP
// hash matches the inline theme script in index.html; regenerate it if that
// script changes (openssl sha256 -binary | base64 over the script contents).
//
// Deliberately NOT cross-origin isolated (no COOP/COEP): that would enable
// SharedArrayBuffer, which pushes the oxipng WASM codec onto its multithreaded
// build. That build spawns a *nested* Worker (a Worker created from inside our
// compress worker) to run its thread pool, and nested-worker fetches are a
// known service-worker interception gap in several browsers (Firefox only
// gained basic worker-fetch interception in v116; nested coverage is thinner
// still) — offline mode broke for exactly this reason. Single-threaded oxipng
// still runs off the main thread, so the UI never blocks; it's just slower.
const prodHeaders = {
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self' 'wasm-unsafe-eval' 'sha256-vSHw6D2jJ1dga7AO3IHkhzGbjiskfQUPNL3lVXFcNFk='; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' blob:; worker-src 'self' blob:; font-src 'self'; manifest-src 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), usb=(), payment=(), browsing-topics=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// jSquash ships ESM + WASM bundles. They must be excluded from Vite's dep
// pre-bundling so the .wasm binaries resolve and load lazily at runtime.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Offline mode: precaches the app shell + every lazy-loaded codec chunk
    // (including the WASM binaries) so smallr loads and fully works with no
    // network at all, not just during processing. Silent auto-update: a new
    // deploy takes over in the background and applies on next reload, no
    // "update available" UI needed.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-48.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'smallr — local image compressor',
        short_name: 'smallr',
        description: 'Fast, 100% local image compressor & converter (PNG / WebP / JPEG).',
        theme_color: '#0077b6',
        background_color: '#f7f7f8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,png}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/webp', '@jsquash/oxipng'],
  },
  worker: {
    format: 'es',
  },
  preview: { headers: prodHeaders },
});
