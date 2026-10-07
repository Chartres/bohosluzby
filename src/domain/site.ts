// The public origin. Every URL that leaves the app — the share sheet, the .ics
// event, the prerendered pages — uses it: inside the native shell
// location.origin is capacitor://localhost (iOS) or https://localhost (Android).
export const SITE_ORIGIN = 'https://bohosluzby.dravec.org'

export const churchUrl = (id: string): string => `${SITE_ORIGIN}/kostel/${id}/`
