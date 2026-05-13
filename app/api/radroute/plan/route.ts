import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

type LatLng = { lat: number; lng: number }

type Body = {
  start?: { lat?: unknown; lng?: unknown }
  ziel?: { lat?: unknown; lng?: unknown } | null
  zielKm?: unknown
  zielHm?: unknown
  kmTolerancePct?: unknown
  hmTolerancePct?: unknown
  /** Checkboxen (alle optional, Standard false). */
  bundesstrassenMeiden?: unknown
  nurBelagGeteert?: unknown
  staedteMeiden?: unknown
  landstrassenBevorzugen?: unknown
}

type WegOptionen = {
  bundesstrassenMeiden: boolean
  nurBelagGeteert: boolean
  staedteMeiden: boolean
  landstrassenBevorzugen: boolean
}

type OsrmStep = { name?: string; ref?: string }
type OsrmLeg = { steps?: OsrmStep[] }
type OsrmRoute = {
  distance?: number
  geometry?: { coordinates?: number[][] }
  legs?: OsrmLeg[]
}

type HoehenprofilPunkt = { km: number; m: number }

function parseNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : fallback
}

function parseBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
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

function leseWegOptionen(body: Body): WegOptionen {
  return {
    bundesstrassenMeiden: parseBool(body.bundesstrassenMeiden),
    nurBelagGeteert: parseBool(body.nurBelagGeteert),
    staedteMeiden: parseBool(body.staedteMeiden),
    landstrassenBevorzugen: parseBool(body.landstrassenBevorzugen),
  }
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

const HM_SAMPLE_MAX = 96

function schrittText(s: OsrmStep): string {
  const name = typeof s.name === 'string' ? s.name.trim() : ''
  const ref = typeof s.ref === 'string' ? s.ref.trim() : ''
  return `${name} ${ref}`.trim()
}

function ausStepsMerkmale(legs: OsrmLeg[] | undefined): {
  bundesstrasseHits: number
  unpavedHints: number
  stadtHits: number
  autobahnHits: number
  landstrasseHits: number
} {
  let bundes = 0
  let unpaved = 0
  let stadt = 0
  let autobahn = 0
  let land = 0
  for (const leg of legs || []) {
    for (const s of leg.steps || []) {
      const t = schrittText(s)
      if (t.length < 2) continue
      if (/\b(B\s?\d{1,3}|Bundesstra(ss|ß)e)\b/i.test(t)) bundes++
      if (/\b(schotter|gravel|unpaved|track|waldweg|forstweg|naturbelassen|unbefestigt)\b/i.test(t)) unpaved++
      if (
        /\b(innenstadt|altstadt|stadtzentrum|stadtkern|zentrum|hauptbahnhof|\bhbf\b|bahnhofsviertel|messe|kongresszentrum|city-?mitte|inner\s*city)\b/i.test(
          t,
        )
      )
        stadt++
      if (/\b(autobahn|bab|fernstr\.?\s*1)\b/i.test(t) || /\bA\s?\d{1,3}\b/i.test(t)) autobahn++
      if (/\b(land|kreis)stra(ss|ß)e|\bL-?\d{2,4}\b|\bK-?\d{1,4}\b/i.test(t)) land++
    }
  }
  return {
    bundesstrasseHits: bundes,
    unpavedHints: unpaved,
    stadtHits: stadt,
    autobahnHits: autobahn,
    landstrasseHits: land,
  }
}

/** Hartfilter (nur wenn Option aktiv). Landstraßen: nur Weich-Score, kein Ausschluss. */
function routePasstWegfilterStrikt(r: RouteRow, w: WegOptionen): boolean {
  if (w.bundesstrassenMeiden && r.bundesstrasseHits > 0) return false
  if (w.nurBelagGeteert && r.unpavedHints > 0) return false
  if (w.staedteMeiden && r.stadtHits > 0) return false
  return true
}

function wegWeichScore(r: RouteRow, w: WegOptionen): number {
  let p = 0
  if (w.bundesstrassenMeiden) p += r.bundesstrasseHits * 22
  if (w.nurBelagGeteert) p += r.unpavedHints * 18
  if (w.staedteMeiden) p += r.stadtHits * 28
  if (w.landstrassenBevorzugen) {
    p += r.autobahnHits * 52
    p -= Math.min(40, r.landstrasseHits * 6)
  }
  return p
}

async function hoehenUndProfil(coords: LatLng[]): Promise<{ hm: number | null; profil: HoehenprofilPunkt[] | null }> {
  const sampled = sampleCoords(coords, HM_SAMPLE_MAX)
  if (sampled.length < 2) return { hm: null, profil: null }
  const locStr = sampled.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|')

  const datasets = ['eudem25m', 'srtm30m', 'srtm90m'] as const
  for (const ds of datasets) {
    try {
      const res = await fetch(`https://api.opentopodata.org/v1/${ds}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ locations: locStr }),
        cache: 'no-store',
      })
      if (!res.ok) continue
      const j = (await res.json()) as {
        status?: string
        results?: Array<{ elevation?: number | null }>
      }
      if (j.status !== 'OK' || !Array.isArray(j.results) || j.results.length < 2) continue

      const elev: (number | null)[] = j.results.map((r) =>
        typeof r.elevation === 'number' && Number.isFinite(r.elevation) ? r.elevation : null,
      )
      let anyNum = false
      let hm = 0
      let prev: number | null = null
      for (const e of elev) {
        if (e != null) anyNum = true
        if (prev != null && e != null && e > prev) hm += e - prev
        if (e != null) prev = e
      }
      if (!anyNum) continue

      const profil: HoehenprofilPunkt[] = []
      let cumKm = 0
      for (let i = 0; i < sampled.length; i++) {
        const e = elev[i]
        if (e == null) continue
        if (i > 0) cumKm += haversineKm(sampled[i - 1]!, sampled[i]!)
        profil.push({ km: Math.round(cumKm * 10) / 10, m: Math.round(e) })
      }

      return {
        hm: Math.round(hm),
        profil: profil.length >= 2 ? profil : null,
      }
    } catch {
      continue
    }
  }
  return { hm: null, profil: null }
}

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

type RouteRow = {
  id: string
  nameBase: string
  distKm: number
  hm: number | null
  coords: LatLng[]
  bundesstrasseHits: number
  unpavedHints: number
  stadtHits: number
  autobahnHits: number
  landstrasseHits: number
  ortsfolge: string[]
  hoehenprofil: HoehenprofilPunkt[] | null
}

const TRI_BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315] as const
const TRI_R_FRAKTION = [0.26, 0.32, 0.38] as const
const TRI_ZWEITWINKEL = [74, 92, 108] as const
const STRECKEN_UMWEG_GRAD = [0, 35, 70, 110, 145, 180, 220, 255, 290, 325] as const

function filtereUndSortiere(
  rows: RouteRow[],
  minKm: number,
  maxKm: number,
  minHm: number,
  maxHm: number,
  weg: WegOptionen,
  zielKm: number,
  zielHm: number,
  hmAktiv: boolean,
  wegStrikt: boolean,
): RouteRow[] {
  const pass = rows.filter((r) => {
    if (r.distKm < minKm || r.distKm > maxKm) return false
    if (hmAktiv && r.hm != null && (r.hm < minHm || r.hm > maxHm)) return false
    if (hmAktiv && r.hm == null) return false
    if (wegStrikt && !routePasstWegfilterStrikt(r, weg)) return false
    return true
  })

  const score = (r: RouteRow) => {
    const kmP = Math.abs(r.distKm - zielKm) * 10
    const hmP = hmAktiv && r.hm != null ? Math.abs(r.hm - zielHm) * 0.25 : r.hm == null && hmAktiv ? 200 : 0
    const wegP = wegStrikt ? wegWeichScore(r, weg) * 0.35 : wegWeichScore(r, weg)
    return kmP + hmP + wegP
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
  const m = ausStepsMerkmale(r.route.legs)
  const ortsfolge = sammleSchrittNamen(r.route.legs)
  const { hm, profil } = await hoehenUndProfil(coords)
  return {
    id,
    nameBase,
    distKm,
    hm,
    coords,
    bundesstrasseHits: m.bundesstrasseHits,
    unpavedHints: m.unpavedHints,
    stadtHits: m.stadtHits,
    autobahnHits: m.autobahnHits,
    landstrasseHits: m.landstrasseHits,
    ortsfolge,
    hoehenprofil: profil,
  }
}

async function planeRundkurs(
  start: LatLng,
  zielKm: number,
  minKm: number,
  maxKm: number,
  minHm: number,
  maxHm: number,
  weg: WegOptionen,
  hmAktiv: boolean,
  zielHm: number,
  kmTol: number,
  hmTol: number,
): Promise<{ routes: ReturnType<typeof mapRowsToJson>['routes']; warnung: string | null; hmHinweis: string }> {
  const routeRows: RouteRow[] = []
  let idx = 0

  for (const deg of TRI_BEARINGS) {
    for (const rf of TRI_R_FRAKTION) {
      const R = Math.max(5, Math.min(58, zielKm * rf))
      for (const dDelta of TRI_ZWEITWINKEL) {
        const A = punktBei(start, deg, R)
        const B = punktBei(start, deg + dDelta, R * 0.9)
        if (haversineKm(A, B) < 2.5) continue

        const raw = await osrmRoute([start, A, B, start])
        if (distKmOutOfLoose(raw, minKm, maxKm)) continue
        idx += 1
        const row = await osrmZuRow(`r-${idx}`, `Rundkurs ${deg}° · zweite Ecke +${dDelta}°`, raw)
        if (!row || row.distKm < 6 || row.distKm > 420) continue
        routeRows.push(row)
      }
    }
  }

  return finalizeRows(routeRows, minKm, maxKm, minHm, maxHm, weg, zielKm, zielHm, hmAktiv, kmTol, hmTol, 'Rundkurs')
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
  weg: WegOptionen,
  hmAktiv: boolean,
  zielHm: number,
  kmTol: number,
  hmTol: number,
): Promise<{ routes: ReturnType<typeof mapRowsToJson>['routes']; warnung: string | null; hmHinweis: string }> {
  const directEstimate = Math.max(8, haversineKm(start, zielPt) * 1.25)

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

  return finalizeRows(routeRows, minKm, maxKm, minHm, maxHm, weg, zielKm, zielHm, hmAktiv, kmTol, hmTol, 'Strecke')
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
      stadtHits: r.stadtHits,
      autobahnHits: r.autobahnHits,
      landstrasseHits: r.landstrasseHits,
      coords: sampleCoords(r.coords, 320),
      ortsfolge: r.ortsfolge,
      hoehenprofil: r.hoehenprofil,
    })),
  }
}

function finalizeRows(
  routeRows: RouteRow[],
  minKm: number,
  maxKm: number,
  minHm: number,
  maxHm: number,
  weg: WegOptionen,
  zielKm: number,
  zielHm: number,
  hmAktiv: boolean,
  kmTol: number,
  hmTol: number,
  modusLabel: string,
): { routes: ReturnType<typeof mapRowsToJson>['routes']; warnung: string | null; hmHinweis: string } {
  let basis = filtereUndSortiere(routeRows, minKm, maxKm, minHm, maxHm, weg, zielKm, zielHm, hmAktiv, true)

  if (basis.length === 0) {
    const minKm2 = zielKm * (1 - Math.min(0.28, kmTol + 0.12))
    const maxKm2 = zielKm * (1 + Math.min(0.28, kmTol + 0.12))
    const minHm2 = hmAktiv ? zielHm * (1 - Math.min(0.5, hmTol + 0.15)) : 0
    const maxHm2 = hmAktiv ? zielHm * (1 + Math.min(0.5, hmTol + 0.15)) : 1e9
    basis = filtereUndSortiere(routeRows, minKm2, maxKm2, minHm2, maxHm2, weg, zielKm, zielHm, hmAktiv, false)
  }

  if (basis.length === 0) {
    basis = routeRows
      .filter((r) => routePasstWegfilterStrikt(r, weg))
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
  const wegHinweis =
    'Wegfilter: Heuristik aus OSRM/OSM-Schritten (Bundesstraße, Belag, Orts-/Autobahn-/Kreisstraßen-Hinweise).'
  const hmHinweis =
    modusLabel === 'Rundkurs'
      ? `${modusLabel}: Dreieck Start → Ecke A → Ecke B → Start. Höhenprofil & HM: OpenTopoData (POST, bis ${HM_SAMPLE_MAX} Stützpunkte; EU-DEM / SRTM — Schätzung). ${wegHinweis}`
      : `${modusLabel}. Höhenprofil & HM: OpenTopoData (POST, bis ${HM_SAMPLE_MAX} Stützpunkte; EU-DEM / SRTM — Schätzung). ${wegHinweis}`
  return {
    routes,
    warnung:
      routes.length === 0
        ? modusLabel === 'Strecke'
          ? 'Keine befahrbare Strecke gefunden.'
          : 'Keine befahrbare Runde gefunden.'
        : basis.length < 3
          ? 'Nur wenige passende Varianten — Toleranzen ggf. lockern oder Ziel-Länge anpassen.'
          : null,
    hmHinweis,
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

  const weg = leseWegOptionen(body)

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
    result = await planeStrecke(start, zielPt, zielKm, minKm, maxKm, minHm, maxHm, weg, hmAktiv, zielHm, kmTol, hmTol)
  } else {
    result = await planeRundkurs(start, zielKm, minKm, maxKm, minHm, maxHm, weg, hmAktiv, zielHm, kmTol, hmTol)
  }

  return NextResponse.json({
    routes: result.routes,
    warnung: result.warnung,
    hmHinweis: result.hmHinweis,
  })
}
