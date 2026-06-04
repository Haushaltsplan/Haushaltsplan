import { berichtszeitAusFinnhubHour } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { heuteIsoUtc, isoInJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'

const CACHE_REVALIDATE = 3600

export type FinnhubEarningsKalenderTermin = {
  terminDatumIso: string
  berichtszeit: Berichtszeit | null
  quartal: number | null
  jahr: number | null
}

function finnhubKey(): string | null {
  const k = (process.env.FINNHUB_API_KEY ?? '').trim()
  return k.length > 0 ? k : null
}

function finnhubSymbole(sym: string): string[] {
  const s = sym.trim().toUpperCase()
  if (!s) return []
  const out = [s]
  const m = /^([A-Z0-9-]+)\.([A-Z]{1,3})$/.exec(s)
  if (m && !out.includes(m[1])) out.push(m[1])
  return out
}

type FinnhubEarningsRow = {
  date?: string
  hour?: string
  quarter?: number
  year?: number
}

export async function ladeFinnhubEarningsKalenderTermin(
  symbol: string,
): Promise<FinnhubEarningsKalenderTermin | null> {
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
      const cal = (rows.earningsCalendar ?? []).filter((r) => r.date && r.date >= heute)
      if (cal.length === 0) continue

      cal.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      const row = cal[0]
      if (!row.date) continue

      return {
        terminDatumIso: row.date,
        berichtszeit: berichtszeitAusFinnhubHour(row.hour),
        quartal: row.quarter ?? null,
        jahr: row.year ?? null,
      }
    } catch {
      continue
    }
  }
  return null
}

export async function ladeFinnhubEarningsKalenderTerminKandidaten(
  symbole: string[],
): Promise<FinnhubEarningsKalenderTermin | null> {
  const uniq = [...new Set(symbole.flatMap((s) => finnhubSymbole(s)).filter(Boolean))]
  for (const sym of uniq) {
    const hit = await ladeFinnhubEarningsKalenderTermin(sym)
    if (hit) return hit
  }
  return null
}
