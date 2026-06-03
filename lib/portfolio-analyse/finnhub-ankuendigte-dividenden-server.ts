const CACHE_REVALIDATE = 86400

export type FinnhubAnkuendigteDividende = {
  symbol: string
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
}

function finnhubKey(): string | null {
  const k = (process.env.FINNHUB_API_KEY ?? '').trim()
  return k.length > 0 ? k : null
}

function heuteIso(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function inEinJahrIso(): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() + 1)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Fallback: nur wenn FINNHUB_API_KEY gesetzt — ein Symbol, kein Markt-Kalender. */
export async function ladeFinnhubAnkuendigteDividende(
  symbol: string,
): Promise<FinnhubAnkuendigteDividende | null> {
  const key = finnhubKey()
  const sym = symbol.trim().toUpperCase()
  if (!key || !sym) return null

  const von = heuteIso()
  const bis = inEinJahrIso()
  const u = new URL('https://finnhub.io/api/v1/stock/dividend')
  u.searchParams.set('symbol', sym)
  u.searchParams.set('from', von)
  u.searchParams.set('to', bis)
  u.searchParams.set('token', key)

  try {
    const res = await fetch(u.toString(), { next: { revalidate: CACHE_REVALIDATE } })
    if (!res.ok) return null
    const rows = (await res.json()) as Array<{
      date?: string
      amount?: number
      payDate?: string
      adjustedAmount?: number
    }>
    if (!Array.isArray(rows) || rows.length === 0) return null

    const heute = von
    const zukunft = rows
      .map((r) => {
        const pay = (r.payDate ?? r.date ?? '').slice(0, 10)
        const ex = (r.date ?? '').slice(0, 10)
        const amount = r.adjustedAmount ?? r.amount
        if (!pay || pay < heute || amount == null || !Number.isFinite(amount) || amount <= 0) return null
        return {
          zahlungsdatumIso: pay,
          exDatumIso: ex && ex >= heute ? ex : null,
          dividendeProStueckEur: amount,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => a.zahlungsdatumIso.localeCompare(b.zahlungsdatumIso))

    const hit = zukunft[0]
    if (!hit) return null

    return {
      symbol: sym,
      zahlungsdatumIso: hit.zahlungsdatumIso,
      exDatumIso: hit.exDatumIso,
      dividendeProStueckEur: Math.round(hit.dividendeProStueckEur * 10000) / 10000,
    }
  } catch {
    return null
  }
}

export function finnhubDividendenVerfuegbar(): boolean {
  return finnhubKey() != null
}
