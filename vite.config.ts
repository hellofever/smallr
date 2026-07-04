import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Cross-origin isolation headers. These enable SharedArrayBuffer, which lets
// the oxipng WASM codec run multithreaded (otherwise it falls back to a single
// core and PNG optimisation is much slower). Safe here because the app loads no
// cross-origin resources. NOTE: production hosting must send these same headers.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

// jSquash ships ESM + WASM bundles. They must be excluded from Vite's dep
// pre-bundling so the .wasm binaries resolve and load lazily at runtime.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/webp', '@jsquash/oxipng'],
  },
  worker: {
    format: 'es',
  },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
});
