import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

/**
 * Genera los PNG de la PWA desde public/icon.svg (`npm run generate-pwa-assets`).
 * El SVG ya trae su margen (la laguna mide 72 % del lienzo), así que maskable y
 * apple van sin relleno extra sobre el fondo #070F22 a sangre.
 */
const fondo = { background: '#070F22', fit: 'contain' } as const

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { sizes: [512], padding: 0, resizeOptions: fondo },
    apple: { sizes: [180], padding: 0, resizeOptions: fondo },
  },
  images: ['public/icon.svg'],
})
