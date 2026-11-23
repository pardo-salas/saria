import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { manifest } from './pwa-manifest.ts'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Aviso "Hay una versión nueva" (src/app/UpdatePrompt.tsx); nunca recarga sola.
      registerType: 'prompt',
      // El registro lo hace useRegisterSW en UpdatePrompt.
      injectRegister: false,
      strategies: 'generateSW',
      manifest,
      // Los iconos de public/ (npm run generate-pwa-assets) ya entran por
      // globPatterns; así no se agregan dos veces al precache.
      includeManifestIcons: false,
      workbox: {
        // manifest.webmanifest no va aquí: el plugin ya lo agrega al precache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Cualquier ruta (p. ej. /cuentas) abre sin conexión con el shell.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Sin runtimeCaching a propósito: Supabase siempre va a la red.
      },
      // El service worker solo existe en build/preview, no en dev ni pruebas.
      devOptions: { enabled: false },
    }),
  ],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['vitest.setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
