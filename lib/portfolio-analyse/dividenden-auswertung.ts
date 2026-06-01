import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

const MONAT_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'] as const

const PALETTE = ['#f97316', '#a78bfa', '#f472b6', '#fbbf24', '#22d3ee', '#6366f1', '#94a3b8']

function monatsKey(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : ''
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type DividendenKpis = {
  depotwertEur: number
  dividendenBruttoEur: number
  dividendenNettoEur: number
  steuernAufDivEur: number
  jahreseinkommenTtmEur: number
  monatlichDurchschnittTtmEur: number
  persoenlicheRenditeProzent: number | null
  startDatum: string | null
  investiertEur: number
}

export type DividendenHeatmapZeile = {
  jahr: number
  gesamtEur: number | null
  durchschnittEur: number | null
  monate: (number | null)[]
}

export type DividendenHeatmap = {
  spalten: readonly string[]
  zeilen: DividendenHeatmapZeile[]
  summen: { gesamtEur: number | null; durchschnittEur: number | null; monate: (number | null)[] } | null
  minEur: number
  maxEur: number
}

export type GestapelterDivMonat = {
  monat: string
  label: string
  gesamt: number
  segmente: { key: string; label: string; wert: number; farbe: string }[]
}

export type DividendenJahrVergleich = {
  jahr: number
  betragEur: number
  vsVorjahrProzent: number | null
}

export function berechneDividendenKpis(
  buchungen: PortfolioBuchung[],
  depotwertEur: number,
  investiertEur: number,
): DividendenKpis {
  let brutto = 0
  let steuern = 0
  let minDatum: string | null = null

  const divMonate = new Map<string, number>()
  const jetzt = new Date()
  const ttmKeys: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - i, 1)
    ttmKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  for (const b of buchungen) {
    if (!minDatum || b.datum < minDatum) minDatum = b.datum
    if (b.typ === 'dividende' || b.typ === 'zins') {
      brutto += b.betragEur
      const k = monatsKey(b.datum)
      if (k) divMonate.set(k, (divMonate.get(k) ?? 0) + b.betragEur)
    }
    if (b.typ === 'steuer') steuern += b.betragEur
  }

  const ttm = ttmKeys.reduce((s, k) => s + (divMonate.get(k) ?? 0), 0)
  const jahreseinkommenTtmEur = round2(ttm)
  const monatlichDurchschnittTtmEur = round2(ttm / 12)
  const persRendite =
    depotwertEur > 0 ? round2((jahreseinkommenTtmEur / depotwertEur) * 100) : null

  return {
    depotwertEur,
    dividendenBruttoEur: round2(brutto),
    dividendenNettoEur: round2(brutto),
    steuernAufDivEur: round2(steuern),
    jahreseinkommenTtmEur,
    monatlichDurchschnittTtmEur,
    persoenlicheRenditeProzent: persRendite,
    startDatum: minDatum,
    investiertEur,
  }
}

export function dividendenGestapeltProMonat(
  buchungen: PortfolioBuchung[],
  maxIsins = 6,
  monate = 24,
): GestapelterDivMonat[] {
  const divs = buchungen.filter((b) => b.typ === 'dividende' || b.typ === 'zins')
  const byMonat = new Map<string, Map<string, { label: string; wert: number }>>()

  for (const b of divs) {
    const k = monatsKey(b.datum)
    if (!k) continue
    const isin = b.isin?.toUpperCase() ?? 'sonst'
    const label = b.wertpapierName ?? isin
    const mon = byMonat.get(k) ?? new Map()
    const cur = mon.get(isin) ?? { label, wert: 0 }
    cur.wert += b.betragEur
    mon.set(isin, cur)
    byMonat.set(k, mon)
  }

  const keys = [...byMonat.keys()].sort().slice(-monate)
  return keys.map((monat) => {
    const map = byMonat.get(monat)!
    const sorted = [...map.entries()].sort((a, b) => b[1].wert - a[1].wert)
    const top = sorted.slice(0, maxIsins)
    const rest = sorted.slice(maxIsins).reduce((s, [, v]) => s + v.wert, 0)
    const segmente = top.map(([key, v], i) => ({
      key,
      label: v.label,
      wert: round2(v.wert),
      farbe: PALETTE[i % PALETTE.length],
    }))
    if (rest > 0.01) {
      segmente.push({ key: 'rest', label: 'Weitere', wert: round2(rest), farbe: '#64748b' })
    }
    const gesamt = segmente.reduce((s, x) => s + x.wert, 0)
    const [y, mo] = monat.split('-')
    const d = new Date(Number(y), Number(mo) - 1, 1)
    return {
      monat,
      label: d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
      gesamt: round2(gesamt),
      segmente,
    }
  })
}

export function berechneDividendenHeatmap(buchungen: PortfolioBuchung[]): DividendenHeatmap {
  const map = new Map<string, number>()
  for (const b of buchungen) {
    if (b.typ !== 'dividende' && b.typ !== 'zins') continue
    const k = monatsKey(b.datum)
    if (!k) continue
    map.set(k, round2((map.get(k) ?? 0) + b.betragEur))
  }

  const jahre = [...new Set([...map.keys()].map((k) => Number(k.slice(0, 4))))].sort((a, b) => b - a)
  const jetzt = new Date().getFullYear()
  let minEur = 0
  let maxEur = 0

  const zeilen: DividendenHeatmapZeile[] = jahre
    .filter((y) => y <= jetzt)
    .map((jahr) => {
      const monate: (number | null)[] = []
      const aktuellerMonat = jahr === jetzt ? new Date().getMonth() : 11
      for (let mo = 0; mo < 12; mo++) {
        if (jahr === jetzt && mo > aktuellerMonat) {
          monate.push(null)
          continue
        }
        const key = `${jahr}-${String(mo + 1).padStart(2, '0')}`
        const val = map.get(key) ?? 0
        monate.push(val)
        if (val > 0) {
          minEur = Math.min(minEur, val)
          maxEur = Math.max(maxEur, val)
        }
      }
      const vals = monate.filter((v): v is number => v != null)
      const gesamt = vals.length ? round2(vals.reduce((a, b) => a + b, 0)) : null
      const durchschnitt = vals.length ? round2(gesamt! / vals.filter((v) => v > 0).length || 1) : null
      if (gesamt != null) maxEur = Math.max(maxEur, gesamt)
      return { jahr, gesamtEur: gesamt, durchschnittEur: durchschnitt, monate }
    })

  const summen =
    zeilen.length > 0
      ? {
          gesamtEur: round2(zeilen.reduce((s, z) => s + (z.gesamtEur ?? 0), 0)),
          durchschnittEur: round2(
            zeilen.reduce((s, z) => s + (z.durchschnittEur ?? 0), 0) / zeilen.length,
          ),
          monate: MONAT_KURZ.map((_, i) =>
            round2(zeilen.reduce((s, z) => s + (z.monate[i] ?? 0), 0)),
          ),
        }
      : null

  if (maxEur === 0) maxEur = 1

  return { spalten: ['Gesamt', 'Ø', ...MONAT_KURZ], zeilen, summen, minEur, maxEur }
}

export function dividendenProJahrMitVergleich(buchungen: PortfolioBuchung[]): DividendenJahrVergleich[] {
  const byYear = new Map<number, number>()
  for (const b of buchungen) {
    if (b.typ !== 'dividende' && b.typ !== 'zins') continue
    const y = Number(b.datum.slice(0, 4))
    if (!Number.isFinite(y)) continue
    byYear.set(y, round2((byYear.get(y) ?? 0) + b.betragEur))
  }
  const jahre = [...byYear.keys()].sort((a, b) => b - a)
  return jahre.map((jahr, i) => {
    const betrag = byYear.get(jahr)!
    const vor = jahre[i + 1] != null ? byYear.get(jahre[i + 1]!) : null
    const vsVorjahrProzent =
      vor != null && vor > 0 ? round2(((betrag - vor) / vor) * 100) : null
    return { jahr, betragEur: betrag, vsVorjahrProzent }
  })
}
