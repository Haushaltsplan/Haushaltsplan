'use client'

import L from 'leaflet'
import { useMemo } from 'react'
import { MapContainer, Polyline, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export type RennradKartenPunkt = { lat: number; lng: number }

export function RennradRouteKarte({ coords }: { coords: RennradKartenPunkt[] }) {
  const { bounds, positions } = useMemo(() => {
    const positionsInner = coords.map((c) => [c.lat, c.lng] as [number, number])
    const pts = coords.map((c) => L.latLng(c.lat, c.lng))
    const b = L.latLngBounds(pts)
    if (!b.isValid() && coords[0]) {
      b.extend(L.latLng(coords[0].lat + 0.01, coords[0].lng + 0.01))
    }
    return { bounds: b, positions: positionsInner }
  }, [coords])

  if (coords.length < 2) {
    return (
      <div className="flex h-[min(52vh,440px)] items-center justify-center rounded-lg bg-slate-950 text-sm text-slate-500">
        Zu wenige Punkte für die Karte.
      </div>
    )
  }

  return (
    <div className="relative z-0 h-[min(52vh,440px)] w-full overflow-hidden rounded-lg [&_.leaflet-control-attribution]:max-w-[calc(100%-12px)] [&_.leaflet-control-attribution]:whitespace-normal [&_.leaflet-control-attribution]:text-[10px]">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [32, 32] }}
        className="h-full w-full"
        scrollWheelZoom
        style={{ background: '#0f172a' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={positions} pathOptions={{ color: '#f43f5e', weight: 4 }} />
      </MapContainer>
    </div>
  )
}
