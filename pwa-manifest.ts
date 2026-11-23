import type { ManifestOptions } from 'vite-plugin-pwa'

/**
 * Manifest de la PWA. Lo usa vite.config.ts y lo verifica
 * src/app/manifest.test.ts. Los PNG salen de public/icon.svg con
 * `npm run generate-pwa-assets` (ver pwa-assets.config.ts).
 */
export const manifest: Partial<ManifestOptions> = {
  name: 'Saria',
  short_name: 'Saria',
  description: 'Tus finanzas personales, con o sin conexión.',
  lang: 'es-MX',
  dir: 'ltr',
  display: 'standalone',
  start_url: '/',
  scope: '/',
  theme_color: '#070F22',
  background_color: '#070F22',
  icons: [
    { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    {
      src: 'maskable-icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}
