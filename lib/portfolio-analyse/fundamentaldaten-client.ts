'use client'

import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { ergaenzeFcfRenditeKeyMetrics, ergaenzeFcfRenditeZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-fcf-rendite-zeilen'

const LS_KEY = 'pa-fundamentaldaten-v56'
const LS_MAX_AGE_MS = 24 * 60 * 60 * 1000
const LS_MAX_TITEL = 8

function anfrageCacheKey(anfrage: FundamentaldatenAnfrage): string {
  return [
    anfrage.isin ?? '',
    anfrage.symbolYahoo ?? '',
    anfrage.tickerOverride ?? '',
    anfrage.frequenz ?? 'jahr',
  ].join('|')
}

type StoreEintrag = { paket: FundamentaldatenPaket; cachedAt: number }
type Store = Record<string, StoreEintrag>

function leseStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as Store
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

export function ladeFundamentaldatenAusLocalCache(
  anfrage: FundamentaldatenAnfrage,
): FundamentaldatenPaket | null {
  const e = leseStore()[anfrageCacheKey(anfrage)]
  if (!e?.paket?.ok || !e.cachedAt || Date.now() - e.cachedAt > LS_MAX_AGE_MS) return null
  const zeilen = [...e.paket.zeilen]
  ergaenzeFcfRenditeZeilen(e.paket.perioden, zeilen)
  return {
    ...e.paket,
    zeilen,
    keyMetrics: ergaenzeFcfRenditeKeyMetrics(e.paket.keyMetrics, {
      perioden: e.paket.perioden,
      zeilen,
    }),
  }
}

function schreibeLocalCache(anfrage: FundamentaldatenAnfrage, daten: FundamentaldatenPaket): void {
  if (typeof window === 'undefined' || !daten.ok) return
  try {
    const store = leseStore()
    store[anfrageCacheKey(anfrage)] = { paket: daten, cachedAt: Date.now() }
    const keys = Object.keys(store)
    if (keys.length > LS_MAX_TITEL) {
      const sortiert = keys.sort((a, b) => (store[a]?.cachedAt ?? 0) - (store[b]?.cachedAt ?? 0))
      for (const k of sortiert.slice(0, keys.length - LS_MAX_TITEL)) delete store[k]
    }
    localStorage.setItem(LS_KEY, JSON.stringify(store))
  } catch {
    try {
      localStorage.removeItem(LS_KEY)
    } catch {
      /* Speicher voll */
    }
  }
}

export async function ladeFundamentaldatenClient(
  anfrage: FundamentaldatenAnfrage,
  opts?: { signal?: AbortSignal },
): Promise<FundamentaldatenPaket> {
  const res = await fetch('/api/portfolio-analyse/fundamentaldaten', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(anfrage),
    signal: opts?.signal,
  })
  const raw = await res.text()
  let j: FundamentaldatenPaket & { message?: string }
  try {
    j = JSON.parse(raw) as FundamentaldatenPaket & { message?: string }
  } catch {
    throw new Error(
      raw.trim().slice(0, 180) || 'Fundamentaldaten konnten nicht geladen werden (keine JSON-Antwort).',
    )
  }
  if (!res.ok || !j.ok) {
    throw new Error(j.fehler ?? j.message ?? 'Fundamentaldaten konnten nicht geladen werden.')
  }
  schreibeLocalCache(anfrage, j)
  return j
}

function zielSchluessel(z: FundamentaldatenAnfrage): string | null {
  const isin = z.isin?.trim().toUpperCase()
  if (isin) return `isin:${isin}`
  const sym = z.symbolYahoo?.trim().toUpperCase()
  if (sym) return `sym:${sym}`
  const name = z.name?.trim().toUpperCase()
  return name ? `name:${name}` : null
}

export function mergenFundamentaldatenZiele(
  ...listen: Array<FundamentaldatenAnfrage[] | null | undefined>
): FundamentaldatenAnfrage[] {
  const map = new Map<string, FundamentaldatenAnfrage>()
  for (const liste of listen) {
    for (const z of liste ?? []) {
      const key = zielSchluessel(z)
      if (!key) continue
      const prev = map.get(key)
      if (!prev) {
        map.set(key, { ...z, frequenz: 'jahr', cacheModus: 'erneuern' })
        continue
      }
      const candidates = [...(prev.symbolCandidates ?? []), ...(z.symbolCandidates ?? [])]
      map.set(key, {
        ...prev,
        name: prev.name || z.name,
        symbolYahoo: prev.symbolYahoo || z.symbolYahoo,
        symbolCandidates: [...new Set(candidates.filter(Boolean))],
      })
    }
  }
  return [...map.values()]
}

export async function ladeFundamentaldatenCacheZiele(opts?: {
  signal?: AbortSignal
}): Promise<FundamentaldatenAnfrage[]> {
  const res = await fetch('/api/portfolio-analyse/fundamentaldaten/cache-ziele', {
    cache: 'no-store',
    signal: opts?.signal,
  })
  const j = (await res.json()) as { ok?: boolean; ziele?: FundamentaldatenAnfrage[]; message?: string }
  if (!res.ok || !j.ok || !Array.isArray(j.ziele)) {
    throw new Error(j.message ?? 'Cache-Ziele konnten nicht geladen werden.')
  }
  return j.ziele
}

export type AlleAktualisierenFortschritt = {
  index: number
  gesamt: number
  name: string
  ok: boolean
  abgebrochen?: boolean
  fehlgeschlagen: number
  erfolgreich: number
  /** Kurznamen der bisher fehlgeschlagenen Titel */
  fehlende: string[]
  /** z. B. „Retry …“ / „Cool-down …“ */
  hinweis?: string
}

const BATCH_PAUSE_MS = 1_600
const BATCH_PAUSE_NACH_FEHLER_MS = 5_000
const BATCH_PAUSE_EU_EXTRA_MS = 1_200
const TITEL_MAX_VERSUCHE = 2
const TITEL_RETRY_PAUSE_MS = [8_000, 20_000] as const
const STREAK_COOLDOWN_AB = 3
const STREAK_COOLDOWN_MS = 45_000
const NACHLAUF_PAUSE_MS = 12_000

function pauseMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = window.setTimeout(() => resolve(), ms)
    const onAbort = () => {
      window.clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function istEuZiel(z: FundamentaldatenAnfrage): boolean {
  const isin = z.isin?.trim().toUpperCase() ?? ''
  if (isin.length >= 2) {
    const land = isin.slice(0, 2)
    if (land === 'US' || land === 'CA') return false
    if (
      [
        'DE',
        'FR',
        'NL',
        'BE',
        'AT',
        'ES',
        'IT',
        'IE',
        'FI',
        'PT',
        'LU',
        'CH',
        'GB',
        'SE',
        'DK',
        'NO',
      ].includes(land)
    ) {
      return true
    }
  }
  const sym = (z.symbolYahoo ?? '').toUpperCase()
  return /\.(DE|PA|AS|SW|L|MI|MC|HE|BR|VI)$/.test(sym)
}

/** US zuerst (Macrotrends stabiler), EU danach — weniger frühe Rate-Limits. */
export function sortiereFundamentaldatenBatchZiele(
  ziele: FundamentaldatenAnfrage[],
): FundamentaldatenAnfrage[] {
  return [...ziele].sort((a, b) => Number(istEuZiel(a)) - Number(istEuZiel(b)))
}

function kurzName(z: FundamentaldatenAnfrage): string {
  return (z.symbolYahoo ?? z.name ?? z.isin ?? 'Unbekannt').trim()
}

async function ladeTitelMitRetry(
  ziel: FundamentaldatenAnfrage,
  signal: AbortSignal | undefined,
  onHinweis: (hinweis: string) => void,
): Promise<FundamentaldatenPaket> {
  let letzterFehler: unknown
  for (let versuch = 0; versuch < TITEL_MAX_VERSUCHE; versuch++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      if (versuch > 0) {
        const wait = TITEL_RETRY_PAUSE_MS[Math.min(versuch - 1, TITEL_RETRY_PAUSE_MS.length - 1)]!
        onHinweis(`Retry ${versuch + 1}/${TITEL_MAX_VERSUCHE} in ${Math.round(wait / 1000)}s …`)
        await pauseMs(wait, signal)
      }
      return await ladeFundamentaldatenClient(
        { ...ziel, frequenz: 'jahr', cacheModus: 'erneuern' },
        { signal },
      )
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e
      letzterFehler = e
    }
  }
  throw letzterFehler instanceof Error
    ? letzterFehler
    : new Error('Fundamentaldaten konnten nicht geladen werden.')
}

async function laufBatchUeberZiele(
  ziele: FundamentaldatenAnfrage[],
  opts: {
    signal?: AbortSignal
    onFortschritt?: (info: AlleAktualisierenFortschritt) => void
    onPaket?: (anfrage: FundamentaldatenAnfrage, paket: FundamentaldatenPaket) => void
    startIndexOffset?: number
    gesamtAnzeige: number
    bereitsOk: number
    bereitsFehlende: string[]
  },
): Promise<{ ok: number; fehlende: string[]; abgebrochen: boolean }> {
  let ok = opts.bereitsOk
  const fehlende = [...opts.bereitsFehlende]
  let streakFail = 0
  const offset = opts.startIndexOffset ?? 0

  for (let i = 0; i < ziele.length; i++) {
    if (opts.signal?.aborted) {
      return { ok, fehlende, abgebrochen: true }
    }
    const ziel = ziele[i]!
    const name = kurzName(ziel)
    const index = offset + i + 1

    opts.onFortschritt?.({
      index,
      gesamt: opts.gesamtAnzeige,
      name,
      ok: true,
      fehlgeschlagen: fehlende.length,
      erfolgreich: ok,
      fehlende: [...fehlende],
      hinweis: undefined,
    })

    try {
      const paket = await ladeTitelMitRetry(ziel, opts.signal, (hinweis) => {
        opts.onFortschritt?.({
          index,
          gesamt: opts.gesamtAnzeige,
          name,
          ok: false,
          fehlgeschlagen: fehlende.length,
          erfolgreich: ok,
          fehlende: [...fehlende],
          hinweis,
        })
      })
      if (paket.ok) {
        ok += 1
        streakFail = 0
        const ix = fehlende.indexOf(name)
        if (ix >= 0) fehlende.splice(ix, 1)
        opts.onPaket?.(ziel, paket)
        opts.onFortschritt?.({
          index,
          gesamt: opts.gesamtAnzeige,
          name,
          ok: true,
          fehlgeschlagen: fehlende.length,
          erfolgreich: ok,
          fehlende: [...fehlende],
        })
      } else {
        streakFail += 1
        if (!fehlende.includes(name)) fehlende.push(name)
        opts.onFortschritt?.({
          index,
          gesamt: opts.gesamtAnzeige,
          name,
          ok: false,
          fehlgeschlagen: fehlende.length,
          erfolgreich: ok,
          fehlende: [...fehlende],
        })
      }
    } catch (e) {
      if (opts.signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        return { ok, fehlende, abgebrochen: true }
      }
      streakFail += 1
      if (!fehlende.includes(name)) fehlende.push(name)
      opts.onFortschritt?.({
        index,
        gesamt: opts.gesamtAnzeige,
        name,
        ok: false,
        fehlgeschlagen: fehlende.length,
        erfolgreich: ok,
        fehlende: [...fehlende],
        hinweis: e instanceof Error ? e.message.slice(0, 80) : undefined,
      })
    }

    if (streakFail >= STREAK_COOLDOWN_AB && i < ziele.length - 1) {
      opts.onFortschritt?.({
        index,
        gesamt: opts.gesamtAnzeige,
        name,
        ok: false,
        fehlgeschlagen: fehlende.length,
        erfolgreich: ok,
        fehlende: [...fehlende],
        hinweis: `Cool-down ${Math.round(STREAK_COOLDOWN_MS / 1000)}s (Rate-Limit) …`,
      })
      try {
        await pauseMs(STREAK_COOLDOWN_MS, opts.signal)
      } catch {
        return { ok, fehlende, abgebrochen: true }
      }
      streakFail = 0
    }

    if (i < ziele.length - 1) {
      const pause =
        BATCH_PAUSE_MS +
        (istEuZiel(ziel) || istEuZiel(ziele[i + 1]!) ? BATCH_PAUSE_EU_EXTRA_MS : 0) +
        (streakFail > 0 ? BATCH_PAUSE_NACH_FEHLER_MS : 0)
      try {
        await pauseMs(pause, opts.signal)
      } catch {
        return { ok, fehlende, abgebrochen: true }
      }
    }
  }

  return { ok, fehlende, abgebrochen: false }
}

export async function aktualisiereAlleFundamentaldaten(
  zieleRoh: FundamentaldatenAnfrage[],
  opts: {
    signal?: AbortSignal
    onFortschritt?: (info: AlleAktualisierenFortschritt) => void
    onPaket?: (anfrage: FundamentaldatenAnfrage, paket: FundamentaldatenPaket) => void
  },
): Promise<{ ok: number; fehlgeschlagen: number; abgebrochen: boolean; fehlende: string[] }> {
  const ziele = sortiereFundamentaldatenBatchZiele(zieleRoh)
  const gesamt = ziele.length

  const erster = await laufBatchUeberZiele(ziele, {
    signal: opts.signal,
    onFortschritt: opts.onFortschritt,
    onPaket: opts.onPaket,
    gesamtAnzeige: gesamt,
    bereitsOk: 0,
    bereitsFehlende: [],
  })
  if (erster.abgebrochen) {
    return {
      ok: erster.ok,
      fehlgeschlagen: erster.fehlende.length,
      abgebrochen: true,
      fehlende: erster.fehlende,
    }
  }

  // Zweiter Durchgang nur für Fehlschläge — oft nach Cool-down wieder ok.
  const nachzug = ziele.filter((z) => erster.fehlende.includes(kurzName(z)))
  if (nachzug.length === 0) {
    return { ok: erster.ok, fehlgeschlagen: 0, abgebrochen: false, fehlende: [] }
  }

  opts.onFortschritt?.({
    index: gesamt,
    gesamt,
    name: 'Nachlauf',
    ok: true,
    fehlgeschlagen: nachzug.length,
    erfolgreich: erster.ok,
    fehlende: [...erster.fehlende],
    hinweis: `Nachlauf in ${Math.round(NACHLAUF_PAUSE_MS / 1000)}s für ${nachzug.length} Titel …`,
  })
  try {
    await pauseMs(NACHLAUF_PAUSE_MS, opts.signal)
  } catch {
    return {
      ok: erster.ok,
      fehlgeschlagen: erster.fehlende.length,
      abgebrochen: true,
      fehlende: erster.fehlende,
    }
  }

  const zweiter = await laufBatchUeberZiele(nachzug, {
    signal: opts.signal,
    onFortschritt: (info) => {
      opts.onFortschritt?.({
        ...info,
        gesamt: gesamt,
        hinweis: info.hinweis ?? `Nachlauf ${info.index}/${nachzug.length}`,
      })
    },
    onPaket: opts.onPaket,
    startIndexOffset: 0,
    gesamtAnzeige: nachzug.length,
    bereitsOk: erster.ok,
    bereitsFehlende: [...erster.fehlende],
  })

  return {
    ok: zweiter.ok,
    fehlgeschlagen: zweiter.fehlende.length,
    abgebrochen: zweiter.abgebrochen,
    fehlende: zweiter.fehlende,
  }
}

export type MantraVerlaufPunktClient = {
  periodeIso: string
  periodeLabel: string
  ampel: string
  ampelScorePct: number | null
  scoreMantra: number | null
  sellTriggerOk: boolean
  erfuellt: number
  nichtErfuellt: number
  erfasstAm: string
}

export async function ladeMantraVerlaufClient(ticker: string): Promise<MantraVerlaufPunktClient[]> {
  const t = ticker.trim().toUpperCase()
  if (!t) return []
  const res = await fetch(
    `/api/portfolio-analyse/fundamentaldaten/mantra-verlauf?ticker=${encodeURIComponent(t)}`,
    { cache: 'no-store' },
  )
  const j = (await res.json()) as { ok?: boolean; verlauf?: MantraVerlaufPunktClient[] }
  if (!res.ok || !j.ok || !j.verlauf) return []
  return j.verlauf
}
