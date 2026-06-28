'use client'

import { decodePolyline } from '@/lib/strava/strava-polyline'
import { useEffect, useRef } from 'react'

type Props = {
  polyline: string | null | undefined
  className?: string
  height?: number
}

export function StravaRouteMap({ polyline, className = '', height = 200 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ remove: () => void } | null>(null)

  useEffect(() => {
    if (!containerRef.current || !polyline) return

    let cancelled = false

    void (async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      if (cancelled || !containerRef.current) return

      mapRef.current?.remove()
      mapRef.current = null

      const points = decodePolyline(polyline)
      if (points.length < 2) return

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map)

      const latLngs = points.map(([lat, lng]) => L.latLng(lat, lng))
      const line = L.polyline(latLngs, { color: '#FC4C02', weight: 3, opacity: 0.9 }).addTo(map)
      map.fitBounds(line.getBounds(), { padding: [16, 16] })

      mapRef.current = map
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [polyline])

  if (!polyline) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-[var(--app-surface-muted)] text-xs text-[var(--app-text-muted)] ${className}`}
        style={{ height }}
      >
        Keine Routendaten — Sync ausführen
      </div>
    )
  }

  return <div ref={containerRef} className={`overflow-hidden rounded-xl ${className}`} style={{ height }} />
}
