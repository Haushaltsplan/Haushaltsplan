import { REGION_HAARBACH, wmoCodeToDe } from '@/lib/region-haarbach'

export type TageszeitId = 'nacht' | 'morgen' | 'mittag' | 'abend'

export type WetterTageszeitSlot = {
  id: TageszeitId
  /** z. B. „Nacht (0–5, 22–24 h)“ */
  label: string
  wmoCode: number
  zustandDe: string
  tempMin: number
  tempMax: number
  /** aus der stärksten Windstunde in der Blöcke, km/h */
  windKmh: number | null
  windBoeenKmh: number | null
  windRichtungGrad: number | null
  niederschlagPMax: number | null
  luftfeuchte: number | null
}

export type TageszeitenPrognoseAntwort = {
  datumIso: string
  tageszeiten: WetterTageszeitSlot[]
  fehler: string | null
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/

function stundeAusOpenMeteoZeit(zeit: string): number {
  const m = /T(\d{2}):(\d{2})/.exec(zeit)
  if (m) return parseInt(m[1], 10)
  return new Date(zeit).getUTCHours()
}

function tageszeitIdFuerStunde(h: number): TageszeitId {
  if (h >= 22 || h < 6) return 'nacht'
  if (h < 12) return 'morgen'
  if (h < 18) return 'mittag'
  return 'abend'
}

/** Reihenfolge: ein „Wochentag“ von morgens bis in die Nacht */
const SLOT_META: Array<{
  id: TageszeitId
  label: string
}> = [
  { id: 'morgen', label: 'Morgen (6–12 h)' },
  { id: 'mittag', label: 'Mittag (12–18 h)' },
  { id: 'abend', label: 'Abend (18–22 h)' },
  { id: 'nacht', label: 'Nacht (0–5, 22–24 h)' },
]

type ZeileRoh = {
  time: string
  stunde: number
  wmo: number
  temp: number
  wSp: number | null
  wDir: number | null
  wGust: number | null
  nied: number | null
  lft: number | null
}

function modusWmo(codes: number[]): number {
  const z = new Map<number, number>()
  for (const c of codes) z.set(c, (z.get(c) ?? 0) + 1)
  let b = 3
  let m = 0
  for (const [c, n] of z) {
    if (n > m) {
      m = n
      b = c
    }
  }
  return b
}

/**
 * Stündliche Open-Meteo-Daten (ein Kalendertag, Europe/Berlin) in vier Tageszeiten.
 */
export async function ladeTageszeitenFuerTag(
  datumIso: string,
  koordinaten?: { lat: number; lon: number },
): Promise<TageszeitenPrognoseAntwort> {
  if (!DATUM.test(datumIso)) {
    return { datumIso, tageszeiten: [], fehler: 'Ungültiges Datumsformat' }
  }
  const d0 = new Date(`${datumIso}T12:00:00`)
  if (Number.isNaN(d0.getTime())) {
    return { datumIso, tageszeiten: [], fehler: 'Ungültiges Datum' }
  }

  const p = koordinaten ?? { lat: REGION_HAARBACH.lat, lon: REGION_HAARBACH.lon }
  const u = new URL('https://api.open-meteo.com/v1/forecast')
  u.searchParams.set('latitude', String(p.lat))
  u.searchParams.set('longitude', String(p.lon))
  u.searchParams.set('timezone', 'Europe/Berlin')
  u.searchParams.set('start_date', datumIso)
  u.searchParams.set('end_date', datumIso)
  u.searchParams.set(
    'hourly',
    'weather_code,temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,relative_humidity_2m',
  )
  u.searchParams.set('wind_speed_unit', 'kmh')

  try {
    const res = await fetch(u.toString(), { next: { revalidate: 600 } })
    if (!res.ok) {
      return { datumIso, tageszeiten: [], fehler: `Wetterdienst: HTTP ${res.status}` }
    }
    const j = (await res.json()) as {
      hourly?: {
        time?: string[]
        weather_code?: number[]
        temperature_2m?: number[]
        wind_speed_10m?: number[]
        wind_direction_10m?: number[]
        wind_gusts_10m?: number[]
        precipitation_probability?: number[]
        relative_humidity_2m?: number[]
      }
    }
    const h = j.hourly
    if (!h?.time?.length) {
      return { datumIso, tageszeiten: [], fehler: 'Keine stündlichen Daten' }
    }

    const roh: ZeileRoh[] = []
    const n = h.time.length
    for (let i = 0; i < n; i++) {
      const t = h.time[i]
      if (typeof t !== 'string' || t.slice(0, 10) !== datumIso) continue
      const st = stundeAusOpenMeteoZeit(t)
      const wmo = Number(h.weather_code?.[i])
      const wmoC = Number.isFinite(wmo) ? wmo : 3
      const temp = h.temperature_2m?.[i]
      const wSp = h.wind_speed_10m?.[i]
      const wDir = h.wind_direction_10m?.[i]
      const wGu = h.wind_gusts_10m?.[i]
      const ni = h.precipitation_probability?.[i]
      const lf = h.relative_humidity_2m?.[i]
      roh.push({
        time: t,
        stunde: st,
        wmo: wmoC,
        temp: temp != null && Number.isFinite(Number(temp)) ? Number(temp) : 0,
        wSp: wSp != null && Number.isFinite(Number(wSp)) ? Number(wSp) : null,
        wDir: wDir != null && Number.isFinite(Number(wDir)) ? Number(wDir) : null,
        wGust: wGu != null && Number.isFinite(Number(wGu)) ? Number(wGu) : null,
        nied: ni != null && Number.isFinite(Number(ni)) ? Math.round(Number(ni)) : null,
        lft: lf != null && Number.isFinite(Number(lf)) ? Math.round(Number(lf)) : null,
      })
    }

    if (roh.length === 0) {
      return { datumIso, tageszeiten: [], fehler: 'Keine Daten für diesen Tag' }
    }

    const gruppen = new Map<TageszeitId, ZeileRoh[]>()
    for (const z of roh) {
      const id = tageszeitIdFuerStunde(z.stunde)
      if (!gruppen.has(id)) gruppen.set(id, [])
      gruppen.get(id)!.push(z)
    }

    const tageszeiten: WetterTageszeitSlot[] = []
    for (const { id, label } of SLOT_META) {
      const g = gruppen.get(id) ?? []
      if (g.length === 0) continue

      const tmps = g.map((x) => x.temp)
      const tMin = Math.min(...tmps)
      const tMax = Math.max(...tmps)
      const wmos = g.map((x) => x.wmo)
      const wmoD = modusWmo(wmos)

      let maxW = -1
      let idxMax = 0
      g.forEach((row, j) => {
        const s = row.wSp ?? 0
        if (s > maxW) {
          maxW = s
          idxMax = j
        }
      })
      const stärk = g[idxMax]
      const wKmh = stärk.wSp != null ? Math.round(stärk.wSp * 10) / 10 : null
      const wBoe = stärk.wGust != null ? Math.round(stärk.wGust * 10) / 10 : null
      const wGrad = stärk.wDir

      const niedP = g.map((x) => x.nied).filter((x): x is number => x != null)
      const niedPMax = niedP.length ? Math.max(...niedP) : null

      const lfts = g.map((x) => x.lft).filter((x): x is number => x != null)
      const lftM = lfts.length ? Math.round(lfts.reduce((a, b) => a + b, 0) / lfts.length) : null

      tageszeiten.push({
        id,
        label,
        wmoCode: wmoD,
        zustandDe: wmoCodeToDe(wmoD),
        tempMin: Math.round(tMin * 10) / 10,
        tempMax: Math.round(tMax * 10) / 10,
        windKmh: wKmh,
        windBoeenKmh: wBoe,
        windRichtungGrad: wGrad,
        niederschlagPMax: niedPMax,
        luftfeuchte: lftM,
      })
    }

    if (tageszeiten.length === 0) {
      return { datumIso, tageszeiten: [], fehler: 'Tageszeiten konnten nicht berechnet werden' }
    }

    return { datumIso, tageszeiten, fehler: null }
  } catch (e) {
    return {
      datumIso,
      tageszeiten: [],
      fehler: e instanceof Error ? e.message : 'Fehler beim Laden',
    }
  }
}
