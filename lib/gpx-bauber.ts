/** GPX 1.1 mit Track aus Koordinaten — für Garmin Connect & Co. */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type LatLng = { lat: number; lng: number }

export function baueGpxTrack(opts: {
  trackName: string
  punkte: LatLng[]
  /** ISO-Zeit für Metadaten */
  zeitUtc?: string
}): string {
  const { trackName, punkte, zeitUtc } = opts
  const zeit = zeitUtc ?? new Date().toISOString()
  const pts = punkte
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}" />`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Omnia — mein-haushalt" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(trackName)}</name>
    <time>${zeit}</time>
  </metadata>
  <trk>
    <name>${escapeXml(trackName)}</name>
    <type>cycling</type>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`
}
