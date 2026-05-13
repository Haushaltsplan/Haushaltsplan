import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

type LatLng = { lat: number; lng: number }
type Wegtyp = 'belag_bevorzugt' | 'bundesstrasse_meiden' | 'beides'

type Body = {
  start?: { lat?: unknown; lng?: unknown }
  /** Gesetzter Zielpunkt → Streckenmodus (Start … Ziel mit optionalen Umwegen). Ohne → Rundkurs. */
  ziel?: { lat?: unknown; lng?: unknown } | null
  zielKm?: unknown
  zielHm?: unknown
  kmTolerancePct?: unknown
  hmTolerancePct?: unknown
  wegtyp?: unknown
}

type OsrmStep = { name?: string; ref?: string }
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
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    )
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
  const datasets = ['eudem25m', 'srtm30m'] as const

  for (const ds of datasets) {
    const url = `https://api.opentopodata.org/v1/${ds}?locations=${encodeURIComponent(loc)}`
    try {
      const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!res.ok) continue
      const j = (await res.json()) as { results?: Array<{ elevation?: number | null }>; error?: string }
      if (typeof j.error === 'string' && j.error.length > 0) continue
      if (!Array.isArray(j.results) || j.results.length < 2) continue
      let hm = 0
      let prev: number | null = null
      let anyNum = false
      for (const r of j.results) {
        const e = typeof r.elevation === 'number' && Number.isFinite(r.elevation) ? r.elevation : null
        if (e != null) anyNum = true
        if (prev != null && e != null && e > prev) hm += e - prev
        if (e != null) prev = e
      }
      if (!anyNum) continue
      return Math.round(hm)
    } catch {
      continue
    }
  }
  return null
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

/** Straßen- und Ortsnamen aus OSRM-Schritten (Reihenfolge, ohne direkte Wiederholung). */
function sammleSchrittNamen(legs: OsrmLeg[] | undefined, max = 55): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const leg of legs || []) {
    for (const s of leg.steps || []) {
      const name = typeof s.name === 'string' ? s.name.trim() : ''
      const ref = typeof s.ref === 'string' ? s.ref.trim() : ''
      const label = name && ref && name !== ref ? `${name} (${ref})` : name || ref
      if (label.length < 2) continue
      const key = label.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(label)
      if (out.length >= max) return out
    }
  }
  return out
}

function wegtypErlaubt(wegtyp: Wegtyp, bundes: number, rough: number): boolean {
  if (wegtyp === 'bundesstrasse_meiden' && bundes > 0) return false
  if (wegtyp === 'beides' && (bundes > 0 || rough > 0)) return false
  return true
}

type RouteRow = {
  id: string
  nameBase: string
  distKm: number
  hm: number | null
  coords: LatLng[]
  bundesstrasseHits: number
  unpavedHints: number
  ortsfolge: string[]
}

const WINDING_FACTORS = [2.9, 3.3, 3.7, 4.2] as const
const BEARINGS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const
const STRECKEN_UMWEG_GRAD = [0, 35, 70, 110, 145, 180, 220, 255, 290, 325] as const

function filtereUndSortiere(
  rows: RouteRow[],
  minKm: number,
  maxKm: number,
  minHm: number,
  maxHm: number,
  wegtyp: Wegtyp,
  zielKm: number,
  zielHm: number,
  hmAktiv: boolean,
  wegtypStrikt: boolean,
): RouteRow[] {
  const pass = rows.filter((r) => {
    if (r.distKm < minKm || r.distKm > maxKm) return false
    if (hmAktiv && r.hm != null && (r.hm < minHm || r.hm > maxHm)) return false
    if (hmAktiv && r.hm == null) return false
    if (wegtypStrikt && !wegtypErlaubt(wegtyp, r.bundesstrasseHits, r.unpavedHints)) return false
    return true
  })

  const score = (r: RouteRow) => {
    const kmP = Math.abs(r.distKm - zielKm) * 10
    const hmP = hmAktiv && r.hm != null ? Math.abs(r.hm - zielHm) * 0.25 : r.hm == null && hmAktiv ? 200 : 0
    const roadP =
      (wegtyp === 'bundesstrasse_meiden' || wegtyp === 'beides' ? r.bundesstrasseHits * 22 : 0) +
      (wegtyp === 'belag_bevorzugt' || wegtyp === 'beides' ? r.unpavedHints * 14 : 0)
    return kmP + hmP + roadP
  }

  return pass.sort((a, b) => score(a) - score(b)).slice(0, 6)
}

async function osrmZuRow(
  id: string,
  nameBase: string,
  r: { ok: true; route: OsrmRoute } | { ok: false },
): Promise<RouteRow | null> {
  if (!r.ok) return null
  const coords = (r.route.geometry?.coordinates || [])
    .map(([lng, lat]) => ({ lat, lng }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  if (coords.length < 2) return null
  const distKm = (r.route.distance || 0) / 1000
  const p = ausStepsPenalty(r.route.legs)
  const ortsfolge = sammleSchrittNamen(r.route.legs)
  const hm = await ermittleHm(coords)
  return {
    id,
    nameBase,
    distKm,
    hm,
    coords,
    bundesstrasseHits: p.bundesstrasseHits,
    unpavedHints: p.unpavedHints,
    ortsfolge,
  }
}

async function planeRundkurs(
  start: LatLng,
  zielKm: number,
  minKm: number,
  maxKm: number,
  minHm: number,
  maxHm: number,
  wegtyp: Wegtyp,
  hmAktiv: boolean,
  zielHm: number,
  kmTol: number,
  hmTol: number,
): Promise<{ routes: ReturnType<typeof mapRowsToJson>['routes']; warnung: string | null; hmHinweis: string }> {
  const routeRows: RouteRow[] = []
  let idx = 0

  for (const deg of BEARINGS) {
    for (const wf of WINDING_FACTORS) {
      const radiusKm = Math.max(4, Math.min(95, zielKm / wf))
      const wende = punktBei(start, deg, radiusKm)
      const raw = await osrmRoute([start, wende, start])
      if (distKmOutOfLoose(raw, minKm, maxKm)) continue
      idx += 1
      const row = await osrmZuRow(`r-${idx}`, `Runde ${deg}°`, raw)
      if (!row || row.distKm < 6 || row.distKm > 420) continue
      routeRows.push(row)
    }
  }

  return finalizeRows(routeRows, minKm, maxKm, minHm, maxHm, wegtyp, zielKm, zielHm, hmAktiv, kmTol, hmTol, 'Rundkurs')
}

function distKmOutOfLoose(raw: { ok: true; route: OsrmRoute } | { ok: false }, minKm: number, maxKm: number): boolean {
  if (!raw.ok) return true
  const d = (raw.route.distance || 0) / 1000
  return d < minKm * 0.72 || d > maxKm * 1.32
}

async function planeStrecke(
  start: LatLng,
  zielPt: LatLng,
  zielKm: number,
  minKm: number,
  maxKm: number,
  minHm: number,
  maxHm: number,
  wegtyp: Wegtyp,
  hmAktiv: boolean,
  zielHm: number,
  kmTol: number,
  hmTol: number,
): Promise<{ routes: ReturnType<typeof mapRowsToJson>['routes']; warnung: string | null; hmHinweis: string }> {
  const luft = haversineKm(start, zielPt)
  const directEstimate = Math.max(8, luft * 1.25)

  const mitte: LatLng = { lat: (start.lat + zielPt.lat) / 2, lng: (start.lng + zielPt.lng) / 2 }
  const detourRadius = Math.max(4, Math.min(38, Math.max(0, zielKm - directEstimate) / 2))

  const varianten: LatLng[][] = [[start, zielPt]]
  for (const deg of STRECKEN_UMWEG_GRAD) {
    if (deg === 0 && detourRadius < 1) continue
    const viaGen = punktBei(mitte, deg, detourRadius)
    varianten.push([start, viaGen, zielPt])
  }

  const routeRows: RouteRow[] = []
  let idx = 0
  for (let vi = 0; vi < varianten.length; vi++) {
    const raw = await osrmRoute(varianten[vi])
    if (distKmOutOfLoose(raw, minKm, maxKm)) continue
    idx += 1
    const nameBase = vi === 0 ? 'Strecke · direkt' : `Strecke · Umweg ${STRECKEN_UMWEG_GRAD[vi - 1] ?? vi}°`
    const row = await osrmZuRow(`s-${idx}`, nameBase, raw)
    if (!row || row.distKm < 5 || row.distKm > 450) continue
    routeRows.push(row)
  }

  return finalizeRows(routeRows, minKm, maxKm, minHm, maxHm, wegtyp, zielKm, zielHm, hmAktiv, kmTol, hmTol, 'Strecke')
}

function mapRowsToJson(basis: RouteRow[]) {
  return {
    routes: basis.map((r, i) => ({
      id: r.id,
      name: `${r.nameBase} · Vorschlag ${i + 1}`,
      distanceKm: Math.round(r.distKm * 10) / 10,
      ascentM: r.hm,
      bundesstrasseHits: r.bundesstrasseHits,
      unpavedHints: r.unpavedHints,
      coords: sampleCoords(r.coords, 320),
      ortsfolge: r.ortsfolge,
    })),
  }
}

function finalizeRows(
  routeRows: RouteRow[],
  minKm: number,
  maxKm: number,
  minHm: number,
  maxHm: number,
  wegtyp: Wegtyp,
  zielKm: number,
  zielHm: number,
  hmAktiv: boolean,
  kmTol: number,
  hmTol: number,
  modusLabel: string,
): { routes: ReturnType<typeof mapRowsToJson>['routes']; warnung: string | null; hmHinweis: string } {
  let basis = filtereUndSortiere(routeRows, minKm, maxKm, minHm, maxHm, wegtyp, zielKm, zielHm, hmAktiv, true)

  if (basis.length === 0) {
    const minKm2 = zielKm * (1 - Math.min(0.28, kmTol + 0.12))
    const maxKm2 = zielKm * (1 + Math.min(0.28, kmTol + 0.12))
    const minHm2 = hmAktiv ? zielHm * (1 - Math.min(0.5, hmTol + 0.15)) : 0
    const maxHm2 = hmAktiv ? zielHm * (1 + Math.min(0.5, hmTol + 0.15)) : 1e9
    basis = filtereUndSortiere(routeRows, minKm2, maxKm2, minHm2, maxHm2, wegtyp, zielKm, zielHm, hmAktiv, false)
  }

  if (basis.length === 0) {
    basis = routeRows
      .filter((r) => wegtypErlaubt(wegtyp, r.bundesstrasseHits, r.unpavedHints))
      .sort((a, b) => {
        const da = Math.abs(a.distKm - zielKm) + (hmAktiv && a.hm != null ? Math.abs(a.hm - zielHm) * 0.02 : 0)
        const db = Math.abs(b.distKm - zielKm) + (hmAktiv && b.hm != null ? Math.abs(b.hm - zielHm) * 0.02 : 0)
        return da - db
      })
      .slice(0, 6)
  }

  if (basis.length === 0) {
    basis = routeRows.sort((a, b) => Math.abs(a.distKm - zielKm) - Math.abs(b.distKm - zielKm)).slice(0, 6)
  }

  const { routes } = mapRowsToJson(basis)
  return {
    routes,
    warnung:
      routes.length === 0
        ? modusLabel === 'Strecke'
          ? 'Keine befahrbare Strecke gefunden.'
          : 'Keine befahrbare Schleife gefunden.'
        : basis.length < 3
          ? 'Nur wenige passende Varianten — Toleranzen ggf. lockern oder Ziel-Länge anpassen.'
          : null,
    hmHinweis: `${modusLabel}. Höhenmeter: OpenTopoData (EU-DEM / SRTM, Schätzung). Orts-/Straßennamen aus OSRM-Schritten. Wegtyp: Heuristik aus OSM.`,
  }
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungueltiges JSON.' }, { status: 400 })
  }

  const start = coord(body.start)
  if (!start) {
    return NextResponse.json({ error: 'Start fehlt oder ist ungueltig.' }, { status: 400 })
  }

  const zielPt = body.ziel != null ? coord(body.ziel) : null

  const zielKm = parseNum(body.zielKm, NaN)
  if (!Number.isFinite(zielKm) || zielKm < 8 || zielKm > 400) {
    return NextResponse.json({ error: 'Ziel-Laenge (km) zwischen 8 und 400 angeben.' }, { status: 400 })
  }

  const zielHmRaw = parseNum(body.zielHm, 0)
  const hmAktiv = Number.isFinite(zielHmRaw) && zielHmRaw > 50
  const zielHm = hmAktiv ? zielHmRaw : 0

  const kmTol = Math.min(35, Math.max(6, parseNum(body.kmTolerancePct, 15))) / 100
  const hmTol = Math.min(55, Math.max(12, parseNum(body.hmTolerancePct, 35))) / 100

  const minKm = zielKm * (1 - kmTol)
  const maxKm = zielKm * (1 + kmTol)
  const minHm = hmAktiv ? zielHm * (1 - hmTol) : 0
  const maxHm = hmAktiv ? zielHm * (1 + hmTol) : 1e9

  const wegtyp: Wegtyp =
    body.wegtyp === 'bundesstrasse_meiden' || body.wegtyp === 'beides' || body.wegtyp === 'belag_bevorzugt'
      ? body.wegtyp
      : 'belag_bevorzugt'

  let result: { routes: ReturnType<typeof mapRowsToJson>['routes']; warnung: string | null; hmHinweis: string }

  if (zielPt) {
    const directEst = Math.max(8, haversineKm(start, zielPt) * 1.25)
    if (directEst > maxKm * 1.06) {
      return NextResponse.json(
        {
          error:
            'Start und Ziel sind fuer die gewaehlte Ziel-Laenge (km) zu weit auseinander (Schaetzung aus Luftlinie). Ziel-Laenge erhoehen oder naeher liegende Punkte waehlen.',
        },
        { status: 400 },
      )
    }
    result = await planeStrecke(start, zielPt, zielKm, minKm, maxKm, minHm, maxHm, wegtyp, hmAktiv, zielHm, kmTol, hmTol)
  } else {
    result = await planeRundkurs(start, zielKm, minKm, maxKm, minHm, maxHm, wegtyp, hmAktiv, zielHm, kmTol, hmTol)
  }

  return NextResponse.json({
    routes: result.routes,
    warnung: result.warnung,
    hmHinweis: result.hmHinweis,
  })
}
