import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type LatLng = { lat: number; lng: number }
type Wegtyp = 'belag_bevorzugt' | 'bundesstrasse_meiden' | 'beides'

type Body = {
  start?: { lat?: unknown; lng?: unknown }
  ziel?: { lat?: unknown; lng?: unknown }
  via?: { lat?: unknown; lng?: unknown } | null
  minKm?: unknown
  maxKm?: unknown
  minHm?: unknown
  maxHm?: unknown
  wegtyp?: unknown
}

type OsrmStep = { name?: string }
type OsrmLeg = { steps?: OsrmStep[] }
type OsrmRoute = {
  distance?: number
  geometry?: { coordinates?: number[][] }
  legs?: OsrmLeg[]
}

function parseNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : fallback
}

function coord(raw: unknown): LatLng | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { lat?: unknown; lng?: unknown }
  const lat = parseNum(r.lat, NaN)
  const lng = parseNum(r.lng, NaN)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.sqrt(x))
}

function punktBei(ursprung: LatLng, bearingGrad: number, distKm: number): LatLng {
  const R = 6371
  const d = distKm / R
  const br = (bearingGrad * Math.PI) / 180
  const lat1 = (ursprung.lat * Math.PI) / 180
  const lon1 = (ursprung.lng * Math.PI) / 180
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br))
  const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: (lat2 * 180) / Math.PI, lng: (lon2 * 180) / Math.PI }
}

async function osrmRoute(waypoints: LatLng[]): Promise<{ ok: true; route: OsrmRoute } | { ok: false }> {
  const path = waypoints.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/cycling/${path}?overview=full&geometries=geojson&steps=true`
  const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!res.ok) return { ok: false }
  const json = (await res.json()) as { code?: string; routes?: OsrmRoute[] }
  if (json.code !== 'Ok' || !json.routes?.[0]) return { ok: false }
  return { ok: true, route: json.routes[0] }
}

function sampleCoords(coords: LatLng[], max: number): LatLng[] {
  if (coords.length <= max) return coords
  const step = Math.ceil(coords.length / max)
  const out: LatLng[] = []
  for (let i = 0; i < coords.length; i += step) out.push(coords[i])
  if (out[out.length - 1] !== coords[coords.length - 1]) out.push(coords[coords.length - 1])
  return out
}

async function ermittleHm(coords: LatLng[]): Promise<number | null> {
  const sampled = sampleCoords(coords, 120)
  if (sampled.length < 2) return null
  const loc = sampled.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|')
  const url = `https://api.opentopodata.org/v1/eudem25m?locations=${encodeURIComponent(loc)}`
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const j = (await res.json()) as { results?: Array<{ elevation?: number | null }> }
    if (!Array.isArray(j.results) || j.results.length < 2) return null
    let hm = 0
    let prev: number | null = null
    for (const r of j.results) {
      const e = typeof r.elevation === 'number' && Number.isFinite(r.elevation) ? r.elevation : null
      if (prev != null && e != null && e > prev) hm += e - prev
      if (e != null) prev = e
    }
    return Math.round(hm)
  } catch {
    return null
  }
}

function ausStepsPenalty(legs: OsrmLeg[] | undefined): { bundesstrasseHits: number; unpavedHints: number } {
  const names: string[] = []
  for (const leg of legs || []) {
    for (const s of leg.steps || []) {
      if (typeof s.name === 'string' && s.name.trim()) names.push(s.name.trim())
    }
  }
  let bundes = 0
  let rough = 0
  for (const n of names) {
    if (/\b(B\s?\d{1,3}|Bundesstra(?:ss|ß)e)\b/i.test(n)) bundes++
    if (/\b(schotter|gravel|waldweg|forstweg|unpaved|track)\b/i.test(n)) rough++
  }
  return { bundesstrasseHits: bundes, unpavedHints: rough }
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungueltiges JSON.' }, { status: 400 })
  }

  const start = coord(body.start)
  const ziel = coord(body.ziel)
  const via = body.via ? coord(body.via) : null
  if (!start || !ziel) {
    return NextResponse.json({ error: 'Start und Ziel fehlen.' }, { status: 400 })
  }

  const minKm = Math.max(5, parseNum(body.minKm, 60))
  const maxKm = Math.max(minKm, parseNum(body.maxKm, minKm + 10))
  const minHm = Math.max(0, parseNum(body.minHm, 0))
  const maxHm = Math.max(minHm, parseNum(body.maxHm, 5000))
  const wegtyp: Wegtyp =
    body.wegtyp === 'bundesstrasse_meiden' || body.wegtyp === 'beides' || body.wegtyp === 'belag_bevorzugt'
      ? body.wegtyp
      : 'belag_bevorzugt'

  const zielKm = (minKm + maxKm) / 2
  const mitte: LatLng = { lat: (start.lat + ziel.lat) / 2, lng: (start.lng + ziel.lng) / 2 }
  const directEstimate = Math.max(8, haversineKm(start, ziel) * 1.25)
  const detourRadius = Math.max(4, Math.min(35, Math.max(0, zielKm - directEstimate) / 2))

  const basis = [start, ...(via ? [via] : []), ziel]
  const variants: LatLng[][] = [basis]

  if (!via) {
    for (const deg of [0, 35, 70, 110, 145, 180, 220, 255, 290, 325]) {
      const viaGen = punktBei(mitte, deg, detourRadius)
      variants.push([start, viaGen, ziel])
    }
  } else {
    for (const deg of [40, 140, 220, 320]) {
      const viaGen = punktBei(via, deg, Math.max(3, detourRadius * 0.45))
      variants.push([start, via, viaGen, ziel])
    }
  }

  const routeRows: Array<{
    id: string
    distKm: number
    hm: number | null
    coords: LatLng[]
    bundesstrasseHits: number
    unpavedHints: number
  }> = []

  for (let i = 0; i < variants.length; i++) {
    const r = await osrmRoute(variants[i])
    if (!r.ok) continue
    const coords = (r.route.geometry?.coordinates || [])
      .map(([lng, lat]) => ({ lat, lng }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    if (coords.length < 2) continue

    const distKm = ((r.route.distance || 0) / 1000)
    const hm = await ermittleHm(coords)
    const p = ausStepsPenalty(r.route.legs)

    routeRows.push({
      id: `r-${i + 1}`,
      distKm,
      hm,
      coords,
      bundesstrasseHits: p.bundesstrasseHits,
      unpavedHints: p.unpavedHints,
    })
  }

  const gefiltert = routeRows.filter((r) => {
    if (r.distKm < minKm || r.distKm > maxKm) return false
    if (r.hm != null && (r.hm < minHm || r.hm > maxHm)) return false
    if (wegtyp === 'bundesstrasse_meiden' && r.bundesstrasseHits > 0) return false
    if (wegtyp === 'beides' && (r.bundesstrasseHits > 0 || r.unpavedHints > 0)) return false
    return true
  })

  const score = (r: (typeof routeRows)[number]) => {
    const kmPenalty = Math.abs(r.distKm - zielKm) * 8
    const hmPenalty = r.hm == null ? 120 : Math.abs(r.hm - (minHm + maxHm) / 2) * 0.2
    const roadPenalty =
      (wegtyp === 'bundesstrasse_meiden' || wegtyp === 'beides' ? r.bundesstrasseHits * 20 : 0) +
      (wegtyp === 'belag_bevorzugt' || wegtyp === 'beides' ? r.unpavedHints * 12 : 0)
    return kmPenalty + hmPenalty + roadPenalty
  }

  const basisListe = (gefiltert.length ? gefiltert : routeRows).sort((a, b) => score(a) - score(b)).slice(0, 6)
  const routes = basisListe.map((r, i) => ({
    id: r.id,
    name: `Variante ${i + 1}`,
    distanceKm: Math.round(r.distKm * 10) / 10,
    ascentM: r.hm,
    bundesstrasseHits: r.bundesstrasseHits,
    unpavedHints: r.unpavedHints,
    coords: sampleCoords(r.coords, 280),
  }))

  return NextResponse.json({
    routes,
    warnung:
      routes.length === 0
        ? 'Keine passende Route gefunden. Bereich erweitern oder Wegtyp lockern.'
        : null,
    hmHinweis:
      'Hoehenmeter kommen aus OpenTopoData (Schaetzung). Wegtypfilter basiert auf OSM/Strassennamen-Heuristik.',
  })
}
