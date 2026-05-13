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

/** Autobahn nur bei eindeutigen Hinweisen (Rennrad / StVO — keine „A“-Fehltreffer in Ortsnamen). */
function istAutobahnSchritt(s: OsrmStep): boolean {
  const name = typeof s.name === 'string' ? s.name : ''
  const ref = typeof s.ref === 'string' ? s.ref.trim() : ''
  if (/\b(autobahn|bab|bundesautobahn)\b/i.test(name)) return true
  if (ref && /^(A|a)\s?\d{1,3}([;\/]|$)/.test(ref)) return true
  if (ref && /;\s*(A|a)\s?\d{1,3}\b/.test(ref)) return true
  return false
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
      if (istAutobahnSchritt(s)) autobahn++
      if (/\b(B\s?\d{1,3}|Bundesstra(ss|ß)e)\b/i.test(t)) bundes++
      if (/\b(schotter|gravel|unpaved|track|waldweg|forstweg|naturbelassen|unbefestigt)\b/i.test(t)) unpaved++
      if (
        /\b(innenstadt|altstadt|stadtzentrum|stadtkern|zentrum|hauptbahnhof|\bhbf\b|bahnhofsviertel|messe|kongresszentrum|city-?mitte|inner\s*city)\b/i.test(
          t,
        )
      )
        stadt++
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

/** Normalisierung für Wiederholungs-Vergleich (Orts-/Straßenteil vor erstem Komma). */
function schrittOrtToken(label: string): string {
  const t = label.split(',')[0]?.trim().toLowerCase() ?? ''
  return t.replace(/\s+/g, ' ')
}

/** Alle Schritt-Labels in Fahrtrichtung (inkl. Wiederholungen) — für „nicht 2× am selben Ort“. */
function schrittLabelsSerien(legs: OsrmLeg[] | undefined, max = 200): string[] {
  const out: string[] = []
  for (const leg of legs || []) {
    for (const s of leg.steps || []) {
      const name = typeof s.name === 'string' ? s.name.trim() : ''
      const ref = typeof s.ref === 'string' ? s.ref.trim() : ''
      const label = name && ref && name !== ref ? `${name} (${ref})` : name || ref
      if (label.length < 2) continue
      out.push(label)
      if (out.length >= max) return out
    }
  }
  return out
}

/** Wiederbesuch: gleicher Ort/Straße nach mindestens einem anderen Schritt (nicht nur „noch auf derselben Straße“). */
function wiederbesucheOrtSerie(labels: string[]): number {
  const tokens = labels.map(schrittOrtToken).filter((t) => t.length >= 3)
  let hits = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    for (let j = i + 2; j < tokens.length; j++) {
      if (tokens[j] === t) {
        hits++
        break
      }
    }
  }
  return hits
}

/** Rennrad: Autobahn / BAB nie (StVO). */
function routeIstRennradErlaubt(r: RouteRow): boolean {
  return r.autobahnHits === 0
}

/** Hartfilter (Checkboxen). Autobahn immer ausgeschlossen. */
function routePasstWegfilterStrikt(r: RouteRow, w: WegOptionen): boolean {
  if (!routeIstRennradErlaubt(r)) return false
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
  /** Wiederbesuche desselben Orts/Straße (siehe schrittLabelsSerien). */
  wiederbesucheOrte: number
}

const TRI_BEARINGS = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324] as const
const TRI_R_FRAKTION = [0.24, 0.3, 0.36, 0.42] as const
const TRI_ZWEITWINKEL = [76, 92, 108] as const
const STRECKEN_UMWEG_GRAD = [0, 35, 70, 110, 145, 180, 220, 255, 290, 325] as const

/** Je mehr hm pro km gewünscht, desto größer die Luftlinien-Ecken (mehr Profil zum Klettern). */
function hmRadiusFaktor(zielKm: number, zielHm: number): number {
  const mProKm = zielHm / Math.max(20, zielKm)
  return 1 + Math.min(0.55, Math.max(0, (mProKm - 5) / 35))
}

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
  modus: 'Rundkurs' | 'Strecke',
): RouteRow[] {
  const pass = rows.filter((r) => {
    if (!routeIstRennradErlaubt(r)) return false
    if (r.distKm < minKm || r.distKm > maxKm) return false
    if (hmAktiv && r.hm != null && (r.hm < minHm || r.hm > maxHm)) return false
    if (hmAktiv && r.hm == null) return false
    if (wegStrikt && !routePasstWegfilterStrikt(r, weg)) return false
    return true
  })

  const score = (r: RouteRow) => {
    const kmP = Math.abs(r.distKm - zielKm) * 10
    const hmP = hmAktiv && r.hm != null ? Math.abs(r.hm - zielHm) * 0.85 : r.hm == null && hmAktiv ? 400 : 0
    const wegP = wegStrikt ? wegWeichScore(r, weg) * 0.35 : wegWeichScore(r, weg)
    const wiederP = r.wiederbesucheOrte * 55
    const rundenBonus = modus === 'Rundkurs' ? -12 : 8
    return kmP + hmP + wegP + wiederP + rundenBonus
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
  const serien = schrittLabelsSerien(r.route.legs)
  const wiederbesucheOrte = wiederbesucheOrtSerie(serien)
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
    wiederbesucheOrte,
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
  const hmFaktor = hmAktiv ? hmRadiusFaktor(zielKm, zielHm) : 1

  for (const deg of TRI_BEARINGS) {
    for (const rf of TRI_R_FRAKTION) {
      const R = Math.max(5, Math.min(62, zielKm * rf * hmFaktor))
      for (const dDelta of TRI_ZWEITWINKEL) {
        const A = punktBei(start, deg, R)
        const B = punktBei(start, deg + dDelta, R * 0.92)
        if (haversineKm(A, B) < 2.5) continue

        const raw = await osrmRoute([start, A, B, start])
        if (distKmOutOfLoose(raw, minKm, maxKm)) continue
        idx += 1
        const row = await osrmZuRow(`r-${idx}`, `Rundkurs ${deg}° · zweite Ecke +${dDelta}°`, raw)
        if (!row || row.distKm < 6 || row.distKm > 420) continue
        if (!routeIstRennradErlaubt(row)) continue
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
    if (!routeIstRennradErlaubt(row)) continue
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
      wiederbesucheOrte: r.wiederbesucheOrte,
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
  modusLabel: 'Rundkurs' | 'Strecke',
): { routes: ReturnType<typeof mapRowsToJson>['routes']; warnung: string | null; hmHinweis: string } {
  let basis = filtereUndSortiere(routeRows, minKm, maxKm, minHm, maxHm, weg, zielKm, zielHm, hmAktiv, true, modusLabel)

  if (basis.length === 0) {
    const minKm2 = zielKm * (1 - Math.min(0.22, kmTol + 0.08))
    const maxKm2 = zielKm * (1 + Math.min(0.22, kmTol + 0.08))
    basis = filtereUndSortiere(
      routeRows,
      minKm2,
      maxKm2,
      minHm,
      maxHm,
      weg,
      zielKm,
      zielHm,
      hmAktiv,
      false,
      modusLabel,
    )
  }

  const passtHm = (r: RouteRow) =>
    !hmAktiv || (r.hm != null && r.hm >= minHm && r.hm <= maxHm)

  if (basis.length === 0) {
    basis = routeRows
      .filter((r) => routeIstRennradErlaubt(r) && routePasstWegfilterStrikt(r, weg) && passtHm(r))
      .sort((a, b) => {
        const da = Math.abs(a.distKm - zielKm) + (hmAktiv && a.hm != null ? Math.abs(a.hm - zielHm) * 0.08 : 0)
        const db = Math.abs(b.distKm - zielKm) + (hmAktiv && b.hm != null ? Math.abs(b.hm - zielHm) * 0.08 : 0)
        return da - db
      })
      .slice(0, 6)
  }

  if (basis.length === 0) {
    basis = routeRows
      .filter((r) => routeIstRennradErlaubt(r) && passtHm(r))
      .sort((a, b) => Math.abs(a.distKm - zielKm) - Math.abs(b.distKm - zielKm))
      .slice(0, 6)
  }

  const { routes } = mapRowsToJson(basis)
  const wegHinweis =
    'Rennrad: Autobahn/BAB nie. Wegfilter: Heuristik aus OSRM/OSM-Schritten. Bei HM-Vorgabe gilt ±10 % zur Ziel-HM (kein Aufweichen).'
  const hmHinweis =
    modusLabel === 'Rundkurs'
      ? `${modusLabel}: Dreieck Start → Ecke A → Ecke B → Start (Rundkurse bevorzugt). Höhenprofil & HM: OpenTopoData (Schätzung, bis ${HM_SAMPLE_MAX} Punkte). ${wegHinweis}`
      : `${modusLabel}. Rundkurse werden in der Auswahl leicht bevorzugt (Strecken-Modus). ${wegHinweis}`
  return {
    routes,
    warnung:
      routes.length === 0
        ? modusLabel === 'Strecke'
          ? 'Keine Strecke im Rahmen km/HM (±10 % HM) und StVO-Filter — Ziel-Länge, HM oder Checkboxen anpassen.'
          : 'Keine Runde im Rahmen km/HM (±10 % HM) und StVO-Filter — Ziel-Länge, HM oder Checkboxen anpassen.'
        : basis.length < 3
          ? 'Nur wenige passende Varianten — ggf. Ziel-Länge leicht ändern oder Rundkurs wählen.'
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
  /** HM: fest ±10 % zur Vorgabe (keine größere Abweichung). */
  const hmTol = hmAktiv ? 0.1 : 0

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
