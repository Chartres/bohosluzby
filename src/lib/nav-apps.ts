// Navigation hand-off. iOS has no system "pick a navigation app" dialog —
// the convention is an in-app chooser of universal links: each opens the
// respective app when installed (Apple Maps always; Google Maps and Mapy.cz
// fall back to their web versions).

export type NavApp = { name: string; url: string }

export function navApps(lat: number, lng: number): NavApp[] {
  const pt = `${lat}%2C${lng}`
  return [
    // dirflg=w: churchgoers walk the last stretch; Maps lets them switch mode
    { name: 'Apple Maps', url: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w` },
    { name: 'Google Maps', url: `https://www.google.com/maps/dir/?api=1&destination=${pt}` },
    { name: 'Mapy.cz', url: `https://mapy.cz/zakladni?q=${pt}` },
  ]
}
