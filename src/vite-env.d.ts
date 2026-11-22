/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Versión de package.json, inyectada por `define` en vite.config.ts. */
  readonly VITE_APP_VERSION: string
}
