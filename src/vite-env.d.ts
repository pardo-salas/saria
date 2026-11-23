/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Versión de package.json, inyectada por `define` en vite.config.ts. */
  readonly VITE_APP_VERSION: string
}
