import {
  dedupePrognosenImQuartalsabstand,
  MIN_TAGE_PROGNOSE_NACH_BESTAETIGT,
} from '@/lib/portfolio-analyse/dividenden-prognose'
import type { DividendenPrognoseTreffer } from '@/lib/portfolio-analyse/dividenden-prognose'
import {
  brokerSymbolKandidaten,
  heuteIsoUtc,
  tageZwischenIso,
} from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { isinAusYahooSymbol, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  finnhubDividendKalenderGesperrt,
  finnhubDividendenVerfuegbar,
  ladeFinnhubAnkuendigteDividende,
} from '@/lib/portfolio-analyse/finnhub-ankuendigte-dividenden-server'
import { istEuEwrIsin } from '@/lib/portfolio-analyse/dividend-isin-region'
import {
  ladeDivvydiaryAnkuendigteDividenden,
  vorladeDivvydiary,
} from '@/lib/portfolio-analyse/divvydiary-ankuendigte-dividenden-server'
import { ladeYahooAnkuendigteDividenden } from '@/lib/portfolio-analyse/yahoo-ankuendigte-dividenden-server'

export type DepotPositionAnfrage = {
  isin: string | null
  name: string
  stueck: number
  symbolYahoo: string | null
  symbolCandidates?: string[]
}

export type AnkuendigteDividendeQuelle = 'divvydiary' | 'divvydiary-prognose' | 'yahoo' | 'finnhub'

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
  bestaetigt: boolean
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
    prognose: number
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
  bestaetigt: boolean
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

function rohZuPrognose(t: RohTreffer): DividendenPrognoseTreffer {
  return {
    payDate: t.zahlungsdatumIso,
    exDate: t.exDatumIso ?? t.zahlungsdatumIso,
    amount: t.dividendeProStueckEur,
    bestaetigt: t.bestaetigt,
  }
}

function prognoseZuRoh(t: DividendenPrognoseTreffer, vorlage: RohTreffer): RohTreffer {
  return {
    ...vorlage,
    zahlungsdatumIso: t.payDate,
    exDatumIso: t.exDate,
    dividendeProStueckEur: t.amount,
    bestaetigt: t.bestaetigt,
    quelle: t.bestaetigt ? vorlage.quelle : 'divvydiary-prognose',
  }
}

/** Keine doppelten Schätzungen im Quartalsfenster (z. B. Jul + Aug → nur Aug). */
function bereinigeTrefferProPosition(treffer: RohTreffer[]): RohTreffer[] {
  if (treffer.length <= 1) return treffer
  const termini = treffer.map(rohZuPrognose)
  const slots: { monat: number; payTag: number; exTag: number }[] = []
  const past: { payDate: string; exDate: string; amount: number; forecast: boolean }[] = []

  const heute = heuteIsoUtc()
  const byMonat = new Map<number, Set<string>>()
  for (const t of treffer) {
    if (!t.bestaetigt && t.zahlungsdatumIso >= heute) continue
    const m = Number(t.zahlungsdatumIso.slice(5, 7))
    const j = t.zahlungsdatumIso.slice(0, 4)
    const set = byMonat.get(m) ?? new Set()
    set.add(j)
    byMonat.set(m, set)
    past.push({
      payDate: t.zahlungsdatumIso,
      exDate: t.exDatumIso ?? t.zahlungsdatumIso,
      amount: t.dividendeProStueckEur,
      forecast: false,
    })
  }
  for (const [monat, jahre] of byMonat) {
    const probe = treffer.find((t) => Number(t.zahlungsdatumIso.slice(5, 7)) === monat)
    if (!probe) continue
    slots.push({
      monat,
      payTag: Number(probe.zahlungsdatumIso.slice(8, 10)),
      exTag: Number((probe.exDatumIso ?? probe.zahlungsdatumIso).slice(8, 10)),
    })
    void jahre
  }

  const bereinigt = dedupePrognosenImQuartalsabstand(termini, slots, past)
  const byPay = new Map(treffer.map((t) => [t.zahlungsdatumIso, t]))
  return bereinigt.map((t) => {
    const vorlage = byPay.get(t.payDate) ?? treffer[0]
    return prognoseZuRoh(t, vorlage)
  })
}

function mergeRohTreffer(primary: RohTreffer[], extra: RohTreffer[]): RohTreffer[] {
  const merged = [...primary]
  for (const t of extra) {
    const clashIdx = merged.findIndex(
      (m) =>
        Math.abs(tageZwischenIso(m.zahlungsdatumIso, t.zahlungsdatumIso)) <
        MIN_TAGE_PROGNOSE_NACH_BESTAETIGT,
    )
    if (clashIdx >= 0) {
      const prev = merged[clashIdx]
      if (!prev.bestaetigt && t.bestaetigt) {
        merged[clashIdx] = t
        continue
      }
      if (prev.bestaetigt) continue
      if (!t.bestaetigt) continue
      continue
    }
    merged.push(t)
  }
  return bereinigeTrefferProPosition(merged)
}

async function ladeFuerPosition(pos: DepotPositionAnfrage): Promise<RohTreffer[]> {
  const symbole = symboleFuerPosition(pos)
  const symbolAnzeige = symbole[0] ?? pos.isin ?? '—'
  const isin = isinFuerPosition(pos)
  const k = isin ? isinKenntnis(isin) : null
  const name = k?.name ?? pos.name

  if (isin) {
    let termine = await ladeDivvydiaryAnkuendigteDividenden(isin, name)
    let roh: RohTreffer[] = termine.map((t) => ({
      zahlungsdatumIso: t.zahlungsdatumIso,
      exDatumIso: t.exDatumIso,
      dividendeProStueckEur: t.dividendeProStueckEur,
      symbol: symbolAnzeige,
      quelle: t.bestaetigt ? 'divvydiary' : 'divvydiary-prognose',
      bestaetigt: t.bestaetigt,
    }))

    if (!istEuEwrIsin(isin) && symbole.length > 0) {
      const yahoo = await ladeYahooAnkuendigteDividenden(symbole[0], { erlaubeExSchaetzung: true })
      const yRoh = yahoo.map((t) => ({
        zahlungsdatumIso: t.zahlungsdatumIso,
        exDatumIso: t.exDatumIso,
        dividendeProStueckEur: t.dividendeProStueckEur,
        symbol: t.symbol,
        quelle: (t.bestaetigt ? 'yahoo' : 'divvydiary-prognose') as AnkuendigteDividendeQuelle,
        bestaetigt: t.bestaetigt,
      }))
      roh = mergeRohTreffer(roh, yRoh)
    }

    if (roh.length > 0) return bereinigeTrefferProPosition(roh)
  }

  if (isin && istEuEwrIsin(isin)) {
    return []
  }

  return bereinigeTrefferProPosition(await ladeFuerSymbole(symbole, symbolAnzeige))
}

async function ladeFuerSymbole(symbole: string[], symbolAnzeige: string): Promise<RohTreffer[]> {
  const uniq = [...new Set(symbole)]
  if (uniq.length === 0) return []

  if (finnhubDividendenVerfuegbar()) {
    for (const sym of uniq) {
      const f = await ladeFinnhubAnkuendigteDividende(sym)
      if (f) {
        return [
          {
            zahlungsdatumIso: f.zahlungsdatumIso,
            exDatumIso: f.exDatumIso,
            dividendeProStueckEur: f.dividendeProStueckEur,
            symbol: f.symbol,
            quelle: 'finnhub',
            bestaetigt: true,
          },
        ]
      }
    }
  }

  for (const sym of uniq) {
    const y = await ladeYahooAnkuendigteDividenden(sym, { erlaubeExSchaetzung: true })
    if (y.length > 0) {
      return y.map((t) => ({
        zahlungsdatumIso: t.zahlungsdatumIso,
        exDatumIso: t.exDatumIso,
        dividendeProStueckEur: t.dividendeProStueckEur,
        symbol: t.symbol,
        quelle: (t.bestaetigt ? 'yahoo' : 'divvydiary-prognose') as AnkuendigteDividendeQuelle,
        bestaetigt: t.bestaetigt,
      }))
    }
  }

  return []
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
  const stat = { divvydiary: 0, prognose: 0, finnhub: 0, yahoo: 0, ohneTreffer: 0 }

  await vorladeDivvydiary(
    aktiv
      .map((p) => {
        const isin = isinFuerPosition(p)
        return isin.length >= 10
          ? { isin, name: isinKenntnis(isin)?.name ?? p.name }
          : null
      })
      .filter((x): x is { isin: string; name: string } => x != null),
  )

  const rohNested = await mapPool(aktiv, 2, async (pos) => {
    const hits = await ladeFuerPosition(pos)
    if (hits.length === 0) {
      stat.ohneTreffer++
      return [] as AnkuendigteDividendeEintrag[]
    }
    const eintraegePos: AnkuendigteDividendeEintrag[] = []
    let positionHatTreffer = false
    for (const hit of hits) {
      if (hit.quelle === 'divvydiary-prognose') stat.prognose++
      else stat[hit.quelle === 'divvydiary' ? 'divvydiary' : hit.quelle]++
      const gesamtEur = Math.round(pos.stueck * hit.dividendeProStueckEur * 100) / 100
      if (gesamtEur <= 0) {
        if (hit.quelle === 'divvydiary-prognose') stat.prognose--
        else if (hit.quelle === 'divvydiary') stat.divvydiary--
        else stat[hit.quelle]--
        continue
      }
      positionHatTreffer = true
      eintraegePos.push({
        isin: pos.isin,
        name: pos.name,
        stueck: pos.stueck,
        zahlungsdatumIso: hit.zahlungsdatumIso,
        exDatumIso: hit.exDatumIso,
        dividendeProStueckEur: hit.dividendeProStueckEur,
        gesamtEur,
        symbol: hit.symbol,
        quelle: hit.quelle,
        bestaetigt: hit.bestaetigt,
      })
    }
    if (!positionHatTreffer) stat.ohneTreffer++
    return eintraegePos
  })

  const eintraege = rohNested
    .flat()
    .sort((a, b) => a.zahlungsdatumIso.localeCompare(b.zahlungsdatumIso))

  if (aktiv.length === 0) {
    hinweise.push('Keine offenen Positionen mit Börsen-Symbol — ISIN-Metadaten ggf. noch laden.')
  } else if (eintraege.length === 0) {
    hinweise.push(
      'Keine angekündigten Dividenden im Zeitraum heute bis +1 Jahr (ETFs/thesaurierend oder ohne Termin).',
    )
  } else {
    const teile: string[] = []
    if (stat.divvydiary > 0) teile.push(`${stat.divvydiary} angekündigt`)
    if (stat.prognose > 0) teile.push(`${stat.prognose} Prognose`)
    if (stat.finnhub > 0) teile.push(`${stat.finnhub} Finnhub`)
    if (stat.yahoo > 0) teile.push(`${stat.yahoo} Yahoo`)
    const positionenMitTermin = new Set(eintraege.map((e) => e.isin ?? e.symbol)).size
    hinweise.push(
      `${eintraege.length} Termin(e) für ${positionenMitTermin} von ${aktiv.length} Position(en): ${teile.join(', ')}. Max. 1 Jahr.`,
    )
  }

  hinweise.push(
    'Angekündigte Termine von DivvyDiary; ohne Termin Prognose aus Historie + Wachstum (wird ersetzt sobald offiziell).',
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
