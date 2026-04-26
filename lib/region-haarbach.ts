import { parseGoogleNewsRssItems, type RohGoogleNewsEintrag } from '@/lib/google-news-rss'
import { passtNewsLautRegionSchlagwortliste } from '@/lib/region-haarbach-news-filter'

/**
 * Regionale Übersicht: Haarbach (Gemeinde im Landkreis Passau) — Koordinaten für Open-Meteo.
 * @see https://open-meteo.com/
 */
export const REGION_HAARBACH = {
  name: 'Haarbach',
  kreis: 'Landkreis Passau',
  land: 'Bayern',
  /** Breiten-/Längengrad (Ortsmitte, aus OSM-Übernahme) */
  lat: 48.6055,
  lon: 13.1805,
} as const

/** Eine stündliche Vorhersage (ab der ersten Stunde nach `current.time`) */
export type WetterStundePrognose = {
  /** ISO-ähnlich wie von Open-Meteo, Europe/Berlin */
  zeitIso: string
  wmoCode: number
  tempC: number
  zustandDe: string
  windKmh: number | null
}

export type WetterTagPrognose = {
  /** YYYY-MM-DD (lokaler Kalendertag lt. API / Europe-Berlin) */
  datumIso: string
  wmoCode: number
  tMin: number
  tMax: number
  zustandDe: string
  /** Tagesmaximum 10 m, km/h (Open-Meteo `wind_speed_10m_max`) */
  windKmh: number | null
  /** Tagesmax. Böen 10 m, km/h */
  windBoeenKmh: number | null
  /** Dominante Tageswindrichtung, Grad */
  windRichtungGrad: number | null
}

export type WetterOverview = {
  /** WMO Weather interpretation code (Open-Meteo), z. B. 0 = klar */
  wmoCode: number
  tempC: number
  feelsLikeC: number | null
  luftfeuchte: number | null
  windKmh: number | null
  /** Windrichtung in Grad, 0° = Nord; Richtung, **aus** der der Wind weht (Open-Meteo, wie üblich). */
  windRichtungGrad: number | null
  /** Böen (10 m), km/h */
  windBoeenKmh: number | null
  zustandDe: string
  /** heute */
  tMin: number | null
  tMax: number | null
  morgenTMin: number | null
  morgenTMax: number | null
  /** 7 Tage ab morgen (Tages-Min/Max, WMO, Wind) — ohne den laufenden Tag */
  prognose7Tage: WetterTagPrognose[]
  /** Nächste Stunden (nur künftige volle Stunden, typ. bis zu 12) */
  stundenPrognose: WetterStundePrognose[]
  aktualisiert: string
  fehler: string | null
}

/** Voller leerer Zustand bei unerwarteten Ladefehlern (Startseite o. Ä.) */
export function wetterBeiLadefehler(nachricht: string | null): WetterOverview {
  return {
    wmoCode: 3,
    tempC: 0,
    feelsLikeC: null,
    luftfeuchte: null,
    windKmh: null,
    windRichtungGrad: null,
    windBoeenKmh: null,
    zustandDe: '—',
    tMin: null,
    tMax: null,
    morgenTMin: null,
    morgenTMax: null,
    prognose7Tage: [],
    stundenPrognose: [],
    aktualisiert: new Date().toISOString(),
    fehler: nachricht,
  }
}

/** veroeffentlichtAm: ISO-String (UTC), sofern im Feed; sonst null */
export type NewsEintrag = {
  titel: string
  href: string
  quelle: string
  veroeffentlichtAm: string | null
}

type RohNewsEintrag = RohGoogleNewsEintrag

export function wmoCodeToDe(code: number): string {
  const t: Record<number, string> = {
    0: 'Klar',
    1: 'Überwiegend klar',
    2: 'Teilweise bewölkt',
    3: 'Bewölkt',
    45: 'Nebel',
    48: 'Nebel mit Reif',
    51: 'Leichter Niesel',
    53: 'Niesel',
    55: 'Starker Niesel',
    56: 'Gefrierender Niesel',
    57: 'Starker gefr. Niesel',
    61: 'Leichter Regen',
    63: 'Regen',
    65: 'Starkregen',
    66: 'Gefrierender Regen',
    67: 'Starker gefr. Regen',
    71: 'Leichter Schneefall',
    73: 'Schneefall',
    75: 'Starker Schneefall',
    77: 'Schneegriesel',
    80: 'Regenschauer',
    81: 'Regenschauer',
    82: 'Starke Regenschauer',
    85: 'Schneeschauer',
    86: 'Starke Schneeschauer',
    95: 'Gewitter',
    96: 'Gewitter mit Graupel',
    99: 'Gewitter mit Hagel',
  }
  return t[code] ?? 'Wechselhaft'
}

/** Himmelsrichtung, aus der der Wind weht (8-sektorig). */
export function windHimmelsrichtungAusGrad(grad: number): string {
  const r = ((grad % 360) + 360) % 360
  const labels = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten']
  return labels[Math.round(r / 45) % 8]
}

/** Kurz z. B. „NO“ für Icon/Label */
export function windHimmelsrichtungKurz(grad: number): string {
  const r = ((grad % 360) + 360) % 360
  const labels = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW']
  return labels[Math.round(r / 45) % 8]
}

const STUNDEN_AUSBLICK_MAX = 12

function naechsteStundenPrognose(
  currentTime: string | undefined,
  stunden: string[] | undefined,
  wmos: number[] | undefined,
  temps: number[] | undefined,
  winde: number[] | undefined,
): WetterStundePrognose[] {
  if (!stunden?.length || !wmos?.length || !temps?.length) return []
  const tNow = currentTime != null && currentTime.length ? Date.parse(currentTime) : Number.NaN
  const out: WetterStundePrognose[] = []
  const n = Math.min(
    stunden.length,
    wmos.length,
    temps.length,
    winde?.length ?? stunden.length,
  )
  if (!Number.isFinite(tNow)) {
    for (let i = 0; i < n && out.length < STUNDEN_AUSBLICK_MAX; i++) {
      const wc = Number(wmos[i])
      const w = Number.isFinite(wc) ? wc : 3
      const temp = Number(temps[i])
      const wSp = winde != null && winde[i] != null && Number.isFinite(Number(winde[i])) ? Number(winde[i]) : null
      out.push({
        zeitIso: String(stunden[i]),
        wmoCode: w,
        tempC: Number.isFinite(temp) ? Math.round(temp * 10) / 10 : 0,
        zustandDe: wmoCodeToDe(w),
        windKmh: wSp != null ? Math.round(wSp * 10) / 10 : null,
      })
    }
    return out
  }
  for (let i = 0; i < n && out.length < STUNDEN_AUSBLICK_MAX; i++) {
    const tSlot = Date.parse(stunden[i])
    if (!Number.isFinite(tSlot) || tSlot <= tNow) continue
    const wc = Number(wmos[i])
    const w = Number.isFinite(wc) ? wc : 3
    const temp = Number(temps[i])
    const wSp = winde != null && winde[i] != null && Number.isFinite(Number(winde[i])) ? Number(winde[i]) : null
    out.push({
      zeitIso: String(stunden[i]),
      wmoCode: w,
      tempC: Number.isFinite(temp) ? Math.round(temp * 10) / 10 : 0,
      zustandDe: wmoCodeToDe(w),
      windKmh: wSp != null ? Math.round(wSp * 10) / 10 : null,
    })
  }
  return out
}

export async function ladeWetterHaarbach(): Promise<WetterOverview> {
  const p = { lat: REGION_HAARBACH.lat, lon: REGION_HAARBACH.lon }
  const u = new URL('https://api.open-meteo.com/v1/forecast')
  u.searchParams.set('latitude', String(p.lat))
  u.searchParams.set('longitude', String(p.lon))
  u.searchParams.set('timezone', 'Europe/Berlin')
  u.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
  )
  u.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant',
  )
  u.searchParams.set('forecast_days', '8')
  u.searchParams.set('forecast_hours', '48')
  u.searchParams.set('hourly', 'weather_code,temperature_2m,wind_speed_10m')
  u.searchParams.set('wind_speed_unit', 'kmh')

  try {
    const res = await fetch(u.toString(), { next: { revalidate: 600 } })
    if (!res.ok) {
      return {
        wmoCode: 3,
        tempC: 0,
        feelsLikeC: null,
        luftfeuchte: null,
        windKmh: null,
        windRichtungGrad: null,
        windBoeenKmh: null,
        zustandDe: '—',
        tMin: null,
        tMax: null,
        morgenTMin: null,
        morgenTMax: null,
        prognose7Tage: [],
        stundenPrognose: [],
        aktualisiert: new Date().toISOString(),
        fehler: `Wetterdienst: HTTP ${res.status}`,
      }
    }
    const j = (await res.json()) as {
      current?: {
        time?: string
        temperature_2m?: number
        relative_humidity_2m?: number
        apparent_temperature?: number
        weather_code?: number
        wind_speed_10m?: number
        wind_direction_10m?: number
        wind_gusts_10m?: number
      }
      hourly?: {
        time?: string[]
        temperature_2m?: number[]
        weather_code?: number[]
        wind_speed_10m?: number[]
      }
      daily?: {
        time?: string[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        weather_code?: number[]
        wind_speed_10m_max?: number[]
        wind_gusts_10m_max?: number[]
        wind_direction_10m_dominant?: number[]
      }
    }
    const c = j.current
    const d = j.daily
    const tMin = d?.temperature_2m_min?.[0] ?? null
    const tMax = d?.temperature_2m_max?.[0] ?? null
    const morgenTMin = d?.temperature_2m_min?.[1] ?? null
    const morgenTMax = d?.temperature_2m_max?.[1] ?? null
    const code = Number(c?.weather_code)
    const wmo = Number.isFinite(code) ? code : 3
    const wd = c?.wind_direction_10m
    const windGrad = wd != null && Number.isFinite(Number(wd)) ? Number(wd) : null
    const gust = c?.wind_gusts_10m

    const wrMax = d?.wind_speed_10m_max
    const wrGust = d?.wind_gusts_10m_max
    const wrDir = d?.wind_direction_10m_dominant

    const prognose7Tage: WetterTagPrognose[] = []
    if (d?.time?.length && d.weather_code?.length && d.temperature_2m_max?.length && d.temperature_2m_min?.length) {
      const nRoh = Math.min(
        d.time.length,
        d.weather_code.length,
        d.temperature_2m_max.length,
        d.temperature_2m_min.length,
      )
      for (let i = 1; i < nRoh && i < 8; i++) {
        const wc = Number(d.weather_code[i])
        const wmoD = Number.isFinite(wc) ? wc : 3
        const tmi = d.temperature_2m_min[i]
        const tma = d.temperature_2m_max[i]
        const wsp = wrMax?.[i]
        const wgu = wrGust?.[i]
        const wdi = wrDir?.[i]
        const wKmh = wsp != null && Number.isFinite(Number(wsp)) ? Math.round(Number(wsp) * 10) / 10 : null
        const wBoe = wgu != null && Number.isFinite(Number(wgu)) ? Math.round(Number(wgu) * 10) / 10 : null
        const wGrad = wdi != null && Number.isFinite(Number(wdi)) ? Number(wdi) : null
        prognose7Tage.push({
          datumIso: String(d.time[i]),
          wmoCode: wmoD,
          tMin: tmi != null && Number.isFinite(Number(tmi)) ? Math.round(Number(tmi) * 10) / 10 : 0,
          tMax: tma != null && Number.isFinite(Number(tma)) ? Math.round(Number(tma) * 10) / 10 : 0,
          zustandDe: wmoCodeToDe(wmoD),
          windKmh: wKmh,
          windBoeenKmh: wBoe,
          windRichtungGrad: wGrad,
        })
      }
    }

    const h = j.hourly
    const stundenPrognose = naechsteStundenPrognose(
      c?.time,
      h?.time,
      h?.weather_code,
      h?.temperature_2m,
      h?.wind_speed_10m,
    )

    return {
      wmoCode: wmo,
      tempC: Math.round((Number(c?.temperature_2m) || 0) * 10) / 10,
      feelsLikeC:
        c?.apparent_temperature != null && Number.isFinite(Number(c.apparent_temperature))
          ? Math.round(Number(c.apparent_temperature) * 10) / 10
          : null,
      luftfeuchte: c?.relative_humidity_2m != null ? Math.round(Number(c.relative_humidity_2m)) : null,
      windKmh: c?.wind_speed_10m != null ? Math.round(Number(c.wind_speed_10m) * 10) / 10 : null,
      windRichtungGrad: windGrad,
      windBoeenKmh: gust != null && Number.isFinite(Number(gust)) ? Math.round(Number(gust) * 10) / 10 : null,
      zustandDe: wmoCodeToDe(wmo),
      tMin: tMin != null ? Math.round(tMin * 10) / 10 : null,
      tMax: tMax != null ? Math.round(tMax * 10) / 10 : null,
      morgenTMin: morgenTMin != null ? Math.round(morgenTMin * 10) / 10 : null,
      morgenTMax: morgenTMax != null ? Math.round(morgenTMax * 10) / 10 : null,
      prognose7Tage,
      stundenPrognose,
      aktualisiert: c?.time || new Date().toISOString(),
      fehler: null,
    }
  } catch (e) {
    return {
      wmoCode: 3,
      tempC: 0,
      feelsLikeC: null,
      luftfeuchte: null,
      windKmh: null,
      windRichtungGrad: null,
      windBoeenKmh: null,
      zustandDe: '—',
      tMin: null,
      tMax: null,
      morgenTMin: null,
      morgenTMax: null,
      prognose7Tage: [],
      stundenPrognose: [],
      aktualisiert: new Date().toISOString(),
      fehler: e instanceof Error ? e.message : 'Wetter nicht erreichbar',
    }
  }
}

/** Suchanfragen so gewählt, dass Treffer meist eure Orts-Schläger aus der Whitelist nennen. */
const GOOGLE_NEWS_1 = encodeURIComponent(
  'Aidenbach OR Aldersbach OR Ortenburg OR Egglham OR Fürstenzell OR Kößlarn OR Tettenweis',
)
const GOOGLE_NEWS_2 = encodeURIComponent(
  'Beutelsbach OR "Bad Birnbach" OR Ortenburg',
)
/** Bad Griesbach: eigene Abfrage — viele Meldungen nur mit Kurznamen + Rottal */
const GOOGLE_BAD_GRIESBACH = encodeURIComponent(
  '"Bad Griesbach" OR "Bad Griesbach im Rottal" OR "Griesbach im Rottal" Rottal Niederbayern',
)
/** Ruhstorf: eigene Abfrage */
const GOOGLE_RUHSTORF = encodeURIComponent(
  '"Ruhstorf an der Rott" OR Ruhstorf Rottal OR "Ruhstorf a. d. Rott" Passau',
)
/** Sicht auf Veranstaltungen, die oft nur mit Phrase + Region stehen, nicht mit jedem Ortsteil. */
const GOOGLE_NEWS_3 = encodeURIComponent(
  'Haarbach "Tanz in den Mai" OR "Tanz in den Mai" Passau',
)
/** PNP lokal — gezielt nach den beiden größeren Orten im Rottal */
const GOOGLE_PNP_GRIESBACH_RUHSTORF = encodeURIComponent(
  'site:pnp.de ("Bad Griesbach" OR "Bad Griesbach im Rottal" OR Ruhstorf OR "Ruhstorf an der Rott")',
)

const FEEDS: Array<{ url: string; quelle: string }> = [
  {
    url: `https://news.google.com/rss/search?q=${GOOGLE_NEWS_1}&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News',
  },
  {
    url: `https://news.google.com/rss/search?q=${GOOGLE_NEWS_2}&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News',
  },
  {
    url: `https://news.google.com/rss/search?q=${GOOGLE_BAD_GRIESBACH}&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News',
  },
  {
    url: `https://news.google.com/rss/search?q=${GOOGLE_RUHSTORF}&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News',
  },
  {
    url: `https://news.google.com/rss/search?q=${GOOGLE_NEWS_3}&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News',
  },
  {
    url: `https://news.google.com/rss/search?q=${GOOGLE_PNP_GRIESBACH_RUHSTORF}&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News',
  },
]

/** Nur Artikel mit bekanntem Datum innerhalb der letzten 14 Tage (UTC → gleicher Kalendertag ok). */
const NEWS_MAX_ALTER_MS = 14 * 24 * 60 * 60 * 1000

function artikelIstAusLetztenZweiWochen(veroeffentlichtAm: string | null): boolean {
  if (!veroeffentlichtAm) return false
  const t = Date.parse(veroeffentlichtAm)
  if (!Number.isFinite(t)) return false
  return t >= Date.now() - NEWS_MAX_ALTER_MS
}

export async function ladeRegionNews(): Promise<{
  artikel: NewsEintrag[]
  fehler: string | null
}> {
  const alle: RohNewsEintrag[] = []
  const fehler: string[] = []

  await Promise.all(
    FEEDS.map(async ({ url, quelle }) => {
      try {
        const res = await fetch(url, {
          next: { revalidate: 300 },
          headers: { 'User-Agent': 'mein-haushalt/1.0 (private; region overview)' },
        })
        if (!res.ok) {
          if (res.status !== 404 && res.status !== 410) {
            fehler.push(`${quelle}: ${res.status}`)
          }
          return
        }
        const xml = await res.text()
        const items = parseGoogleNewsRssItems(xml, quelle, 60)
        alle.push(...items)
      } catch (e) {
        fehler.push(
          `${quelle}: ${e instanceof Error ? e.message : 'Fehler'}`,
        )
      }
    }),
  )

  const seen = new Set<string>()
  const dedup: RohNewsEintrag[] = []
  for (const a of alle) {
    const k = a.href
    if (seen.has(k)) continue
    if (!passtNewsLautRegionSchlagwortliste(a.sucheFuerLokal)) continue
    seen.add(k)
    dedup.push(a)
  }

  const artikel: NewsEintrag[] = dedup
    .map(({ sucheFuerLokal: _, ...rest }) => rest)
    .filter((a) => artikelIstAusLetztenZweiWochen(a.veroeffentlichtAm))

  artikel.sort((a, b) => {
    const ta = a.veroeffentlichtAm ? new Date(a.veroeffentlichtAm).getTime() : 0
    const tb = b.veroeffentlichtAm ? new Date(b.veroeffentlichtAm).getTime() : 0
    return tb - ta
  })

  return {
    artikel: artikel.slice(0, 12),
    fehler: fehler.length ? fehler.join(' · ') : null,
  }
}
