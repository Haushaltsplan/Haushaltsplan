import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  finnhubDividendenVerfuegbar,
  ladeFinnhubAnkuendigteDividende,
} from '@/lib/portfolio-analyse/finnhub-ankuendigte-dividenden-server'
import { ladeYahooAnkuendigteDividende } from '@/lib/portfolio-analyse/yahoo-ankuendigte-dividenden-server'

export type DepotPositionAnfrage = {
  isin: string | null
  name: string
  stueck: number
  symbolYahoo: string | null
  symbolCandidates?: string[]
}

export type AnkuendigteDividendeQuelle = 'yahoo' | 'finnhub'

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
  return out
}

type RohTreffer = {
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
  symbol: string
  quelle: AnkuendigteDividendeQuelle
}

async function ladeFuerSymbole(symbole: string[]): Promise<RohTreffer | null> {
  const uniq = [...new Set(symbole)]

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
    const y = await ladeYahooAnkuendigteDividende(sym)
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
  const aktiv = positionen.filter((p) => p.stueck > 0 && symboleFuerPosition(p).length > 0)
  const symboleGesamt = aktiv.reduce((s, p) => s + symboleFuerPosition(p).length, 0)
  const stat = { finnhub: 0, yahoo: 0, ohneTreffer: 0 }

  const roh = await mapPool(aktiv, 6, async (pos) => {
    const symbole = symboleFuerPosition(pos)
    const hit = await ladeFuerSymbole(symbole)
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
    if (stat.finnhub > 0) teile.push(`${stat.finnhub} Finnhub`)
    if (stat.yahoo > 0) teile.push(`${stat.yahoo} Yahoo`)
    hinweise.push(
      `${eintraege.length} von ${aktiv.length} Position(en): ${teile.join(', ')}. Nur voraus, max. 1 Jahr.`,
    )
  }

  if (finnhubDividendenVerfuegbar()) {
    hinweise.push('Finnhub zuerst, dann Yahoo — jeweils nur Depot-Symbole.')
  } else {
    hinweise.push('Nur Yahoo — Termine ab heute, höchstens +1 Jahr.')
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
