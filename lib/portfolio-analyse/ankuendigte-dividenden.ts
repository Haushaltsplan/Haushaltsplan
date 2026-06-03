import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { isinAusYahooSymbol, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  finnhubDividendKalenderGesperrt,
  finnhubDividendenVerfuegbar,
  ladeFinnhubAnkuendigteDividende,
} from '@/lib/portfolio-analyse/finnhub-ankuendigte-dividenden-server'
import { istEuEwrIsin } from '@/lib/portfolio-analyse/dividend-isin-region'
import {
  ladeDivvydiaryAnkuendigteDividende,
  vorladeDivvydiaryEu,
} from '@/lib/portfolio-analyse/divvydiary-ankuendigte-dividenden-server'
import { ladeYahooAnkuendigteDividende } from '@/lib/portfolio-analyse/yahoo-ankuendigte-dividenden-server'

export type DepotPositionAnfrage = {
  isin: string | null
  name: string
  stueck: number
  symbolYahoo: string | null
  symbolCandidates?: string[]
}

export type AnkuendigteDividendeQuelle = 'divvydiary' | 'yahoo' | 'finnhub'

export type AnkuendigteDividendeEintrag = {
  isin: string | null
  name: string
  stueck: number
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
  gesamtEur: number
  symbol: string
  quelle: AnkuendigteDividendeQuelle
}

export type AnkuendigterDivMonat = {
  monatKey: string
  monatLabel: string
  summeEur: number
  eintraege: AnkuendigteDividendeEintrag[]
}

export type AnkuendigteDividendenErgebnis = {
  monate: AnkuendigterDivMonat[]
  eintraege: AnkuendigteDividendeEintrag[]
  hinweise: string[]
  abgefragteSymbole: number
  treffer: number
  statistik: {
    divvydiary: number
    finnhub: number
    yahoo: number
    ohneTreffer: number
  }
}

const MONAT_LABEL = [
  'JANUAR',
  'FEBRUAR',
  'MÄRZ',
  'APRIL',
  'MAI',
  'JUNI',
  'JULI',
  'AUGUST',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DEZEMBER',
] as const

function monatLabel(monatKey: string): string {
  const m = Number(monatKey.slice(5, 7))
  return MONAT_LABEL[m - 1] ?? monatKey
}

function symboleFuerPosition(pos: DepotPositionAnfrage): string[] {
  const out: string[] = []
  const add = (s: string | null | undefined) => {
    for (const t of brokerSymbolKandidaten(s ?? '')) {
      if (!out.includes(t)) out.push(t)
    }
  }
  add(pos.symbolYahoo)
  for (const c of pos.symbolCandidates ?? []) add(c)
  const k = isinKenntnis(isinFuerPosition(pos))
  add(k?.symbolYahoo)
  for (const c of k?.symbolCandidates ?? []) add(c)
  return out
}

type RohTreffer = {
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
  symbol: string
  quelle: AnkuendigteDividendeQuelle
}

function positionHatIsin(pos: DepotPositionAnfrage): boolean {
  return isinFuerPosition(pos).length >= 10
}

function isinFuerPosition(pos: DepotPositionAnfrage): string {
  const direkt = pos.isin?.trim().toUpperCase() ?? ''
  if (direkt.length >= 10) return direkt
  for (const sym of [pos.symbolYahoo, ...(pos.symbolCandidates ?? [])]) {
    const ausSym = isinAusYahooSymbol(sym)
    if (ausSym) return ausSym
  }
  return ''
}

async function ladeFuerPosition(pos: DepotPositionAnfrage): Promise<RohTreffer | null> {
  const symbole = symboleFuerPosition(pos)
  const symbolAnzeige = symbole[0] ?? pos.isin ?? '—'
  const isin = isinFuerPosition(pos)
  const k = isin ? isinKenntnis(isin) : null
  const name = k?.name ?? pos.name

  if (isin) {
    const d = await ladeDivvydiaryAnkuendigteDividende(isin, name)
    if (d) {
      return {
        zahlungsdatumIso: d.zahlungsdatumIso,
        exDatumIso: d.exDatumIso,
        dividendeProStueckEur: d.dividendeProStueckEur,
        symbol: symbolAnzeige,
        quelle: 'divvydiary',
      }
    }
  }

  if (isin && istEuEwrIsin(isin)) {
    return null
  }

  return ladeFuerSymbole(symbole, symbolAnzeige)
}

async function ladeFuerSymbole(symbole: string[], symbolAnzeige: string): Promise<RohTreffer | null> {
  const uniq = [...new Set(symbole)]
  if (uniq.length === 0) return null

  if (finnhubDividendenVerfuegbar()) {
    for (const sym of uniq) {
      const f = await ladeFinnhubAnkuendigteDividende(sym)
      if (f) {
        return {
          zahlungsdatumIso: f.zahlungsdatumIso,
          exDatumIso: f.exDatumIso,
          dividendeProStueckEur: f.dividendeProStueckEur,
          symbol: f.symbol,
          quelle: 'finnhub',
        }
      }
    }
  }

  for (const sym of uniq) {
    const y = await ladeYahooAnkuendigteDividende(sym, { erlaubeExSchaetzung: true })
    if (y) {
      return {
        zahlungsdatumIso: y.zahlungsdatumIso,
        exDatumIso: y.exDatumIso,
        dividendeProStueckEur: y.dividendeProStueckEur,
        symbol: y.symbol,
        quelle: 'yahoo',
      }
    }
  }

  return null
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

export function gruppiereAnkuendigteNachMonat(eintraege: AnkuendigteDividendeEintrag[]): AnkuendigterDivMonat[] {
  const byMonat = new Map<string, AnkuendigteDividendeEintrag[]>()
  for (const e of eintraege) {
    const key = e.zahlungsdatumIso.slice(0, 7)
    const list = byMonat.get(key) ?? []
    list.push(e)
    byMonat.set(key, list)
  }
  return [...byMonat.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monatKey, list]) => {
      const sorted = [...list].sort((a, b) => a.zahlungsdatumIso.localeCompare(b.zahlungsdatumIso))
      const summeEur = Math.round(sorted.reduce((s, x) => s + x.gesamtEur, 0) * 100) / 100
      return {
        monatKey,
        monatLabel: monatLabel(monatKey),
        summeEur,
        eintraege: sorted,
      }
    })
}

/** Nur Depot-Positionen — nur angekündigte Termine heute … +1 Jahr. */
export async function berechneAnkuendigteDividendenDepot(
  positionen: DepotPositionAnfrage[],
): Promise<AnkuendigteDividendenErgebnis> {
  const hinweise: string[] = []
  const aktiv = positionen.filter(
    (p) => p.stueck > 0 && (symboleFuerPosition(p).length > 0 || positionHatIsin(p)),
  )
  const symboleGesamt = aktiv.reduce((s, p) => s + symboleFuerPosition(p).length, 0)
  const stat = { divvydiary: 0, finnhub: 0, yahoo: 0, ohneTreffer: 0 }

  await vorladeDivvydiaryEu(
    aktiv.map((p) => ({
      isin: isinFuerPosition(p),
      name: isinKenntnis(isinFuerPosition(p))?.name ?? p.name,
    })),
  )

  const roh = await mapPool(aktiv, 2, async (pos) => {
    const hit = await ladeFuerPosition(pos)
    if (!hit) {
      stat.ohneTreffer++
      return null
    }
    stat[hit.quelle]++
    const gesamtEur = Math.round(pos.stueck * hit.dividendeProStueckEur * 100) / 100
    if (gesamtEur <= 0) {
      stat.ohneTreffer++
      stat[hit.quelle]--
      return null
    }
    return {
      isin: pos.isin,
      name: pos.name,
      stueck: pos.stueck,
      zahlungsdatumIso: hit.zahlungsdatumIso,
      exDatumIso: hit.exDatumIso,
      dividendeProStueckEur: hit.dividendeProStueckEur,
      gesamtEur,
      symbol: hit.symbol,
      quelle: hit.quelle,
    } satisfies AnkuendigteDividendeEintrag
  })

  const eintraege = roh
    .filter((x): x is AnkuendigteDividendeEintrag => x != null)
    .sort((a, b) => a.zahlungsdatumIso.localeCompare(b.zahlungsdatumIso))

  if (aktiv.length === 0) {
    hinweise.push('Keine offenen Positionen mit Börsen-Symbol — ISIN-Metadaten ggf. noch laden.')
  } else if (eintraege.length === 0) {
    hinweise.push(
      'Keine angekündigten Dividenden im Zeitraum heute bis +1 Jahr (ETFs/thesaurierend oder ohne Termin).',
    )
  } else {
    const teile: string[] = []
    if (stat.divvydiary > 0) teile.push(`${stat.divvydiary} DivvyDiary`)
    if (stat.finnhub > 0) teile.push(`${stat.finnhub} Finnhub`)
    if (stat.yahoo > 0) teile.push(`${stat.yahoo} Yahoo`)
    hinweise.push(
      `${eintraege.length} von ${aktiv.length} Position(en): ${teile.join(', ')}. Nur voraus, max. 1 Jahr.`,
    )
  }

  hinweise.push(
    'EU-Zahltage nur DivvyDiary (exakte Termine). US: DivvyDiary oder Yahoo. Max. 1 Jahr voraus.',
  )
  if (finnhubDividendKalenderGesperrt()) {
    hinweise.push('Finnhub-Kalender im Free-Tier nicht verfügbar (403).')
  }

  return {
    monate: gruppiereAnkuendigteNachMonat(eintraege),
    eintraege,
    hinweise,
    abgefragteSymbole: symboleGesamt,
    treffer: eintraege.length,
    statistik: stat,
  }
}
