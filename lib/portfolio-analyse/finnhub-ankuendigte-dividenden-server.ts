import {
  addDaysIso,
  brokerSymbolKandidaten,
  heuteIsoUtc,
  isoInJahren,
} from '@/lib/portfolio-analyse/dividenden-datum-hilfen'

const CACHE_REVALIDATE = 86400
const HORIZONT_JAHRE = 1

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

type DividendRow = {
  date?: string
  amount?: number
  payDate?: string
  adjustedAmount?: number
}

function parseRow(
  r: DividendRow,
  heute: string,
  bis: string,
): {
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
} | null {
  const ex = (r.date ?? '').slice(0, 10)
  const pay = (r.payDate ?? '').slice(0, 10)
  const amount = r.adjustedAmount ?? r.amount
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null

  if (pay && pay >= heute && pay <= bis) {
    return {
      zahlungsdatumIso: pay,
      exDatumIso: ex && ex.length === 10 && ex <= bis ? ex : null,
      dividendeProStueckEur: amount,
    }
  }
  if (ex && ex >= heute && ex <= bis) {
    const zahlung = pay && pay.length === 10 && pay >= heute && pay <= bis ? pay : addDaysIso(ex, 14)
    if (zahlung > bis) return null
    return {
      zahlungsdatumIso: zahlung,
      exDatumIso: ex,
      dividendeProStueckEur: amount,
    }
  }
  return null
}

async function ladeDividendenZeitraum(symbol: string, von: string, bis: string): Promise<DividendRow[]> {
  const key = finnhubKey()
  if (!key) return []

  const u = new URL('https://finnhub.io/api/v1/stock/dividend')
  u.searchParams.set('symbol', symbol)
  u.searchParams.set('from', von)
  u.searchParams.set('to', bis)
  u.searchParams.set('token', key)

  const res = await fetch(u.toString(), { next: { revalidate: CACHE_REVALIDATE } })
  if (!res.ok) return []
  const rows = await res.json()
  if (!Array.isArray(rows)) return []
  return rows as DividendRow[]
}

/** Ein Symbol — nur Dividenden von heute bis +1 Jahr. */
export async function ladeFinnhubAnkuendigteDividende(
  symbol: string,
): Promise<FinnhubAnkuendigteDividende | null> {
  const key = finnhubKey()
  if (!key) return null

  const heute = heuteIsoUtc()
  const bis = isoInJahren(HORIZONT_JAHRE)

  for (const sym of brokerSymbolKandidaten(symbol)) {
    try {
      const rows = await ladeDividendenZeitraum(sym, heute, bis)
      if (rows.length === 0) continue

      const zukunft = rows
        .map((r) => parseRow(r, heute, bis))
        .filter((x): x is NonNullable<typeof x> => x != null)
        .sort((a, b) => a.zahlungsdatumIso.localeCompare(b.zahlungsdatumIso))

      const hit = zukunft[0]
      if (!hit) continue

      return {
        symbol: sym,
        zahlungsdatumIso: hit.zahlungsdatumIso,
        exDatumIso: hit.exDatumIso,
        dividendeProStueckEur: Math.round(hit.dividendeProStueckEur * 10000) / 10000,
      }
    } catch {
      continue
    }
  }
  return null
}

export function finnhubDividendenVerfuegbar(): boolean {
  return finnhubKey() != null
}
