import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// El módulo virtual de vite-plugin-pwa no carga en Vitest: sin service worker,
// nunca hay versión nueva. UpdatePrompt.test.tsx lo simula con sus propios valores.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))
