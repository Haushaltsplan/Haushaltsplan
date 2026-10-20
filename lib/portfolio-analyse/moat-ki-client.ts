import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { MoatKiBewertung } from '@/lib/portfolio-analyse/moat-ki-types'

function schlankesPaket(paket: FundamentaldatenPaket): FundamentaldatenPaket {
  const ids = new Set([
    'ltm_brutto',
    'brutto_std_10y',
    'ltm_roic',
    'roic_5y_avg',
    'incremental_roic',
    'ltm_value_spread',
    'fcf_conversion',
    'nrr',
    'net_debt_ebitda',
    'aktien_verwaesserung',
    'ltm_ebit',
    'interest_coverage',
  ])
  return {
    ...paket,
    zeilen: [],
    perioden: [],
    news: [],
    keyMetrics: paket.keyMetrics.filter((m) => ids.has(m.id)),
    erweitert: undefined,
  }
}

export async function ladeMoatKiClient(ticker: string): Promise<MoatKiBewertung | null> {
  const t = ticker.trim().toUpperCase()
  if (!t) return null
  const res = await fetch(`/api/portfolio-analyse/moat-ki?ticker=${encodeURIComponent(t)}`)
  const j = (await res.json()) as { ok?: boolean; bewertung?: MoatKiBewertung | null }
  if (!j.ok) return null
  return j.bewertung ?? null
}

export async function generiereMoatKiClient(opts: {
  ticker: string
  paket: FundamentaldatenPaket
  isin?: string | null
  erzwingen?: boolean
}): Promise<{ ok: true; bewertung: MoatKiBewertung } | { ok: false; fehler: string }> {
  const res = await fetch('/api/portfolio-analyse/moat-ki', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker: opts.ticker,
      paket: schlankesPaket(opts.paket),
      isin: opts.isin ?? null,
      erzwingen: opts.erzwingen === true,
    }),
  })
  const j = (await res.json()) as {
    ok?: boolean
    bewertung?: MoatKiBewertung
    fehler?: string
  }
  if (!j.ok || !j.bewertung) {
    return { ok: false, fehler: j.fehler || 'Moat-KI fehlgeschlagen' }
  }
  return { ok: true, bewertung: j.bewertung }
}
