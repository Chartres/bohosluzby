/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD?: string // native build number, baked in by fastlane sync_web
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
