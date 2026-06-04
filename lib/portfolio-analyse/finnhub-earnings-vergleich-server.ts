import {
  formatWachstumProzent,
  kennzahlAusSpanne,
  wachstumProzent,
} from '@/lib/portfolio-analyse/earnings-kennzahlen'
import type { EarningsKennzahlPrognose } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import type { EarningsSchaetzungSpanne } from '@/lib/portfolio-analyse/earnings-schaetzungen'

const CACHE_REVALIDATE = 3600

type FinnhubEarningsRow = {
  actual?: number
  estimate?: number
  period?: string
  quarter?: number
  year?: number
  symbol?: string
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

function quartalLabel(q: number | null, jahr: number | null): string {
  if (q != null && jahr != null) return `Q${q} ${jahr}`
  return 'Vorjahresquartal'
}

export type FinnhubQuartalsVergleich = {
  quartal: number | null
  jahr: number | null
  periodIso: string | null
  eps: EarningsSchaetzungSpanne
  kennzahl: EarningsKennzahlPrognose
}

export async function ladeFinnhubQuartalsEpsVergleich(
  symbol: string,
  terminDatumIso?: string,
): Promise<FinnhubQuartalsVergleich | null> {
  const key = finnhubKey()
  if (!key) return null

  for (const sym of finnhubSymbole(symbol)) {
    const u = new URL('https://finnhub.io/api/v1/stock/earnings')
    u.searchParams.set('symbol', sym)
    u.searchParams.set('token', key)

    try {
      const res = await fetch(u.toString(), { next: { revalidate: CACHE_REVALIDATE } })
      if (!res.ok) continue
      const raw = await res.json()
      const rows: FinnhubEarningsRow[] = Array.isArray(raw) ? raw : []
      if (rows.length === 0) continue

      const sortiert = [...rows].sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''))
      const zukuenftig = sortiert.find(
        (r) =>
          r.estimate != null &&
          r.period &&
          (!terminDatumIso || r.period >= terminDatumIso.slice(0, 7)),
      )
      const ziel =
        zukuenftig ??
        sortiert.find((r) => r.estimate != null) ??
        sortiert[0]
      if (!ziel?.period || ziel.estimate == null) continue

      const [y, m] = ziel.period.split('-').map(Number)
      const vorjahrPeriod = `${y - 1}-${String(m).padStart(2, '0')}`
      const vorjahr = rows.find((r) => r.period?.startsWith(vorjahrPeriod) && r.actual != null)

      const eps: EarningsSchaetzungSpanne = {
        low: null,
        high: null,
        average: ziel.estimate,
        averageAnzeige: ziel.estimate.toLocaleString('de-DE', { maximumFractionDigits: 4 }),
      }
      const vorjahrWert = vorjahr?.actual ?? null
      const w = wachstumProzent(ziel.estimate, vorjahrWert)

      const kennzahl = kennzahlAusSpanne('eps', 'Gewinn je Aktie (EPS)', eps, {
        vorjahrWert,
        vorjahrAnzeige:
          vorjahrWert != null
            ? vorjahrWert.toLocaleString('de-DE', { maximumFractionDigits: 4 })
            : null,
        wachstumProzent: w,
        vergleichArt: 'vorjahr_quartal',
        vergleichLabel: `vs. ${quartalLabel(vorjahr?.quarter ?? ziel.quarter ?? null, (vorjahr?.year ?? ziel.year ?? 0) - 1)}`,
      })
      if (!kennzahl) continue

      return {
        quartal: ziel.quarter ?? null,
        jahr: ziel.year ?? null,
        periodIso: ziel.period,
        eps,
        kennzahl,
      }
    } catch {
      continue
    }
  }
  return null
}

export function finnhubKennzahlMitWachstumAnzeige(k: EarningsKennzahlPrognose): EarningsKennzahlPrognose {
  if (k.wachstumAnzeige) return k
  return { ...k, wachstumAnzeige: formatWachstumProzent(k.wachstumProzent) }
}
