import { berichtszeitAusFinnhubHour } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { heuteIsoUtc, isoInJahren, isoVorJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
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

export function finnhubSymbole(sym: string): string[] {
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

function parseKalenderRows(
  rows: FinnhubEarningsRow[],
  von: string,
  bis: string,
): FinnhubEarningsKalenderTermin[] {
  return rows
    .filter((r) => r.date && r.date >= von && r.date <= bis)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .map((row) => ({
      terminDatumIso: row.date!,
      berichtszeit: berichtszeitAusFinnhubHour(row.hour),
      quartal: row.quarter ?? null,
      jahr: row.year ?? null,
    }))
}

async function fetchFinnhubKalender(sym: string, von: string, bis: string): Promise<FinnhubEarningsKalenderTermin[]> {
  const key = finnhubKey()
  if (!key) return []

  const u = new URL('https://finnhub.io/api/v1/calendar/earnings')
  u.searchParams.set('from', von)
  u.searchParams.set('to', bis)
  u.searchParams.set('symbol', sym)
  u.searchParams.set('token', key)

  const res = await fetch(u.toString(), { next: { revalidate: CACHE_REVALIDATE } })
  if (!res.ok) return []
  const data = (await res.json()) as { earningsCalendar?: FinnhubEarningsRow[] }
  return parseKalenderRows(data.earningsCalendar ?? [], von, bis)
}

export async function ladeFinnhubEarningsKalenderImZeitraum(
  symbol: string,
  von: string,
  bis: string,
): Promise<FinnhubEarningsKalenderTermin[]> {
  for (const sym of finnhubSymbole(symbol)) {
    try {
      const termine = await fetchFinnhubKalender(sym, von, bis)
      if (termine.length > 0) return termine
    } catch {
      continue
    }
  }
  return []
}

export async function ladeFinnhubEarningsKalenderTermine(symbol: string): Promise<FinnhubEarningsKalenderTermin[]> {
  const heute = heuteIsoUtc()
  const bis = isoInJahren(1)
  return ladeFinnhubEarningsKalenderImZeitraum(symbol, heute, bis)
}

export async function ladeFinnhubEarningsKalenderTermin(
  symbol: string,
): Promise<FinnhubEarningsKalenderTermin | null> {
  const termine = await ladeFinnhubEarningsKalenderTermine(symbol)
  return termine[0] ?? null
}

export async function ladeFinnhubEarningsKalenderTerminKandidaten(
  symbole: string[],
): Promise<FinnhubEarningsKalenderTermin | null> {
  const alle = await ladeFinnhubEarningsKalenderAlle(symbole)
  return alle[0] ?? null
}

export async function ladeFinnhubEarningsKalenderAlle(
  symbole: string[],
): Promise<FinnhubEarningsKalenderTermin[]> {
  const heute = heuteIsoUtc()
  const bis = isoInJahren(1)
  const uniq = [...new Set(symbole.flatMap((s) => finnhubSymbole(s)).filter(Boolean))]
  for (const sym of uniq) {
    const termine = await ladeFinnhubEarningsKalenderImZeitraum(sym, heute, bis)
    if (termine.length > 0) return termine
  }
  return []
}

/** Alle Kalender-Termine je Symbol (z. B. ±1 Jahr). */
export async function ladeFinnhubEarningsKalenderAlleImZeitraum(
  symbole: string[],
  von?: string,
  bis?: string,
): Promise<FinnhubEarningsKalenderTermin[]> {
  const heute = heuteIsoUtc()
  const vonIso = von ?? isoVorJahren(1)
  const bisIso = bis ?? isoInJahren(1)
  const uniq = [...new Set(symbole.flatMap((s) => finnhubSymbole(s)).filter(Boolean))]
  for (const sym of uniq) {
    const termine = await ladeFinnhubEarningsKalenderImZeitraum(sym, vonIso, bisIso)
    if (termine.length > 0) return termine
  }
  return []
}
