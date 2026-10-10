'use client'

import type { FundamentaldatenAnfrage } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { SecSegmentHistoriePaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import {
  ladeFundamentaldatenCacheZiele,
  sortiereFundamentaldatenBatchZiele,
  type AlleAktualisierenFortschritt,
} from '@/lib/portfolio-analyse/fundamentaldaten-client'
import { supabase } from '@/lib/supabase'

export type { AlleAktualisierenFortschritt }

const PAUSE_MS = 900
const PAUSE_NACH_FEHLER_MS = 2_500
const TITEL_MAX_VERSUCHE = 2
const RETRY_PAUSE_MS = 5_000

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

function kurzName(z: FundamentaldatenAnfrage): string {
  const ticker = (z.tickerOverride ?? z.symbolYahoo ?? '').trim().toUpperCase().split('.')[0]
  if (ticker) return ticker
  if (z.name?.trim()) return z.name.trim()
  return (z.isin ?? 'Unbekannt').trim()
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function ladeSegmentStrukturClient(
  anfrage: FundamentaldatenAnfrage,
  opts?: { refresh?: boolean; signal?: AbortSignal },
): Promise<SecSegmentHistoriePaket> {
  const q = new URLSearchParams()
  if (anfrage.isin) q.set('isin', anfrage.isin)
  if (anfrage.name) q.set('name', anfrage.name)
  if (anfrage.symbolYahoo) q.set('symbol', anfrage.symbolYahoo)
  if (anfrage.tickerOverride) q.set('ticker', anfrage.tickerOverride)
  if (opts?.refresh) q.set('refresh', '1')

  const res = await fetch(`/api/portfolio-analyse/marketscreener-segmente?${q.toString()}`, {
    cache: 'no-store',
    headers: await authHeaders(),
    signal: opts?.signal,
  })
  const j = (await res.json()) as {
    ok?: boolean
    paket?: SecSegmentHistoriePaket | null
    fehler?: string
  }
  if (!res.ok || !j.ok || !j.paket) {
    throw new Error(j.fehler ?? `Segment-Abruf fehlgeschlagen (HTTP ${res.status}).`)
  }
  return j.paket
}

async function ladeMitRetry(
  ziel: FundamentaldatenAnfrage,
  signal: AbortSignal | undefined,
  onHinweis: (h: string) => void,
): Promise<SecSegmentHistoriePaket> {
  let letzter: unknown
  for (let v = 0; v < TITEL_MAX_VERSUCHE; v++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      if (v > 0) {
        onHinweis(`Retry ${v + 1}/${TITEL_MAX_VERSUCHE} …`)
        await pauseMs(RETRY_PAUSE_MS, signal)
      }
      return await ladeSegmentStrukturClient(ziel, { refresh: true, signal })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      letzter = e
    }
  }
  throw letzter instanceof Error ? letzter : new Error('Segment-Abruf fehlgeschlagen')
}

/** Depot ∪ Watchlist: Umsatzmix/Segmente live scrapen und in Cloud speichern. */
export async function aktualisiereAlleSegmentStrukturen(opts: {
  signal?: AbortSignal
  onFortschritt?: (info: AlleAktualisierenFortschritt) => void
  onPaket?: (anfrage: FundamentaldatenAnfrage, paket: SecSegmentHistoriePaket) => void
}): Promise<{ ok: number; fehlgeschlagen: number; abgebrochen: boolean; fehlende: string[] }> {
  const ziele = sortiereFundamentaldatenBatchZiele(await ladeFundamentaldatenCacheZiele({ signal: opts.signal }))
  const gesamt = ziele.length
  let ok = 0
  const fehlende: string[] = []

  for (let i = 0; i < ziele.length; i++) {
    if (opts.signal?.aborted) {
      return { ok, fehlgeschlagen: fehlende.length, abgebrochen: true, fehlende }
    }
    const ziel = ziele[i]!
    const name = kurzName(ziel)
    opts.onFortschritt?.({
      index: i + 1,
      gesamt,
      name,
      ok: true,
      fehlgeschlagen: fehlende.length,
      erfolgreich: ok,
      fehlende: [...fehlende],
    })
    try {
      const paket = await ladeMitRetry(ziel, opts.signal, (hinweis) => {
        opts.onFortschritt?.({
          index: i + 1,
          gesamt,
          name,
          ok: true,
          fehlgeschlagen: fehlende.length,
          erfolgreich: ok,
          fehlende: [...fehlende],
          hinweis,
        })
      })
      ok++
      opts.onPaket?.(ziel, paket)
      await pauseMs(PAUSE_MS, opts.signal)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { ok, fehlgeschlagen: fehlende.length, abgebrochen: true, fehlende }
      }
      fehlende.push(name)
      opts.onFortschritt?.({
        index: i + 1,
        gesamt,
        name,
        ok: false,
        fehlgeschlagen: fehlende.length,
        erfolgreich: ok,
        fehlende: [...fehlende],
      })
      try {
        await pauseMs(PAUSE_NACH_FEHLER_MS, opts.signal)
      } catch {
        return { ok, fehlgeschlagen: fehlende.length, abgebrochen: true, fehlende }
      }
    }
  }

  return { ok, fehlgeschlagen: fehlende.length, abgebrochen: false, fehlende }
}
