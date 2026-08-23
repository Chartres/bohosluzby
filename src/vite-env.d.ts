/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD?: string // native build number, baked in by fastlane sync_web
  readonly VITE_WITNESS_PREVIEW?: string // '1' in TestFlight prototype builds: force-show the witness card (implies WITNESS_ENABLED)
  readonly VITE_WITNESS_ENABLED?: string // '1' to enable the witness feature WITHOUT force-showing the demo card (e2e build)
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
