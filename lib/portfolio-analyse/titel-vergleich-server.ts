import 'server-only'

import { berechneHistorischeBewertung } from '@/lib/portfolio-analyse/fundamentaldaten-historische-bewertung'
import { ladeFundamentaldaten } from '@/lib/portfolio-analyse/fundamentaldaten-server'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  TITEL_VERGLEICH_ZEILEN,
  type TitelVergleichAnfrage,
  type TitelVergleichPaket,
  type TitelVergleichSpalte,
  type TitelVergleichZeileDef,
} from '@/lib/portfolio-analyse/titel-vergleich-types'

export type {
  TitelVergleichAnfrage,
  TitelVergleichKennzahlId,
  TitelVergleichPaket,
  TitelVergleichSpalte,
  TitelVergleichZeileDef,
} from '@/lib/portfolio-analyse/titel-vergleich-types'
export { TITEL_VERGLEICH_ZEILEN }

function parseDeZahl(raw: string | null | undefined): number | null {
  if (!raw) return null
  const t = raw
    .trim()
    .replace(/%/g, '')
    .replace(/[x×$€]/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(t.replace(/[^\d.+-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function kmZahl(paket: FundamentaldatenPaket, id: string): number | null {
  const km = paket.keyMetrics.find((m) => m.id === id)
  if (!km) return null
  if (km.zahl != null && Number.isFinite(km.zahl)) return km.zahl
  const t = km.wert?.trim()
  if (!t || t === '–' || t === '-' || t === 'NM') return null
  return parseDeZahl(t)
}

function snapshotMio(paket: FundamentaldatenPaket, id: string): number | null {
  const z = paket.zeilen.find((r) => r.id === id)
  if (!z) return null
  const ltm = paket.perioden.find((p) => p.istLtm)
  if (ltm) {
    const v = z.werte[ltm.iso]
    if (v != null && Number.isFinite(v)) return v
  }
  const hist = [...paket.perioden]
    .filter((p) => !p.istSchaetzung && !p.istNtm && !p.istLtm)
    .reverse()
  for (const p of hist) {
    const v = z.werte[p.iso]
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

function spalteKey(a: TitelVergleichAnfrage): string {
  if (a.isin?.trim()) return a.isin.trim().toUpperCase()
  if (a.symbolYahoo?.trim()) return `SYM:${a.symbolYahoo.trim().toUpperCase()}`
  return `NAME:${(a.name ?? '').trim().toUpperCase()}`
}

function wertFuerZeile(
  paket: FundamentaldatenPaket,
  def: TitelVergleichZeileDef,
  hist: ReturnType<typeof berechneHistorischeBewertung>,
): number | null {
  if (def.quelle === 'special') return null

  if (def.quelle === 'hist' && def.histFeld) {
    const v = (hist as Record<string, unknown>)[def.histFeld]
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }

  if (def.quelle === 'zeile') {
    return snapshotMio(paket, def.id)
  }

  // km (+ Fallbacks), Sonderfall EV/EBITDA auch aus Zeile
  const ids = [def.id, ...(def.kmFallbacks ?? [])]
  for (const id of ids) {
    const v = kmZahl(paket, id)
    if (v != null) return v
  }
  if (def.id === 'ltm_ev_ebitda' || def.id === 'ntm_ev_ebitda') {
    return snapshotMio(paket, 'ev_ebitda')
  }
  if (def.id === 'ltm_ev_rev' || def.id === 'ntm_ev_rev') {
    return snapshotMio(paket, 'ev_rev')
  }
  return null
}

function werteAusPaket(paket: FundamentaldatenPaket): Record<string, number | null> {
  const hist = berechneHistorischeBewertung(paket)
  const out: Record<string, number | null> = {}
  for (const def of TITEL_VERGLEICH_ZEILEN) {
    out[def.id] = wertFuerZeile(paket, def, hist)
  }
  return out
}

async function ladeEineSpalte(a: TitelVergleichAnfrage): Promise<TitelVergleichSpalte> {
  const key = spalteKey(a)
  try {
    const paket = await ladeFundamentaldaten({
      isin: a.isin ?? null,
      symbolYahoo: a.symbolYahoo ?? null,
      name: a.name ?? undefined,
      cacheModus: 'immer',
    })
    return {
      key,
      isin: a.isin?.trim().toUpperCase() || null,
      name: paket.firmenname || a.name || a.symbolYahoo || 'Unbekannt',
      ticker: paket.ticker || a.symbolYahoo || '',
      symbolYahoo: paket.symbolYahoo ?? a.symbolYahoo ?? null,
      werte: paket.ok ? werteAusPaket(paket) : {},
      ok: paket.ok,
      fehler: paket.ok ? null : paket.fehler ?? 'Keine Daten',
    }
  } catch (e) {
    return {
      key,
      isin: a.isin?.trim().toUpperCase() || null,
      name: a.name || a.symbolYahoo || 'Unbekannt',
      ticker: a.symbolYahoo || '',
      symbolYahoo: a.symbolYahoo ?? null,
      werte: {},
      ok: false,
      fehler: e instanceof Error ? e.message : 'Fehler',
    }
  }
}

export async function ladeTitelVergleich(
  anfragen: TitelVergleichAnfrage[],
): Promise<TitelVergleichPaket> {
  const liste = anfragen
    .filter((a) => a.isin?.trim() || a.symbolYahoo?.trim() || a.name?.trim())
    .slice(0, 4)
  if (liste.length === 0) {
    return {
      ok: false,
      spalten: [],
      zeilen: TITEL_VERGLEICH_ZEILEN,
      geladenAm: new Date().toISOString(),
      fehler: 'Keine Titel zum Vergleich.',
    }
  }
  const spalten = await Promise.all(liste.map((a) => ladeEineSpalte(a)))
  return {
    ok: spalten.some((s) => s.ok),
    spalten,
    zeilen: TITEL_VERGLEICH_ZEILEN,
    geladenAm: new Date().toISOString(),
    fehler: spalten.every((s) => !s.ok) ? 'Keine Fundamentaldaten geladen.' : null,
  }
}
