/**
 * EU URD Key-Figures-Historie (z. B. Hermès 5-Jahres-Tabelle).
 * Füllt Umsatz/EBIT/NI/FCF/EK wenn Yahoo/Macrotrends zu dünn sind.
 */

import 'server-only'

import { formatFundamentalPeriodeLabel } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { ladeEuUrdNotesText } from '@/lib/portfolio-analyse/eu-urd-notes-server'

export type EuUrdHistorieRoh = {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  quelle: 'eu_urd'
}

function parseZahlenreihe(raw: string): number[] {
  return [...raw.matchAll(/-?[\d]{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/g)]
    .map((m) => Number(m[0]!.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n))
}

/**
 * Hermès-Stil:
 * "In millions of euros 2025 2024 … Revenue …"
 * Auch: CHF million / £m / in Mio. € / EUR million
 */
export function parseEuKeyFiguresHistorieAusText(text: string): EuUrdHistorieRoh | null {
  const t = text.replace(/\s+/g, ' ')
  const header = t.match(
    /(?:In millions of (?:euros?|CHF|pounds?)|in Mio\.?\s*€|EUR million|CHF million|£m|US\$ million)\s+(20[12]\d)\s+(20[12]\d)\s+(20[12]\d)(?:\s+(20[12]\d))?(?:\s+(20[12]\d))?/i,
  )
  if (!header) return null

  const jahre = [header[1], header[2], header[3], header[4], header[5]]
    .filter((y): y is string => Boolean(y))
    .map((y) => parseInt(y, 10))
  if (jahre.length < 3) return null

  const block = t.slice(header.index ?? 0, (header.index ?? 0) + 2200)

  const rows: Array<{
    id: string
    label: string
    gruppe: FundamentalMetrikZeile['gruppe']
    re: RegExp
  }> = [
    {
      id: 'umsatz',
      label: 'Umsatz',
      gruppe: 'finanzdaten',
      re: /\b(?:Revenue|Net sales|Umsatzerlöse|Umsatz|Sales)\b([^%]{0,100}?)(?=Growth|Recurring|Operating|Net income|Gross|EBIT|Kosten|$)/i,
    },
    {
      id: 'ebit',
      label: 'EBIT',
      gruppe: 'finanzdaten',
      // Wichtig: Capture nach ALLEN Alternativen (sonst matcht „Recurring operating income“ ohne Zahlen)
      re: /\b(?:(?:Recurring )?Operating (?:income|profit|result)|EBIT)\b(?:\s+\d)?([^%]{0,120}?)(?=in % of|Operating income|Net income|EBITDA|$)/i,
    },
    {
      id: 'nettogewinn',
      label: 'Nettogewinn',
      gruppe: 'finanzdaten',
      re: /(?:Net income(?: attributable to owners of the parent)?|Ergebnis nach Steuern|Konzernergebnis)([^%]{0,100}?)(?=in % of|Operating cash|Equity|Dividende|$)/i,
    },
    {
      id: 'fcf',
      label: 'Free Cashflow (FCF)',
      gruppe: 'cashflow',
      re: /(?:(?:Adjusted )?free cash flows?|Free Cashflow|Cashflow aus laufender Geschäftstätigkeit abzüglich Investition)([^A-Za-z%]{0,120}?)(?=Equity|Net cash|Headcount|Eigenkapital|$)/i,
    },
    {
      id: 'eigenkapital',
      label: 'Eigenkapital',
      gruppe: 'bilanz',
      re: /(?:Equity attributable to owners of the parent|Equity|Eigenkapital)([^A-Za-z]{0,100}?)(?=Net cash|Restated|Headcount|Net debt|Finanzverbindlichkeiten|$)/i,
    },
    {
      id: 'ocf',
      label: 'Operativer Cashflow',
      gruppe: 'cashflow',
      re: /(?:Operating cash flows?|Cashflow aus laufender|Cash from operating)([^A-Za-z]{0,100}?)(?=Operating investments|Adjusted free|Investition|CapEx|$)/i,
    },
    {
      id: 'capex',
      label: 'CapEx (Investitionen)',
      gruppe: 'cashflow',
      re: /(?:Operating investments|Capital expenditure|Investitionen|CapEx)([^A-Za-z]{0,100}?)(?=Adjusted free|Equity|Free cash|$)/i,
    },
  ]

  const periodenIso = jahre.map((y) => `${y}-12-31`)
  const perioden: FundamentalPeriode[] = periodenIso.map((iso) => ({
    iso,
    label: formatFundamentalPeriodeLabel(iso, 'jahr'),
  }))

  const zeilen: FundamentalMetrikZeile[] = []
  for (const row of rows) {
    const m = block.match(row.re)
    if (!m?.[1]) continue
    let vals = parseZahlenreihe(m[1])
    if (vals.length > jahre.length && vals[0]! > 0 && vals[0]! < 20 && vals[1]! > 100) {
      vals = vals.slice(1)
    }
    if (vals.length < jahre.length) continue
    const werte: Record<string, number | null> = {}
    for (let i = 0; i < jahre.length; i++) {
      let v = vals[i] ?? null
      // CapEx in URD oft positiv („investments“) — Yahoo/MT erwarten negativ
      if (row.id === 'capex' && v != null && v > 0) v = -v
      werte[periodenIso[i]!] = v
    }
    zeilen.push({
      id: row.id,
      label: row.label,
      gruppe: row.gruppe,
      einheit: 'waehrung_usd_mio',
      werte,
    })
  }

  const ni = zeilen.find((z) => z.id === 'nettogewinn')
  const ek = zeilen.find((z) => z.id === 'eigenkapital')
  if (ni && ek) {
    const werte: Record<string, number | null> = {}
    for (const iso of periodenIso) {
      const n = ni.werte[iso]
      const e = ek.werte[iso]
      werte[iso] = n != null && e != null && e !== 0 ? Math.round((n / e) * 1000) / 10 : null
    }
    zeilen.push({
      id: 'roe',
      label: 'Eigenkapitalrendite (ROE %)',
      gruppe: 'rentabilitaet',
      einheit: 'prozent',
      werte,
    })
  }

  if (zeilen.length < 2) return null
  return { perioden, zeilen, quelle: 'eu_urd' }
}

export async function ladeEuUrdHistorie(opts: {
  isin: string
  ticker: string
  firmenname?: string | null
}): Promise<EuUrdHistorieRoh | null> {
  const doc = await ladeEuUrdNotesText(opts)
  if (!doc) return null
  return parseEuKeyFiguresHistorieAusText(doc.text)
}
