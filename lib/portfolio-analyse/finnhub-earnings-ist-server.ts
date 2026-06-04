import {
  beatMissAusSurprisePercent,
  beatMissProzent,
  formatBeatMissProzent,
  formatIstWert,
} from '@/lib/portfolio-analyse/earnings-beat-miss'
import type { QuartalsPrognoseMetrik, QuartalsPrognoseZeile } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { periodEndAusEarningsTermin } from '@/lib/portfolio-analyse/earnings-quartal-termin'
import { kalenderQuartalAusPeriodEnd } from '@/lib/portfolio-analyse/earnings-quartals-prognose'

const CACHE_REVALIDATE = 1800

type FinnhubEarningsRow = {
  actual?: number
  estimate?: number
  period?: string
  quarter?: number
  year?: number
  surprise?: number
  surprisePercent?: number
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

function terminIstVergangen(terminDatumIso: string): boolean {
  const heute = heuteIsoUtc()
  return terminDatumIso.slice(0, 10) <= heute
}

function waehleBerichtsZeile(
  rows: FinnhubEarningsRow[],
  terminDatumIso: string,
): FinnhubEarningsRow | null {
  const termin = terminDatumIso.slice(0, 10)
  const mitActual = rows.filter((r) => r.actual != null)
  if (mitActual.length === 0) return null

  const { quartal: zielQ, jahr: zielJ } = kalenderQuartalAusPeriodEnd(
    periodEndAusEarningsTermin(termin),
  )

  const quartalTreffer = mitActual.find(
    (r) => r.quarter === zielQ && r.year === zielJ,
  )
  if (quartalTreffer) return quartalTreffer

  let best: { row: FinnhubEarningsRow; diff: number } | null = null
  for (const r of mitActual) {
    const p = r.period?.slice(0, 10)
    if (!p) continue
    const diff = Math.abs(tageZwischenIso(p, termin))
    if (diff > 120) continue
    if (!best || diff < best.diff) best = { row: r, diff }
  }
  if (best) return best.row

  const sortiert = [...mitActual].sort((a, b) =>
    (b.period ?? '').localeCompare(a.period ?? ''),
  )
  return sortiert.find((r) => (r.period ?? '').slice(0, 10) <= termin) ?? sortiert[0] ?? null
}

export type FinnhubEpsIst = {
  ist: number
  schaetzung: number | null
  surprisePercent: number | null
  periodIso: string | null
  quartal: number | null
  jahr: number | null
}

export async function ladeFinnhubEpsIst(
  symbol: string,
  terminDatumIso?: string,
): Promise<FinnhubEpsIst | null> {
  const key = finnhubKey()
  const termin = terminDatumIso?.slice(0, 10)
  if (!key || !termin || !terminIstVergangen(termin)) return null

  for (const sym of finnhubSymbole(symbol)) {
    const u = new URL('https://finnhub.io/api/v1/stock/earnings')
    u.searchParams.set('symbol', sym)
    u.searchParams.set('token', key)

    try {
      const res = await fetch(u.toString(), { next: { revalidate: CACHE_REVALIDATE } })
      if (!res.ok) continue
      const raw = await res.json()
      const rows: FinnhubEarningsRow[] = Array.isArray(raw) ? raw : []
      const row = waehleBerichtsZeile(rows, termin)
      if (!row || row.actual == null) continue

      return {
        ist: row.actual,
        schaetzung: row.estimate ?? null,
        surprisePercent: row.surprisePercent ?? null,
        periodIso: row.period ?? null,
        quartal: row.quarter ?? null,
        jahr: row.year ?? null,
      }
    } catch {
      continue
    }
  }
  return null
}

export function epsZeileMitIst(
  zeile: QuartalsPrognoseZeile,
  ist: FinnhubEpsIst,
): QuartalsPrognoseZeile {
  const schaetzung = zeile.schaetzung ?? ist.schaetzung
  const beat =
    beatMissAusSurprisePercent(ist.surprisePercent) ??
    beatMissProzent(ist.ist, schaetzung)
  return {
    ...zeile,
    istWert: ist.ist,
    istAnzeige: formatIstWert('eps', ist.ist),
    beatMissProzent: beat,
    beatMissAnzeige: formatBeatMissProzent(beat),
  }
}

export function zeileMitIst(
  zeile: QuartalsPrognoseZeile,
  istWert: number,
  schaetzungOverride?: number | null,
): QuartalsPrognoseZeile {
  const schaetzung = schaetzungOverride ?? zeile.schaetzung
  const beat = beatMissProzent(istWert, schaetzung)
  return {
    ...zeile,
    istWert,
    istAnzeige: formatIstWert(zeile.metrik, istWert),
    beatMissProzent: beat,
    beatMissAnzeige: formatBeatMissProzent(beat),
  }
}
