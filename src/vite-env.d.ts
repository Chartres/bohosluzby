/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD?: string // native build number, baked in by fastlane sync_web
  readonly VITE_WITNESS_PREVIEW?: string // '1' in TestFlight prototype builds: force-show the witness card
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
