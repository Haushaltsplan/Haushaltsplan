import 'server-only'

import { ladeFundamentaldaten } from '@/lib/portfolio-analyse/fundamentaldaten-server'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  TITEL_VERGLEICH_ZEILEN,
  type TitelVergleichAnfrage,
  type TitelVergleichKennzahlId,
  type TitelVergleichPaket,
  type TitelVergleichSpalte,
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
  const t = raw.trim().replace(/%/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
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
  const hist = [...paket.perioden].filter((p) => !p.istSchaetzung && !p.istNtm && !p.istLtm).reverse()
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

function werteAusPaket(paket: FundamentaldatenPaket): Partial<Record<TitelVergleichKennzahlId, number | null>> {
  return {
    div_yield: kmZahl(paket, 'div_yield'),
    pers_div_yield: null,
    payout: kmZahl(paket, 'payout'),
    ltm_pe: kmZahl(paket, 'ltm_pe'),
    ltm_ps: kmZahl(paket, 'ltm_ps'),
    ltm_ev_ebitda: kmZahl(paket, 'ntm_ev_ebitda') ?? snapshotMio(paket, 'ev_ebitda'),
    ltm_fcf_rendite: kmZahl(paket, 'ltm_fcf_rendite'),
    ltm_roic: kmZahl(paket, 'ltm_roic'),
    ltm_brutto: kmZahl(paket, 'ltm_brutto'),
    fcf_marge: snapshotMio(paket, 'fcf_marge'),
    rev_cagr_5y: kmZahl(paket, 'rev_cagr_5y'),
    net_debt_ebitda: kmZahl(paket, 'net_debt_ebitda'),
  }
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
