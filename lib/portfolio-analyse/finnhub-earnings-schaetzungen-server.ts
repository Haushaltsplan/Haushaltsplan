import { heuteIsoUtc, isoInJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'

const CACHE_REVALIDATE = 3600

function finnhubKey(): string | null {
  const k = (process.env.FINNHUB_API_KEY ?? '').trim()
  return k.length > 0 ? k : null
}

type FinnhubEarningsRow = {
  date?: string
  epsEstimate?: number
  revenueEstimate?: number
  hour?: string
  quarter?: number
  year?: number
}

function finnhubSymbole(sym: string): string[] {
  const s = sym.trim().toUpperCase()
  if (!s) return []
  const out = [s]
  const m = /^([A-Z0-9-]+)\.([A-Z]{1,3})$/.exec(s)
  if (m && !out.includes(m[1])) out.push(m[1])
  return out
}

export async function ladeFinnhubEarningsSchaetzungen(
  symbol: string,
  terminDatumIso?: string,
): Promise<EarningsSchaetzungen | null> {
  const key = finnhubKey()
  if (!key) return null

  const heute = heuteIsoUtc()
  const bis = isoInJahren(1)

  for (const sym of finnhubSymbole(symbol)) {
    const u = new URL('https://finnhub.io/api/v1/calendar/earnings')
    u.searchParams.set('from', heute)
    u.searchParams.set('to', bis)
    u.searchParams.set('symbol', sym)
    u.searchParams.set('token', key)

    try {
      const res = await fetch(u.toString(), { next: { revalidate: CACHE_REVALIDATE } })
      if (!res.ok) continue
      const rows = (await res.json()) as { earningsCalendar?: FinnhubEarningsRow[] }
      const cal = rows.earningsCalendar ?? []
      if (cal.length === 0) continue

      let row = cal[0]
      if (terminDatumIso) {
        const passend = cal.find((r) => r.date === terminDatumIso)
        if (passend) row = passend
        else {
          const zukunft = cal.filter((r) => r.date && r.date >= heute).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
          row = zukunft[0] ?? row
        }
      }

      const epsEst = row.epsEstimate
      const revEst = row.revenueEstimate
      if (epsEst == null && revEst == null) continue

      return {
        quelle: 'finnhub',
        terminDatumIso: row.date ?? terminDatumIso ?? null,
        isEarningsDateEstimate: false,
        earningsCallDateIso: null,
        quartal: row.quarter ?? null,
        jahr: row.year ?? null,
        berichtszeit: row.hour === 'bmo' ? 'vor Börsenöffnung' : row.hour === 'amc' ? 'nach Handelsschluss' : null,
        kennzahlen: [],
        weitereKennzahlen: [],
        quartalsPrognose: null,
        eps: {
          low: null,
          high: null,
          average: epsEst ?? null,
          averageAnzeige: epsEst != null ? String(epsEst) : null,
        },
        umsatz: {
          low: null,
          high: null,
          average: revEst ?? null,
          averageAnzeige: revEst != null ? formatFinnhubUmsatz(revEst) : null,
        },
      }
    } catch {
      continue
    }
  }
  return null
}

function formatFinnhubUmsatz(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Bio.`
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd.`
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio.`
  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 })
}

export async function ladeFinnhubEarningsSchaetzungenKandidaten(
  symbole: string[],
  terminDatumIso?: string,
): Promise<EarningsSchaetzungen | null> {
  const uniq = [...new Set(symbole.flatMap((s) => finnhubSymbole(s)).filter(Boolean))]
  for (const sym of uniq) {
    const hit = await ladeFinnhubEarningsSchaetzungen(sym, terminDatumIso)
    if (hit) return hit
  }
  return null
}
